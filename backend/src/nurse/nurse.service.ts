import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vital } from './vital.entity';
import { Patient } from '../patients/patient.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class NurseService {
  constructor(
    @InjectRepository(Vital)
    private vitalRepo: Repository<Vital>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(Prescription)
    private prescriptionRepo: Repository<Prescription>,
    private notificationsService: NotificationsService,
  ) {}

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

  async findAllVitals() {
    return this.vitalRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findVitalsByPatient(patientId: string) {
    return this.vitalRepo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async findVitalById(id: string) {
    return this.vitalRepo.findOne({ where: { id } });
  }

  async updateVital(id: string, data: Partial<Vital>) {
    await this.vitalRepo.update(id, data);
    return this.findVitalById(id);
  }

  async getPatientFullMedicalHistory(patientIdentifier: string) {
    let patient = await this.patientRepo.findOne({ where: { patientId: patientIdentifier } });
    if (!patient) {
      patient = await this.patientRepo.findOne({ where: { id: patientIdentifier } });
    }

    if (!patient) {
      throw new NotFoundException('Patient record not found');
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
}
