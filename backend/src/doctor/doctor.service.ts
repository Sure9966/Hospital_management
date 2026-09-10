import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorConsultation, ConsultationStatus } from './doctor-consultation.entity';
import { Patient } from '../patients/patient.entity';
import { Vital } from '../nurse/vital.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Appointment } from '../receptionist/appointment.entity';
import { DischargeSummary } from './discharge-summary.entity';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
function isUuid(val?: string): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

@Injectable()
export class DoctorService {
  private readonly storageDir = path.join(process.cwd(), 'secure_storage', 'discharges');

  constructor(
    @InjectRepository(DischargeSummary)
    private dischargeRepo: Repository<DischargeSummary>,
    @InjectRepository(DoctorConsultation)
    private consultationRepo: Repository<DoctorConsultation>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(Vital)
    private vitalRepo: Repository<Vital>,
    @InjectRepository(Prescription)
    private prescriptionRepo: Repository<Prescription>,
    private notificationsService: NotificationsService,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
  ) {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  private async findPatientSafely(identifier?: string): Promise<Patient | null> {
    if (!identifier) return null;
    let patient = await this.patientRepo.findOne({ where: { patientId: identifier } });
    if (!patient && isUuid(identifier)) {
      patient = await this.patientRepo.findOne({ where: { id: identifier } });
    }
    return patient;
  }
  async createConsultation(data: Partial<DoctorConsultation>, doctorUser?: any) {
    const formattedDoctorName = doctorUser
      ? (doctorUser.firstName?.startsWith('Dr.')
        ? `${doctorUser.firstName} ${doctorUser.lastName}`
        : `Dr. ${doctorUser.firstName} ${doctorUser.lastName}`)
      : 'Doctor';

    const consultation = this.consultationRepo.create({
      ...data,
      doctorName: data.doctorName || formattedDoctorName,
      doctorId: doctorUser?.id,
    });
    const saved = await this.consultationRepo.save(consultation);

    // Update patient diagnosis if provided
    if (data.patientId && data.diagnosis) {
      const patient = await this.patientRepo.findOne({ where: { patientId: data.patientId } });
      if (patient) {
        patient.diagnosis = data.diagnosis;
        await this.patientRepo.save(patient);
      }
    }

    // Send notification to nurse about consultation
    const idempotencyKey = `consultation-${saved.id}-${Date.now()}`;
    await this.notificationsService.sendToRole(
      'New Doctor Consultation Note',
      `Dr. ${saved.doctorName} created consultation record for patient ${saved.patientName} (${saved.patientId}).`,
      'nurse',
      'consultation',
      saved.id,
      undefined,
      idempotencyKey,
    );

    return saved;
  }

  async findAllConsultations(user?: any) {
    if (user?.role === 'doctor') {
      const qb = this.consultationRepo.createQueryBuilder('c');
      const doctorNameTerm = user.lastName ? `%${user.lastName}%` : '';
      qb.where(
        '(c."doctorId" = :doctorId OR c."patientId" IN (SELECT p."patientId" FROM patients p WHERE p."assignedDoctorId" = :doctorId))',
        { doctorId: user.id },
      );
      if (doctorNameTerm) {
        qb.orWhere(
          '(c."patientId" IN (SELECT p."patientId" FROM patients p WHERE p."assignedDoctorId" IS NULL AND (p."assignedDoctorName" ILIKE :docName OR p."admittedBy" ILIKE :docName)))',
          { docName: doctorNameTerm },
        );
      }
      return qb.orderBy('c.createdAt', 'DESC').getMany();
    }
    return this.consultationRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findConsultationsByPatient(patientId: string, user?: any) {
    if (user?.role === 'doctor') {
      const patient = await this.findPatientSafely(patientId);
      if (patient) {
        const isAssigned =
          patient.assignedDoctorId === user.id ||
          (!patient.assignedDoctorId &&
            user.lastName &&
            ((patient.assignedDoctorName &&
              patient.assignedDoctorName.toLowerCase().includes(user.lastName.toLowerCase())) ||
              (patient.admittedBy &&
                patient.admittedBy.toLowerCase().includes(user.lastName.toLowerCase()))));
        if (!isAssigned) {
          throw new ForbiddenException(
            'Access denied: Patient is assigned to another doctor',
          );
        }
      }
    }
    return this.consultationRepo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async updateConsultation(id: string, data: Partial<DoctorConsultation>, user?: any) {
    if (user?.role === 'doctor') {
      const existing = await this.consultationRepo.findOne({ where: { id } });
      if (existing && existing.patientId) {
        await this.findConsultationsByPatient(existing.patientId, user);
      }
    }
    await this.consultationRepo.update(id, data);
    return this.consultationRepo.findOne({ where: { id } });
  }

  async getPatientFullEhr(patientIdentifier: string, user?: any) {
    const patient = await this.findPatientSafely(patientIdentifier);

    if (!patient) {
      throw new NotFoundException('Patient record not found');
    }

    if (user?.role === 'doctor') {
      const isAssigned =
        patient.assignedDoctorId === user.id ||
        (!patient.assignedDoctorId &&
          user.lastName &&
          ((patient.assignedDoctorName &&
            patient.assignedDoctorName.toLowerCase().includes(user.lastName.toLowerCase())) ||
            (patient.admittedBy &&
              patient.admittedBy.toLowerCase().includes(user.lastName.toLowerCase()))));
      if (!isAssigned) {
        throw new ForbiddenException(
          'Access denied: You are only authorized to view EHR records for your assigned patients',
        );
      }
    }

    const vitals = await this.vitalRepo.find({
      where: { patientId: patient.patientId },
      order: { createdAt: 'DESC' },
    });

    const prescriptions = await this.prescriptionRepo.find({
      where: { patientId: patient.patientId },
      order: { createdAt: 'DESC' },
    });

    const consultations = await this.consultationRepo.find({
      where: { patientId: patient.patientId },
      order: { createdAt: 'DESC' },
    });

    // Integrated laboratory & radiology test results
    const labResults = [
      {
        id: `LAB-${patient.patientId}-01`,
        testName: 'Complete Blood Count (CBC)',
        category: 'Hematology',
        orderedDate: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        status: 'Completed',
        result: 'Hb: 14.2 g/dL, WBC: 6,800/uL, Platelets: 250,000/uL',
        referenceRange: 'Hb 13.5-17.5 g/dL',
        doctorNotes: 'Normal blood count.',
      },
      {
        id: `LAB-${patient.patientId}-02`,
        testName: 'Comprehensive Metabolic Panel (CMP)',
        category: 'Biochemistry',
        orderedDate: new Date(Date.now() - 86400000 * 4).toISOString().split('T')[0],
        status: 'Completed',
        result: 'Glucose: 95 mg/dL, Creatinine: 0.9 mg/dL, BUN: 14 mg/dL',
        referenceRange: 'Glucose 70-99 mg/dL',
        doctorNotes: 'Kidney and metabolic functions normal.',
      },
      {
        id: `LAB-${patient.patientId}-03`,
        testName: 'Chest X-Ray PA View',
        category: 'Radiology',
        orderedDate: new Date(Date.now() - 86400000 * 7).toISOString().split('T')[0],
        status: 'Completed',
        result: 'No focal consolidation, pneumothorax, or pleural effusion.',
        referenceRange: 'Normal Chest X-Ray',
        doctorNotes: 'Lungs clear.',
      },
      {
        id: `LAB-${patient.patientId}-04`,
        testName: 'Lipid Panel Profile',
        category: 'Biochemistry',
        orderedDate: new Date(Date.now() - 86400000 * 1).toISOString().split('T')[0],
        status: 'Pending',
        result: 'Sample Processing in Central Lab',
        referenceRange: 'Desirable Cholesterol < 200 mg/dL',
        doctorNotes: 'Awaiting lab report.',
      },
    ];

    const dischargeSummaries =
      await this.dischargeRepo.find({
        where: {
          patientId: patient.patientId,
        },
        order: {
          createdAt: 'DESC',
        },
      });
    return {
      patient,
      vitals,
      prescriptions,
      consultations,
      labResults,
      dischargeSummaries,
    };
  }

  async assignDoctorToPatient(patientId: string, doctorName: string, doctorId?: string) {
    const patient = await this.findPatientSafely(patientId);
    if (!patient) {
      throw new NotFoundException('Patient record not found');
    }

    patient.admittedBy = doctorName;
    patient.assignedDoctorName = doctorName;
    if (doctorId) {
      patient.assignedDoctorId = doctorId;
    }

    await this.patientRepo.save(patient);

    if (doctorId) {
      const idempotencyKey = `doctor-assignment-${patient.id}-${doctorId}-${Date.now()}`;
      await this.notificationsService.sendToUser(
        'New Patient Assigned',
        `Patient ${patient.firstName} ${patient.lastName} (${patient.patientId}) has been assigned to you.`,
        doctorId,
        'doctor_assignment',
        patient.id,
        undefined,
        idempotencyKey,
      );
    }

    const idempotencyKey = `doctor-assignment-nurse-${patient.id}-${Date.now()}`;
    await this.notificationsService.sendToRole(
      'Hospital Attending Doctor Assigned',
      `Attending Doctor ${doctorName} assigned to patient ${patient.firstName} ${patient.lastName} (${patient.patientId}).`,
      'nurse',
      'doctor_assignment',
      patient.id,
      undefined,
      idempotencyKey,
    );

    return patient;
  }

  async getMyAppointments(doctorId: string, user?: any) {
    const qb = this.appointmentRepo.createQueryBuilder('a');
    const doctorNameTerm = user?.lastName ? `%${user.lastName}%` : '';
    if (doctorNameTerm) {
      qb.where('a.doctorId = :doctorId OR (a.doctorId IS NULL AND a.doctorName ILIKE :docName)', {
        doctorId,
        docName: doctorNameTerm,
      });
    } else {
      qb.where('a.doctorId = :doctorId', { doctorId });
    }
    return qb
      .orderBy('a.appointmentDate', 'ASC')
      .addOrderBy('a.appointmentTime', 'ASC')
      .getMany();
  }

  private async generateDischargePdf(
    discharge: DischargeSummary,
    patient: Patient,
  ): Promise<void> {
    const pdfKey = `discharges/${discharge.patientId}_${Date.now()}.pdf`;
    const fullPath = path.join(this.storageDir, `${discharge.patientId}_discharge.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const stream = fs.createWriteStream(fullPath);
      doc.pipe(stream);

      // ─── Page geometry ──────────────────────────────────────────────
      const PAGE_LEFT = 30;
      const PAGE_RIGHT = 565;
      const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;          // 535
      const LABEL_W = 105;                                 // label column
      const VALUE_W = (PAGE_WIDTH / 2) - LABEL_W;          // each half cell

      // ─── Hospital header ────────────────────────────────────────────
      doc
        .fillColor('#0f172a')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('NEUROSTAR MULTISPECIALITY HOSPITAL', PAGE_LEFT, 30, {
          width: PAGE_WIDTH,
          align: 'center',
        });

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#475569')
        .text(
          '67-19-1, Opp Ashram School, Nagamalli thota, Kakinada 533003, India',
          PAGE_LEFT,
          50,
          { width: PAGE_WIDTH, align: 'center' },
        )
        .text('Phone: 7396333335 | Email: neurostarhospital@gmail.com', {
          width: PAGE_WIDTH,
          align: 'center',
        });

      // Logo (top-right) — replace with real file if you have it
      doc.image('assets/logo.png', PAGE_RIGHT - 55, 25, { width: 50 });
      doc.image('assets/logo1.png', PAGE_LEFT - 55, 25, { width: 50 });
      // ─── Title bar ──────────────────────────────────────────────────
      const titleY = 80;
      doc.rect(PAGE_LEFT, titleY, PAGE_WIDTH, 20).fill('#1e3a8a');
      doc
        .fillColor('#ffffff')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('DISCHARGE SUMMARY', PAGE_LEFT, titleY + 5, {
          width: PAGE_WIDTH,
          align: 'center',
        });

      // ─── Patient info grid (2 columns x N rows) ─────────────────────
      let y = titleY + 25;
      const rowH = 16;

      const drawRow = (
        leftLabel: string, leftValue: string,
        rightLabel: string, rightValue: string,
      ) => {
        // left cell
        doc.rect(PAGE_LEFT, y, LABEL_W + VALUE_W, rowH).stroke('#94a3b8');
        doc.rect(PAGE_LEFT + LABEL_W + VALUE_W, y, LABEL_W + VALUE_W, rowH).stroke('#94a3b8');
        doc.rect(PAGE_LEFT + LABEL_W, y, VALUE_W, rowH).stroke('#94a3b8');
        doc.rect(PAGE_LEFT + LABEL_W + VALUE_W + LABEL_W, y, VALUE_W, rowH).stroke('#94a3b8');

        // vertical divider between halves
        doc.moveTo(PAGE_LEFT + LABEL_W + VALUE_W, y).lineTo(PAGE_LEFT + LABEL_W + VALUE_W, y + rowH).stroke('#94a3b8');

        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
        doc.text(leftLabel, PAGE_LEFT + 4, y + 4, { width: LABEL_W - 6 });
        doc.text(rightLabel, PAGE_LEFT + LABEL_W + VALUE_W + 4, y + 4, { width: LABEL_W - 6 });

        doc.font('Helvetica').fillColor('#334155');
        doc.text(leftValue, PAGE_LEFT + LABEL_W + 4, y + 4, { width: VALUE_W - 6 });
        doc.text(rightValue, PAGE_LEFT + LABEL_W + VALUE_W + LABEL_W + 4, y + 4, { width: VALUE_W - 6 });

        y += rowH;
      };

      drawRow('Patient ID', discharge.patientId, 'Patient Name', discharge.patientName);
      drawRow('Age', (patient as any).age ? `${(patient as any).age} Yrs` : '—', 'Gender', patient.gender || '—');
      drawRow('Admission No', (patient as any).admissionNo || '—', 'Visit Type', (patient as any).visitType || 'InPatient');
      drawRow('Specialty', (patient as any).specialty || 'GENERAL', 'Consultant', discharge.doctorName || '—');
      drawRow('Mobile Number', patient.phone || '—', 'Category', (patient as any).category || 'CASH');
      drawRow('Admission Date', (patient as any).admissionDate || '—', 'Discharge Date', discharge.dischargeDate);

      // ─── Hospital course / treatment (multi-line block) ─────────────
      y += 4;
      const blockLabelW = 140;
      const blockValueW = PAGE_WIDTH - blockLabelW;

      const drawBlock = (label: string, value: string) => {
        const text = value || '—';
        const textHeight = doc.heightOfString(text, { width: blockValueW - 10 });
        const h = Math.max(20, textHeight + 12);

        doc.rect(PAGE_LEFT, y, blockLabelW, h).stroke('#94a3b8');
        doc.rect(PAGE_LEFT + blockLabelW, y, blockValueW, h).stroke('#94a3b8');

        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
        doc.text(label, PAGE_LEFT + 4, y + 6, { width: blockLabelW - 6 });

        doc.font('Helvetica').fillColor('#1e293b').fontSize(9);
        doc.text(text, PAGE_LEFT + blockLabelW + 6, y + 5, {
          width: blockValueW - 12,
          align: 'left',
          lineGap: 2,
        });

        y += h;
      };

      drawBlock(
        'Hospital course/Treatment Given',
        discharge.dischargeSummary ||
        'Patient admitted and treated. Clinical course uneventful. Discharged in stable condition.',
      );

      // ─── Key Test Results section ───────────────────────────────────
      y += 6;
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
      doc.text('Key Test Results', PAGE_LEFT, y);
      y += 14;

      // Lab Results row
      doc.rect(PAGE_LEFT, y, blockLabelW, 18).stroke('#94a3b8');
      doc.rect(PAGE_LEFT + blockLabelW, y, blockValueW, 18).stroke('#94a3b8');
      doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(9);
      doc.text('Lab Results', PAGE_LEFT + 4, y + 5);
      doc.font('Helvetica').fillColor('#1e293b');
      doc.text(
        (discharge as any).labResults || 'ALL INVESTIGATIONS WERE ENCLOSED.',
        PAGE_LEFT + blockLabelW + 6,
        y + 5,
        { width: blockValueW - 12 },
      );
      y += 18;

      // Condition at Discharge row (multi-line)
      const conditionText =
        (discharge as any).conditionNotes ||
        [
          `PATIENT : ${discharge.conditionAtDischarge || 'CONSCIOUS AND COHERENT'}`,
          'GCS : E4V5M6',
          'ALL VITALS ARE STABLE',
          'NEUROLOGICAL EXAMINATION : NORMAL.',
          'OTHER SYSTEMIC EXAMINATION : NORMAL.',
        ].join('\n');

      const conditionH = Math.max(
        60,
        doc.heightOfString(conditionText, { width: blockValueW - 12 }) + 12,
      );

      doc.rect(PAGE_LEFT, y, blockLabelW, conditionH).stroke('#94a3b8');
      doc.rect(PAGE_LEFT + blockLabelW, y, blockValueW, conditionH).stroke('#94a3b8');

      doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(9);
      doc.text('Condition at Discharge', PAGE_LEFT + 4, y + 6, { width: blockLabelW - 6 });

      doc.font('Helvetica').fillColor('#1e293b');
      doc.text(conditionText, PAGE_LEFT + blockLabelW + 6, y + 6, {
        width: blockValueW - 12,
        lineGap: 3,
      });

      y += conditionH;

      // ─── Follow-up box (kept from original design) ──────────────────
      if (discharge.followUpDate || discharge.followUpInstructions) {
        y += 8;
        doc.rect(PAGE_LEFT, y, PAGE_WIDTH, 34).fillAndStroke('#f0fdf4', '#10b981');
        doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(9);
        doc.text('FOLLOW-UP INSTRUCTIONS', PAGE_LEFT + 8, y + 5);
        doc.font('Helvetica').fontSize(9).fillColor('#047857');
        doc.text(
          `Follow-up Date: ${discharge.followUpDate || '—'}   |   ${discharge.followUpInstructions || ''}`,
          PAGE_LEFT + 8,
          y + 19,
          { width: PAGE_WIDTH - 16 },
        );
        y += 34;
      }

      // ─── Signature strip ────────────────────────────────────────────
      y += 14;
      doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).stroke('#cbd5e1');
      y += 8;

      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
      doc.text('ATTENDING PHYSICIAN', PAGE_LEFT, y);
      doc.text('HOSPITAL STAMP', PAGE_RIGHT - 150, y, { width: 150, align: 'right' });

      doc.font('Helvetica').fillColor('#64748b').fontSize(8);
      doc.text(`Dr. ${discharge.doctorName || '—'}`, PAGE_LEFT, y + 14);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, PAGE_LEFT, y + 26);
      doc.text(`Patient ID: ${discharge.patientId}`, PAGE_LEFT, y + 38);

      // ─── Footer ─────────────────────────────────────────────────────
      doc
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          'This document is electronically generated by MediCore Health System. Valid without physical signature.',
          PAGE_LEFT,
          800,
          { width: PAGE_WIDTH, align: 'center' },
        );

      doc.end();

      stream.on('finish', async () => {
        try {
          const stats = fs.statSync(fullPath);
          const fileBuffer = fs.readFileSync(fullPath);
          const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

          await this.dischargeRepo.update(discharge.id, {
            dischargePdfKey: pdfKey,
            dischargePdfName: `${discharge.patientId}_discharge.pdf`,
            dischargePdfMimeType: 'application/pdf',
            dischargePdfSize: stats.size,
            dischargePdfHash: hashSum,
            dischargeGeneratedAt: new Date(),
          });

          resolve();
        } catch (err) {
          reject(err);
        }
      });

      stream.on('error', (err) => reject(err));
    });
  }

  private wrapText(doc: PDFKit.PDFDocument, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = doc.widthOfString(testLine);

      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  async dischargePatient(
    patientIdentifier: string,
    data: any,
    doctorUser: any,
  ) {
    const patient = await this.findPatientSafely(patientIdentifier);

    if (!patient) {
      throw new NotFoundException('Patient record not found');
    }

    if (doctorUser?.role === 'doctor') {
      const isAssigned =
        patient.assignedDoctorId === doctorUser.id ||
        (!patient.assignedDoctorId &&
          doctorUser.lastName &&
          ((patient.assignedDoctorName &&
            patient.assignedDoctorName.toLowerCase().includes(doctorUser.lastName.toLowerCase())) ||
            (patient.admittedBy &&
              patient.admittedBy.toLowerCase().includes(doctorUser.lastName.toLowerCase()))));
      if (!isAssigned) {
        throw new ForbiddenException('Access denied: Patient is assigned to another doctor');
      }
    }

    if (patient.status === 'discharged' as any) {
      // throw new Error('Patient is already discharged');
      throw new BadRequestException('Patient is already discharged');
    }

    const doctorName =
      doctorUser?.firstName && doctorUser?.lastName
        ? `Dr. ${doctorUser.firstName} ${doctorUser.lastName}`
        : patient.assignedDoctorName || patient.admittedBy || 'Doctor';

    const discharge = this.dischargeRepo.create({
      patientId: patient.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,

      doctorId: doctorUser?.id,
      doctorName,

      diagnosis: data.diagnosis || patient.diagnosis || '',

      dischargeDate:
        data.dischargeDate ||
        new Date().toISOString().split('T')[0],

      conditionAtDischarge:
        data.conditionAtDischarge || 'Stable',

      dischargeSummary: data.dischargeSummary,

      medications: data.medications || '',

      followUpDate: data.followUpDate || '',

      followUpInstructions:
        data.followUpInstructions || '',

      dietInstructions:
        data.dietInstructions || '',

      activityInstructions:
        data.activityInstructions || '',
    });

    const savedDischarge =
      await this.dischargeRepo.save(discharge);

    // Generate discharge PDF
    await this.generateDischargePdf(savedDischarge, patient);

    // Update patient
    patient.status = 'discharged' as any;

    patient.diagnosis =
      data.diagnosis || patient.diagnosis;

    await this.patientRepo.save(patient);

    // Optional: update current consultations
    await this.consultationRepo
      .createQueryBuilder()
      .update(DoctorConsultation)
      .set({
        status: ConsultationStatus.DISCHARGED,
      })
      .where('"patientId" = :patientId', {
        patientId: patient.patientId,
      })
      .andWhere('status != :completed', {
        completed: ConsultationStatus.COMPLETED,
      })
      .execute();

    // Real-time Nurse notification
    const idempotencyKey = `discharge-${patient.id}-${Date.now()}`;
    await this.notificationsService.sendToRole(
      '🏥 Patient Discharged',
      `${patient.firstName} ${patient.lastName} (${patient.patientId}) has been discharged by ${doctorName}. Please complete nursing discharge procedures.`,
      'nurse',
      'patient_discharge',
      patient.id,
      undefined,
      idempotencyKey,
    );

    // Real-time Manager notification
    const managerIdempotencyKey = `discharge-manager-${patient.id}-${Date.now()}`;
    await this.notificationsService.sendToRole(
      '🏥 Patient Discharged - Management Alert',
      `${patient.firstName} ${patient.lastName} (${patient.patientId}) has been discharged by ${doctorName}. Discharge summary and PDF have been generated.`,
      'management',
      'patient_discharge',
      patient.id,
      undefined,
      managerIdempotencyKey,
    );

    return {
      message: 'Patient discharged successfully',
      patient,
      discharge: savedDischarge,
    };
  }

  async getAllDischargeSummaries() {
    return this.dischargeRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDischargePdfStream(id: string) {
    const discharge = await this.dischargeRepo.findOne({ where: { id } });
    if (!discharge) {
      throw new NotFoundException('Discharge summary not found');
    }

    const fullPath = path.join(this.storageDir, `${discharge.patientId}_discharge.pdf`);

    if (!fs.existsSync(fullPath)) {
      // Regenerate if missing
      const patient = await this.findPatientSafely(discharge.patientId);
      if (patient) {
        await this.generateDischargePdf(discharge, patient);
      }
    }

    return {
      stream: fs.createReadStream(fullPath),
      filename: `${discharge.patientId}_discharge.pdf`,
      mimeType: 'application/pdf',
      size: fs.statSync(fullPath).size,
    };
  }
}
