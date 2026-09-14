import { Injectable, ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient, PatientStatus } from './patient.entity';
import { Appointment, AppointmentStatus } from '../receptionist/appointment.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { HospitalConfig } from '../config/hospital.config';

function isUuid(val?: string): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

export function normalizePhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) {
    return `+91 ${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91 ${digits.slice(1)}`;
  }
  if (phone.trim().startsWith('+')) {
    return `+${digits}`;
  }
  return `+91 ${digits.slice(-10)}`;
}

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    private notificationsService: NotificationsService,
  ) {}

  async checkPhoneExists(phone: string) {
    if (!phone || !phone.trim()) return { exists: false };
    const cleanDigits = phone.replace(/\D/g, '');
    const last10 = cleanDigits.slice(-10);
    if (last10.length < 10) {
      return { exists: false, invalidFormat: true };
    }

    const existing = await this.patientRepo
      .createQueryBuilder('p')
      .where("REPLACE(REPLACE(p.phone, ' ', ''), '+', '') LIKE :digits", {
        digits: `%${last10}`,
      })
      .getOne();

    if (existing) {
      return {
        exists: true,
        patientId: existing.patientId,
        patientName: `${existing.firstName} ${existing.lastName}`,
        phone: existing.phone,
      };
    }

    return { exists: false };
  }

  async create(data: Partial<Patient>, createdById?: string) {
    if (data.phone) {
      const formatted = normalizePhone(data.phone);
      const check = await this.checkPhoneExists(data.phone);
      if (check.exists) {
        throw new ConflictException(
          `Patient with phone number ${formatted || data.phone} already exists in backend (${check.patientName}, Patient ID: ${check.patientId})`,
        );
      }
      data.phone = formatted;
    }
    if (data.emergencyPhone) {
      data.emergencyPhone = normalizePhone(data.emergencyPhone);
    }

    const count = await this.patientRepo.count();
    const year = new Date().getFullYear().toString().slice(-2); // Get last 2 digits of year
    const seq = String(count + 1).padStart(6, '0');
    const patientId = data.patientId || `${HospitalConfig.prefix}${year}${seq}`;
    const opdTokenNumber = `TK-${year}-${seq}`;
    const admissionNumber = `IP${year}${seq}`;

    const patient = this.patientRepo.create({
      ...data,
      patientId,
      opdTokenNumber,
      admissionNumber,
    });
    const saved = await this.patientRepo.save(patient);

    // Auto-create OPD Queue Appointment so patient appears in Receptionist Dashboard & OPD Queue Tokens
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      let docName = saved.assignedDoctorName || '';
      if (docName.toLowerCase().startsWith('dr.')) {
        docName = docName.replace(/^dr\.\s*/i, '');
      }
      if (!docName) {
        docName = 'General OPD Doctor';
      }

      const appointment = this.appointmentRepo.create({
        patientId: saved.patientId,
        patientName: `${saved.firstName} ${saved.lastName}`,
        doctorId: saved.assignedDoctorId || undefined,
        doctorName: docName,
        department: saved.department || 'General',
        appointmentDate: todayStr,
        appointmentTime: timeStr,
        status: AppointmentStatus.SCHEDULED,
        reason: saved.diagnosis || 'OPD Registration & Queue Token',
        notes: `OPD Queue Token: ${saved.opdTokenNumber}`,
        registeredBy: createdById,
      });
      await this.appointmentRepo.save(appointment);
    } catch (err) {
      // Non-blocking log if appointment creation encounters an issue
    }

    // Generate idempotency key to prevent duplicate notifications
    const idempotencyKey = `patient-registration-${saved.id}-${Date.now()}`;

    // Send to nurses
    await this.notificationsService.sendToRole(
      'New Patient Registered',
      `Patient ${saved.firstName} ${saved.lastName} (${saved.patientId}) - OPD Token: ${saved.opdTokenNumber}`,
      'nurse',
      'registration',
      saved.id,
      createdById,
      idempotencyKey,
    );

    // Send to management users
    await this.notificationsService.sendToRole(
      'New Patient',
      `New patient ${saved.firstName} ${saved.lastName} registered with Token ${saved.opdTokenNumber}.`,
      'management',
      'registration',
      saved.id,
      createdById,
      idempotencyKey,
    );

    // Send to specific doctor if assigned
    if (saved.assignedDoctorId) {
      await this.notificationsService.sendToUser(
        'New Patient Assignment',
        `Patient ${saved.firstName} ${saved.lastName} (${saved.patientId}) has been assigned to you. Token: ${saved.opdTokenNumber}`,
        saved.assignedDoctorId,
        'registration',
        saved.id,
        createdById,
        `${idempotencyKey}-doctor-${saved.assignedDoctorId}`,
      );
    }

    return saved;
  }

  async findAll(user?: any, doctorIdQuery?: string) {
    if (user?.role === 'doctor') {
      const qb = this.patientRepo.createQueryBuilder('p');
      const doctorNameTerm = user.lastName ? `%${user.lastName}%` : '';
      if (doctorNameTerm) {
        qb.where(
          '(p.assignedDoctorId = :doctorId OR (p.assignedDoctorId IS NULL AND (p.assignedDoctorName ILIKE :docName OR p.admittedBy ILIKE :docName)))',
          { doctorId: user.id, docName: doctorNameTerm },
        );
      } else {
        qb.where('p.assignedDoctorId = :doctorId', { doctorId: user.id });
      }
      return qb.orderBy('p.createdAt', 'DESC').getMany();
    }

    if (doctorIdQuery) {
      return this.patientRepo.find({
        where: { assignedDoctorId: doctorIdQuery },
        order: { createdAt: 'DESC' },
      });
    }

    return this.patientRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string, user?: any) {
    let patient: Patient | null = null;
    if (isUuid(id)) {
      patient = await this.patientRepo.findOne({ where: { id } });
    }
    if (!patient) {
      patient = await this.patientRepo.findOne({ where: { patientId: id } });
    }

    if (!patient) {
      return null;
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
          'Access denied: Patient is assigned to another doctor',
        );
      }
    }

    return patient;
  }

  async findByPatientId(patientId: string) {
    return this.patientRepo.findOne({ where: { patientId } });
  }

  async update(id: string, data: Partial<Patient>, user?: any) {
    const existing = await this.findOne(id, user);
    if (!existing) {
      throw new NotFoundException('Patient not found');
    }
    await this.patientRepo.update(existing.id, data);
    return this.findOne(existing.id, user);
  }

  async remove(id: string) {
    let patient: Patient | null = null;
    if (isUuid(id)) {
      patient = await this.patientRepo.findOne({ where: { id } });
    }
    if (!patient) {
      patient = await this.patientRepo.findOne({ where: { patientId: id } });
    }
    if (patient) {
      await this.patientRepo.delete(patient.id);
    }
    return { success: true };
  }

  async createEmergency(data: Partial<Patient>, createdById?: string) {
    if (data.phone && data.phone.trim()) {
      data.phone = normalizePhone(data.phone);
    }
    if (data.emergencyPhone && data.emergencyPhone.trim()) {
      data.emergencyPhone = normalizePhone(data.emergencyPhone);
    }

    const count = await this.patientRepo.count();
    const year = new Date().getFullYear().toString().slice(-2);
    const seq = String(count + 1).padStart(6, '0');
    const patientId = data.patientId || `EMG${year}${seq}`;
    const opdTokenNumber = `EMG-TK-${year}-${seq}`;
    const admissionNumber = `EMG-IP${year}${seq}`;

    const firstName = data.firstName?.trim() || 'Emergency';
    const lastName = data.lastName?.trim() || `Patient-${seq.slice(-4)}`;

    const patient = this.patientRepo.create({
      ...data,
      firstName,
      lastName,
      patientId,
      opdTokenNumber,
      admissionNumber,
      isEmergency: true,
      isBasicRegistrationComplete: false,
      emergencySeverity: data.emergencySeverity || 'critical',
      department: data.department || 'Emergency',
      status: PatientStatus.UNDER_TREATMENT,
    });
    const saved = await this.patientRepo.save(patient);

    // Auto-create OPD Queue Appointment for emergency consultation
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      let docName = saved.assignedDoctorName || '';
      if (docName.toLowerCase().startsWith('dr.')) {
        docName = docName.replace(/^dr\.\s*/i, '');
      }
      if (!docName) {
        docName = 'Emergency Doctor';
      }

      const appointment = this.appointmentRepo.create({
        patientId: saved.patientId,
        patientName: `${saved.firstName} ${saved.lastName}`,
        doctorId: saved.assignedDoctorId || undefined,
        doctorName: docName,
        department: saved.department || 'Emergency',
        appointmentDate: todayStr,
        appointmentTime: timeStr,
        status: AppointmentStatus.SCHEDULED,
        reason: `🚨 EMERGENCY INTAKE: ${saved.diagnosis || 'Emergency Medical Care'}`,
        notes: `EMERGENCY Token: ${saved.opdTokenNumber}`,
        registeredBy: createdById,
      });
      await this.appointmentRepo.save(appointment);
    } catch (err) {
      // Non-blocking
    }

    const idempotencyKey = `emergency-patient-${saved.id}-${Date.now()}`;

    // 1. Notify Management so they can track emergency patients clearly
    await this.notificationsService.sendToRole(
      '🚨 Emergency Patient Intake',
      `Emergency patient ${saved.firstName} ${saved.lastName} (${saved.patientId}) admitted in ${saved.department}. Condition: ${saved.diagnosis || 'Critical'}. Token: ${saved.opdTokenNumber}`,
      'management',
      'emergency',
      saved.id,
      createdById,
      `${idempotencyKey}-management`,
    );

    // 2. Notify Nurses for immediate triage
    await this.notificationsService.sendToRole(
      '🚨 Immediate Triage Required',
      `Emergency patient ${saved.firstName} ${saved.lastName} (${saved.patientId}) - Token: ${saved.opdTokenNumber}`,
      'nurse',
      'emergency',
      saved.id,
      createdById,
      `${idempotencyKey}-nurse`,
    );

    // 3. Notify assigned doctor specifically
    if (saved.assignedDoctorId) {
      await this.notificationsService.sendToUser(
        '🚨 URGENT Emergency Patient Assigned',
        `Emergency patient ${saved.firstName} ${saved.lastName} (${saved.patientId}) assigned to you! Condition: ${saved.diagnosis || 'Critical'}. OPD Token: ${saved.opdTokenNumber}`,
        saved.assignedDoctorId,
        'emergency',
        saved.id,
        createdById,
        `${idempotencyKey}-doctor-${saved.assignedDoctorId}`,
      );
    }

    return saved;
  }

  async completeRegistration(id: string, fullData: Partial<Patient>) {
    const patient = await this.findOne(id);
    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    if (fullData.phone && fullData.phone.trim()) {
      fullData.phone = normalizePhone(fullData.phone);
    }
    if (fullData.emergencyPhone && fullData.emergencyPhone.trim()) {
      fullData.emergencyPhone = normalizePhone(fullData.emergencyPhone);
    }

    const updatePayload: Partial<Patient> = {
      ...fullData,
      isBasicRegistrationComplete: true,
    };

    await this.patientRepo.update(patient.id, updatePayload);
    const updated = await this.findOne(patient.id);

    // Notify management & doctor that full registration is completed
    const idempotencyKey = `complete-reg-${patient.id}-${Date.now()}`;
    await this.notificationsService.sendToRole(
      '✅ Emergency Patient Registration Completed',
      `Emergency patient ${updated?.firstName} ${updated?.lastName} (${updated?.patientId}) registration has been fully updated.`,
      'management',
      'registration',
      patient.id,
      undefined,
      `${idempotencyKey}-management`,
    );

    if (updated?.assignedDoctorId) {
      await this.notificationsService.sendToUser(
        '✅ Patient Registration Completed',
        `Full registration details updated for emergency patient ${updated.firstName} ${updated.lastName} (${updated.patientId}).`,
        updated.assignedDoctorId,
        'registration',
        patient.id,
        undefined,
        `${idempotencyKey}-doctor-${updated.assignedDoctorId}`,
      );
    }

    return updated;
  }

  async findPendingEmergency() {
    return this.patientRepo.find({
      where: {
        isEmergency: true,
        isBasicRegistrationComplete: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async search(query: string, user?: any) {
    const qb = this.patientRepo
      .createQueryBuilder('p')
      .where(
        '(p.firstName ILIKE :q OR p.lastName ILIKE :q OR p.patientId ILIKE :q OR p.opdTokenNumber ILIKE :q OR p.phone ILIKE :q)',
        { q: `%${query}%` },
      );

    if (user?.role === 'doctor') {
      const doctorNameTerm = user.lastName ? `%${user.lastName}%` : '';
      if (doctorNameTerm) {
        qb.andWhere(
          '(p.assignedDoctorId = :doctorId OR (p.assignedDoctorId IS NULL AND (p.assignedDoctorName ILIKE :docName OR p.admittedBy ILIKE :docName)))',
          { doctorId: user.id, docName: doctorNameTerm },
        );
      } else {
        qb.andWhere('p.assignedDoctorId = :doctorId', { doctorId: user.id });
      }
    }

    return qb.orderBy('p.createdAt', 'DESC').take(20).getMany();
  }
}
