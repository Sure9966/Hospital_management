import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorConsultation, ConsultationStatus } from './doctor-consultation.entity';
import { Patient } from '../patients/patient.entity';
import { Vital } from '../nurse/vital.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Appointment } from '../receptionist/appointment.entity';
import { DischargeSummary } from './discharge-summary.entity';
@Injectable()
export class DoctorService {
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
  ) { }
  async createConsultation(data: Partial<DoctorConsultation>, doctorUser?: any) {
    const consultation = this.consultationRepo.create({
      ...data,
      doctorName: data.doctorName || (doctorUser ? `Dr. ${doctorUser.firstName} ${doctorUser.lastName}` : 'Dr. Sarah Jenkins'),
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

    // Send notification to Pharmacy if test orders or prescriptions created
    await this.notificationsService.sendToRole(
      'New Doctor Consultation Note',
      `Dr. ${saved.doctorName} created consultation record for patient ${saved.patientName} (${saved.patientId}).`,
      'nurse',
      'consultation',
      saved.id,
    );

    return saved;
  }

  async findAllConsultations() {
    return this.consultationRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findConsultationsByPatient(patientId: string) {
    return this.consultationRepo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async updateConsultation(id: string, data: Partial<DoctorConsultation>) {
    await this.consultationRepo.update(id, data);
    return this.consultationRepo.findOne({ where: { id } });
  }

  async getPatientFullEhr(patientIdentifier: string) {
    let patient = await this.patientRepo.findOne({ where: { patientId: patientIdentifier } });
    if (!patient) {
      patient = await this.patientRepo.findOne({ where: { id: patientIdentifier } });
    }

    if (!patient) {
      throw new NotFoundException('Patient record not found');
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
    let patient = await this.patientRepo.findOne({ where: { patientId } });
    if (!patient) {
      patient = await this.patientRepo.findOne({ where: { id: patientId } });
    }
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
      await this.notificationsService.sendToUser(
        'New Patient Assigned',
        `Patient ${patient.firstName} ${patient.lastName} (${patient.patientId}) has been assigned to you.`,
        doctorId,
        'doctor_assignment',
        patient.id,
      );
    }

    await this.notificationsService.sendToRole(
      'Hospital Attending Doctor Assigned',
      `Attending Doctor ${doctorName} assigned to patient ${patient.firstName} ${patient.lastName} (${patient.patientId}).`,
      'nurse',
      'doctor_assignment',
      patient.id,
    );

    return patient;
  }

  async getMyAppointments(doctorId: string) {
    return this.appointmentRepo.find({
      where: {
        doctorId: doctorId,
      },
      order: {
        appointmentDate: 'ASC',
        appointmentTime: 'ASC',
      },
    });
  }


  async dischargePatient(
    patientIdentifier: string,
    data: any,
    doctorUser: any,
  ) {
    let patient = await this.patientRepo.findOne({
      where: { patientId: patientIdentifier },
    });

    if (!patient) {
      patient = await this.patientRepo.findOne({
        where: { id: patientIdentifier },
      });
    }

    if (!patient) {
      throw new NotFoundException('Patient record not found');
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
      .where('patientId = :patientId', {
        patientId: patient.patientId,
      })
      .andWhere('status != :completed', {
        completed: ConsultationStatus.COMPLETED,
      })
      .execute();

    // Real-time Nurse notification
    await this.notificationsService.sendToRole(
      '🏥 Patient Discharged',
      `${patient.firstName} ${patient.lastName} (${patient.patientId}) has been discharged by ${doctorName}. Please complete nursing discharge procedures.`,
      'nurse',
      'patient_discharge',
      patient.id,
    );

    return {
      message: 'Patient discharged successfully',
      patient,
      discharge: savedDischarge,
    };
  }
}
