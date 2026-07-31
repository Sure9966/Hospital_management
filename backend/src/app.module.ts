import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PatientsModule } from './patients/patients.module';
import { ReceptionistModule } from './receptionist/receptionist.module';
import { NurseModule } from './nurse/nurse.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { ManagementModule } from './management/management.module';
import { NotificationsModule } from './notifications/notifications.module';
import { FilesModule } from './files/files.module';
import { BedsModule } from './beds/beds.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      database: process.env.DB_NAME || 'hospital_db',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true,
      logging: false,
    }),
    AuthModule,
    UsersModule,
    PatientsModule,
    ReceptionistModule,
    NurseModule,
    PharmacyModule,
    ManagementModule,
    NotificationsModule,
    FilesModule,
    BedsModule,
  ],
})
export class AppModule {}
