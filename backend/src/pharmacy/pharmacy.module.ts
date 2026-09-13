import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prescription } from './prescription.entity';
import { Tablet } from './tablet.entity';
import { PharmacyService } from './pharmacy.service';
import { PharmacyController } from './pharmacy.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { Patient } from '../patients/patient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Prescription, Patient, Tablet]), NotificationsModule],
  providers: [PharmacyService],
  controllers: [PharmacyController],
})
export class PharmacyModule {}

