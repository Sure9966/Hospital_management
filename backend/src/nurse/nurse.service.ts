import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vital } from './vital.entity';
import { Patient } from '../patients/patient.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { DischargeSummary } from '../doctor/discharge-summary.entity';
import { NotificationsService } from '../notifications/notifications.service';
import * as fs from 'fs';
import * as path from 'path';

function isUuid(val?: string): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

@Injectable()
export class NurseService {
  private readonly storageDir = path.join(process.cwd(), 'secure_storage', 'discharges');

  constructor(
    @InjectRepository(Vital)
    private vitalRepo: Repository<Vital>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(Prescription)
    private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(DischargeSummary)
    private dischargeRepo: Repository<DischargeSummary>,
    private notificationsService: NotificationsService,
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

  async recordVitals(data: Partial<Vital>, recordedById?: string) {
    const vital = this.vitalRepo.create(data);
    const saved = await this.vitalRepo.save(vital);

    if (saved.status === 'critical') {
      await this.notificationsService.sendToRole(
        '🚨 CRITICAL VITALS',
        `Patient ${saved.patientName} has critical vitals! Triage Priority: ${saved.triagePriority || 'Emergency'}. Immediate attention required.`,
        'management',
        'emergency',
        saved.id,
        recordedById,
      );
      await this.notificationsService.sendToRole(
        '🚨 CRITICAL VITALS',
        `Patient ${saved.patientName} has critical vitals!`,
        'receptionist',
        'emergency',
        saved.id,
      );
    } else if (saved.status === 'warning') {
      await this.notificationsService.sendToRole(
        '⚠️ Abnormal Vitals',
        `Patient ${saved.patientName} shows abnormal vitals. Triage Priority: ${saved.triagePriority || 'High'}.`,
        'management',
        'warning',
        saved.id,
        recordedById,
      );
    }

    return saved;
  }

  async findAllVitals(user?: any) {
    if (user?.role === 'doctor') {
      const qb = this.vitalRepo.createQueryBuilder('v');
      const doctorNameTerm = user.lastName ? `%${user.lastName}%` : '';
      qb.where(
        'v."patientId" IN (SELECT p."patientId" FROM patients p WHERE p."assignedDoctorId" = :doctorId)',
        { doctorId: user.id },
      );
      if (doctorNameTerm) {
        qb.orWhere(
          'v."patientId" IN (SELECT p."patientId" FROM patients p WHERE p."assignedDoctorId" IS NULL AND (p."assignedDoctorName" ILIKE :docName OR p."admittedBy" ILIKE :docName))',
          { docName: doctorNameTerm },
        );
      }
      return qb.orderBy('v.createdAt', 'DESC').getMany();
    }
    return this.vitalRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findVitalsByPatient(patientId: string, user?: any) {
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
    return this.vitalRepo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async findVitalById(id: string) {
    return this.vitalRepo.findOne({ where: { id } });
  }

  async updateVital(id: string, data: Partial<Vital>) {
    await this.vitalRepo.update(id, data);
    return this.findVitalById(id);
  }

  async getPatientFullMedicalHistory(patientIdentifier: string, user?: any) {
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
          'Access denied: You are only authorized to view medical history for your assigned patients',
        );
      }
    }

    const vitalsHistory = await this.vitalRepo.find({
      where: { patientId: patient.patientId },
      order: { createdAt: 'DESC' },
    });

    const prescriptionsHistory = await this.prescriptionRepo.find({
      where: { patientId: patient.patientId },
      order: { createdAt: 'DESC' },
    });

    // Mock test reports overview with structured data
    const testReports = [
      {
        id: `REP-${patient.patientId}-01`,
        title: 'Complete Blood Count (CBC)',
        category: 'Hematology',
        date: new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0],
        status: 'Normal',
        notes: 'Hemoglobin: 14.2 g/dL, WBC: 6,800 /uL, Platelets: 250,000 /uL',
      },
      {
        id: `REP-${patient.patientId}-02`,
        title: 'Comprehensive Metabolic Panel (CMP)',
        category: 'Biochemistry',
        date: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0],
        status: 'Reviewed',
        notes: 'Fasting Glucose: 95 mg/dL, Creatinine: 0.9 mg/dL, ALT: 22 U/L',
      },
      {
        id: `REP-${patient.patientId}-03`,
        title: 'Chest X-Ray PA View',
        category: 'Radiology',
        date: new Date(Date.now() - 86400000 * 10).toISOString().split('T')[0],
        status: 'Clear',
        notes: 'Lungs clear, normal cardiothoracic ratio, no infiltrates seen.',
      },
    ];

    return {
      patient,
      vitalsHistory,
      prescriptionsHistory,
      testReports,
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
      throw new NotFoundException('Discharge PDF not found');
    }

    return {
      stream: fs.createReadStream(fullPath),
      filename: `${discharge.patientId}_discharge.pdf`,
      mimeType: 'application/pdf',
      size: fs.statSync(fullPath).size,
    };
  }
}
