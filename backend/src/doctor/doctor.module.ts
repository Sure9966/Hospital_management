import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DoctorConsultation } from './doctor-consultation.entity';
import { DoctorService } from './doctor.service';
import { DoctorController } from './doctor.controller';
import { Patient } from '../patients/patient.entity';
import { Vital } from '../nurse/vital.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DoctorConsultation, Patient, Vital, Prescription]),
    NotificationsModule,
  ],
  controllers: [DoctorController],
  providers: [DoctorService],
  exports: [DoctorService],
})
export class DoctorModule {}
