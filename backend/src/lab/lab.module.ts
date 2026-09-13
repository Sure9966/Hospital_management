import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabTest } from './lab-test.entity';
import { Patient } from '../patients/patient.entity';
import { LabService } from './lab.service';
import { LabController } from './lab.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LabTest, Patient]),
    NotificationsModule,
  ],
  providers: [LabService],
  controllers: [LabController],
  exports: [LabService],
})
export class LabModule {}
