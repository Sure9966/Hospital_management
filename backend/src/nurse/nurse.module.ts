import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vital } from './vital.entity';
import { Patient } from '../patients/patient.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { DischargeSummary } from '../doctor/discharge-summary.entity';
import { NurseService } from './nurse.service';
import { NurseController } from './nurse.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Vital, Patient, Prescription, DischargeSummary]), NotificationsModule],
  providers: [NurseService],
  controllers: [NurseController],
  exports: [NurseService],
})
export class NurseModule {}
