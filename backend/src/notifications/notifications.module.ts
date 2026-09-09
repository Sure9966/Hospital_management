import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsController } from './notifications.controller';
import { NotificationQueueService } from './notification-queue.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { NotificationMonitoringService } from './notification-monitoring.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), ScheduleModule.forRoot()],
  providers: [NotificationsService, NotificationsGateway, NotificationQueueService, CircuitBreakerService, DeadLetterQueueService, NotificationMonitoringService],
  controllers: [NotificationsController],
  exports: [NotificationsService, NotificationQueueService, CircuitBreakerService, DeadLetterQueueService, NotificationMonitoringService, NotificationsGateway],
})
export class NotificationsModule {}
