import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Appointment } from './appointment.entity';
import { Patient } from '../patients/patient.entity';
import { ReceptionistService } from './receptionist.service';
import { ReceptionistController } from './receptionist.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Appointment, Patient]), NotificationsModule],
  providers: [ReceptionistService],
  controllers: [ReceptionistController],
  exports: [ReceptionistService],
})
export class ReceptionistModule {}
