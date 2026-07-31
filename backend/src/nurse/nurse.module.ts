import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vital } from './vital.entity';
import { Patient } from '../patients/patient.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { NurseService } from './nurse.service';
import { NurseController } from './nurse.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Vital, Patient, Prescription]), NotificationsModule],
  providers: [NurseService],
  controllers: [NurseController],
  exports: [NurseService],
})
export class NurseModule {}
