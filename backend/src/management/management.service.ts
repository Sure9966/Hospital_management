import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Patient } from '../patients/patient.entity';
import { Appointment } from '../receptionist/appointment.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { Vital } from '../nurse/vital.entity';
import { DischargeSummary } from '../doctor/discharge-summary.entity';
import { NotificationsService } from '../notifications/notifications.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ManagementService {
  private readonly storageDir = path.join(process.cwd(), 'secure_storage', 'discharges');

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    @InjectRepository(Appointment) private appointmentRepo: Repository<Appointment>,
    @InjectRepository(Prescription) private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Vital) private vitalRepo: Repository<Vital>,
    @InjectRepository(DischargeSummary) private dischargeRepo: Repository<DischargeSummary>,
    private notificationsService: NotificationsService,
  ) {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

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

  async getAllDischargeSummaries() {
    return this.dischargeRepo.find({ order: { createdAt: 'DESC' } });
  }

  async getDischargePdfStream(id: string) {
    const discharge = await this.dischargeRepo.findOne({ where: { id } });
    if (!discharge) {
      throw new NotFoundException('Discharge summary not found');
    }

    let fullPath = path.join(this.storageDir, `${discharge.patientId}_discharge.pdf`);

    if (!fs.existsSync(fullPath)) {
      if (discharge.dischargePdfKey && fs.existsSync(path.join(this.storageDir, discharge.dischargePdfKey))) {
        fullPath = path.join(this.storageDir, discharge.dischargePdfKey);
      } else {
        throw new NotFoundException('Discharge PDF not found');
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
