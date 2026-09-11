import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './patient.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { HospitalConfig } from '../config/hospital.config';

function isUuid(val?: string): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private notificationsService: NotificationsService,
  ) {}

  async create(data: Partial<Patient>, createdById?: string) {
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
