import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Patient } from '../patients/patient.entity';
import { Appointment } from '../receptionist/appointment.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { Vital } from '../nurse/vital.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ManagementService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Appointment) private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Prescription) private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Vital) private vitalRepo: Repository<Vital>,
    private notificationsService: NotificationsService,
  ) {}

  async getDashboardStats() {
    const [
      totalPatients,
      totalUsers,
      totalAppointments,
      pendingPrescriptions,
      criticalVitals,
      admittedPatients,
    ] = await Promise.all([
      this.patientRepo.count(),
      this.userRepo.count(),
      this.appointmentRepo.count(),
      this.prescriptionRepo.count({ where: { status: 'pending' as any } }),
      this.vitalRepo.count({ where: { status: 'critical' as any } }),
      this.patientRepo.count({ where: { status: 'admitted' as any } }),
    ]);

    const today = new Date().toISOString().split('T')[0];
    const todayAppointments = await this.appointmentRepo.count({ where: { appointmentDate: today } });

    return {
      totalPatients,
      totalUsers,
      totalAppointments,
      pendingPrescriptions,
      criticalVitals,
      admittedPatients,
      todayAppointments,
    };
  }

  async broadcast(title: string, message: string, targetRole?: string) {
    return this.notificationsService.create({
      title,
      message,
      type: 'broadcast',
      targetRole,
    });
  }
}
