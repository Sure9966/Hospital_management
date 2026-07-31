import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Appointment } from './appointment.entity';
import { Patient } from '../patients/patient.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReceptionistService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private notificationsService: NotificationsService,
  ) {}

  async createAppointment(data: Partial<Appointment>, createdById?: string) {
    const appointment = this.appointmentRepo.create(data);
    const saved = await this.appointmentRepo.save(appointment);

    await this.notificationsService.sendToRole(
      'New Appointment Scheduled',
      `Appointment for ${saved.patientName} with Dr. ${saved.doctorName} on ${saved.appointmentDate} at ${saved.appointmentTime}.`,
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
    return this.findAppointmentById(id);
  }

  async deleteAppointment(id: string) {
    await this.appointmentRepo.delete(id);
    return { success: true };
  }

  async getTodayAppointments() {
    const today = new Date().toISOString().split('T')[0];
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
