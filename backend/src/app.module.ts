import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { DoctorModule } from './doctor/doctor.module';
import { LabModule } from './lab/lab.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // ThrottlerModule.forRoot([
    //   {
    //     name: 'default',
    //     ttl: 60000,
    //     limit: 100,
    //   },
    // ]),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          name: 'default',
          ttl: parseInt(config.get<string>('THROTTLE_TTL_MS', '60000'), 10),
          limit: parseInt(config.get<string>('THROTTLE_LIMIT', '100'), 10),
        },
      ],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const databaseUrl = configService.get<string>('DATABASE_URL');
        const dbSsl = configService.get<string>('DB_SSL');

        const useSsl =
          dbSsl === 'true' ||
          (Boolean(databaseUrl) && dbSsl !== 'false') ||
          configService.get<string>('NODE_ENV') === 'production';

        const sslConfig = useSsl
          ? {
            rejectUnauthorized:
              configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') === 'true',
          }
          : false;

        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: false,
            ssl: sslConfig,
            extra: {
              max: 20,
              min: 0,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 30000,
              keepAlive: true,
            },
          };
        }

        return {
          type: 'postgres',
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
          username: configService.get<string>('DB_USERNAME', 'postgres'),
          password: configService.get<string>('DB_PASSWORD', 'postgres'),
          database: configService.get<string>('DB_NAME', 'hospital_db'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: true,
          logging: false,
          ssl: sslConfig,
          extra: {
            max: 20,
            min: 0,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 30000,
            keepAlive: true,
          },
        };
      },
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
    DoctorModule,
    LabModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
