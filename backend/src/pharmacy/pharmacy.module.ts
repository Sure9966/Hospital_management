import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Prescription } from './prescription.entity';
import { PharmacyService } from './pharmacy.service';
import { PharmacyController } from './pharmacy.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { Patient } from '../patients/patient.entity';
import { PatientsModule } from '../patients/patients.module';

@Module({
  imports: [TypeOrmModule.forFeature([Prescription, Patient]), NotificationsModule, PatientsModule],
  providers: [PharmacyService],
  controllers: [PharmacyController],
})
export class PharmacyModule {}
