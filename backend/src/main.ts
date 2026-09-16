import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useGlobalFilters(new AllExceptionsFilter());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin or any local dev origins
      if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1') || origin === process.env.FRONTEND_URL) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.setGlobalPrefix('api');

  // Serve uploaded files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads',
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🏥 Hospital Management System Backend running on port ${port}`);
  console.log(`📡 WebSocket server ready`);
}
bootstrap();
