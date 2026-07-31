import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Patient } from '../patients/patient.entity';
import { Appointment } from '../receptionist/appointment.entity';
import { Prescription } from '../pharmacy/prescription.entity';
import { Vital } from '../nurse/vital.entity';
import { ManagementService } from './management.service';
import { ManagementController } from './management.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Patient, Appointment, Prescription, Vital]),
    NotificationsModule,
  ],
  providers: [ManagementService],
  controllers: [ManagementController],
})
export class ManagementModule {}
