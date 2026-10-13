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
          ? { rejectUnauthorized: false }
          : false;

        const extraPoolConfig = {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
          statement_timeout: 30000,
          query_timeout: 30000,
        };

        console.log('🔌 DB config:', {
          mode: databaseUrl ? 'DATABASE_URL' : 'individual',
          ssl: useSsl,
          host: databaseUrl
            ? new URL(databaseUrl).hostname
            : configService.get('DB_HOST'),
        });

        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: true,
            logging: false,
            ssl: sslConfig,
            retryAttempts: 3,
            retryDelay: 2000,
            extra: extraPoolConfig,
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
          retryAttempts: 3,
          retryDelay: 2000,
          extra: extraPoolConfig,
        };
      },
    }),
    // TypeOrmModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (configService: ConfigService) => {
    //     const databaseUrl = configService.get<string>('DATABASE_URL');
    //     const dbSsl = configService.get<string>('DB_SSL');

    //     const useSsl =
    //       dbSsl === 'true' ||
    //       (Boolean(databaseUrl) && dbSsl !== 'false') ||
    //       configService.get<string>('NODE_ENV') === 'production';

    //     const sslConfig = useSsl
    //       ? {
    //           rejectUnauthorized:
    //             configService.get<string>('DB_SSL_REJECT_UNAUTHORIZED') === 'true',
    //         }
    //       : false;

    //     const extraPoolConfig = {
    //       max: 20,
    //       min: 2,
    //       idleTimeoutMillis: 60000,
    //       connectionTimeoutMillis: 60000,
    //       keepAlive: true,
    //       keepAliveInitialDelayMillis: 5000,
    //       statement_timeout: 60000,
    //       query_timeout: 60000,
    //     };

    //     if (databaseUrl) {
    //       return {
    //         type: 'postgres',
    //         url: databaseUrl,
    //         entities: [__dirname + '/**/*.entity{.ts,.js}'],
    //         synchronize: true,
    //         logging: false,
    //         ssl: sslConfig,
    //         retryAttempts: 10,
    //         retryDelay: 3000,
    //         extra: extraPoolConfig,
    //       };
    //     }

    //     return {
    //       type: 'postgres',
    //       host: configService.get<string>('DB_HOST', 'localhost'),
    //       port: parseInt(configService.get<string>('DB_PORT', '5432'), 10),
    //       username: configService.get<string>('DB_USERNAME', 'postgres'),
    //       password: configService.get<string>('DB_PASSWORD', 'postgres'),
    //       database: configService.get<string>('DB_NAME', 'hospital_db'),
    //       entities: [__dirname + '/**/*.entity{.ts,.js}'],
    //       synchronize: true,
    //       logging: false,
    //       ssl: sslConfig,
    //       retryAttempts: 10,
    //       retryDelay: 3000,
    //       extra: extraPoolConfig,
    //     };
    //   },
    // }),
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
