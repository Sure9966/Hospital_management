import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { Patient } from '../patients/patient.entity';
import { NotificationsService } from '../notifications/notifications.service';

function isUuid(val?: string): boolean {
  if (!val) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
}

@Injectable()
export class ReceptionistService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private notificationsService: NotificationsService,
  ) {}

  private async findPatientSafely(identifier?: string): Promise<Patient | null> {
    if (!identifier) return null;
    let patient = await this.patientRepo.findOne({ where: { patientId: identifier } });
    if (!patient && isUuid(identifier)) {
      patient = await this.patientRepo.findOne({ where: { id: identifier } });
    }
    return patient;
  }

  async createAppointment(data: Partial<Appointment>, createdById?: string) {
    const appointment = this.appointmentRepo.create(data);
    const saved = await this.appointmentRepo.save(appointment);

    // Sync patient assigned doctor if patientId is present
    if (saved.patientId) {
      const patient = await this.findPatientSafely(saved.patientId);
      if (patient) {
        if (saved.doctorId) patient.assignedDoctorId = saved.doctorId;
        if (saved.doctorName) patient.assignedDoctorName = saved.doctorName;
        if (saved.department) patient.department = saved.department;
        await this.patientRepo.save(patient);
      }
    }

    // Send notification to the specific doctor if doctorId is provided
    if (saved.doctorId) {
      await this.notificationsService.sendToUser(
        'New Patient Appointment Assigned',
        `You have a new patient appointment: ${saved.patientName} (${saved.patientId || 'N/A'}) scheduled for ${saved.appointmentDate} at ${saved.appointmentTime}.`,
        saved.doctorId,
        'appointment',
        saved.id,
        createdById,
      );
    } else {
      // Fallback: Notify all doctors
      await this.notificationsService.sendToRole(
        'New Appointment Scheduled',
        `Appointment for ${saved.patientName} with ${saved.doctorName} on ${saved.appointmentDate} at ${saved.appointmentTime}.`,
        'doctor',
        'appointment',
        saved.id,
        createdById,
      );
    }

    await this.notificationsService.sendToRole(
      'New Appointment Scheduled',
      `Appointment for ${saved.patientName} with ${saved.doctorName} on ${saved.appointmentDate} at ${saved.appointmentTime}.`,
      'nurse',
      'appointment',
      saved.id,
      createdById,
    );

    return saved;
  }

  async findAllAppointments() {
    return this.appointmentRepo.find({ order: { appointmentDate: 'DESC' } });
  }

  async findAppointmentById(id: string) {
    return this.appointmentRepo.findOne({ where: { id } });
  }

  async updateAppointment(id: string, data: Partial<Appointment>) {
    await this.appointmentRepo.update(id, data);
    const updated = await this.findAppointmentById(id);

    if (updated && updated.patientId && (data.doctorId || data.doctorName)) {
      const patient = await this.findPatientSafely(updated.patientId);
      if (patient) {
        if (updated.doctorId) patient.assignedDoctorId = updated.doctorId;
        if (updated.doctorName) patient.assignedDoctorName = updated.doctorName;
        if (updated.department) patient.department = updated.department;
        await this.patientRepo.save(patient);
      }
    }

    return updated;
  }

  async deleteAppointment(id: string) {
    await this.appointmentRepo.delete(id);
    return { success: true };
  }

  async getTodayAppointments(user?: any) {
    const today = new Date().toISOString().split('T')[0];
    if (user?.role === 'doctor') {
      const qb = this.appointmentRepo.createQueryBuilder('a')
        .where('a.appointmentDate = :today', { today });
      const doctorNameTerm = user.lastName ? `%${user.lastName}%` : '';
      if (doctorNameTerm) {
        qb.andWhere('(a.doctorId = :doctorId OR (a.doctorId IS NULL AND a.doctorName ILIKE :docName))', {
          doctorId: user.id,
          docName: doctorNameTerm,
        });
      } else {
        qb.andWhere('a.doctorId = :doctorId', { doctorId: user.id });
      }
      return qb.orderBy('a.appointmentTime', 'ASC').getMany();
    }
    return this.appointmentRepo.find({ where: { appointmentDate: today }, order: { appointmentTime: 'ASC' } });
  }

  async getOpdQueue() {
    const today = new Date().toISOString().split('T')[0];
    const appointments = await this.appointmentRepo.find({
      order: { appointmentTime: 'ASC' },
    });

    const patients = await this.patientRepo.find({
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      appointments,
      recentRegisteredPatients: patients,
      todayCount: appointments.filter(a => a.appointmentDate === today).length,
    };
  }
}
