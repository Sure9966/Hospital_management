import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ward, Bed, Admission } from './bed.entity';
import { Patient } from '../patients/patient.entity';
import { BedsService } from './beds.service';
import { BedsController } from './beds.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ward, Bed, Admission, Patient]),
    NotificationsModule,
  ],
  controllers: [BedsController],
  providers: [BedsService],
  exports: [BedsService],
})
export class BedsModule {}
