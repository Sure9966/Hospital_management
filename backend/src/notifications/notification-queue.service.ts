import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationMetadata } from './notification.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NotificationsGateway } from './notifications.gateway';
import { DeadLetterQueueService } from './dead-letter-queue.service';

interface QueueItem {
  notification: Notification;
  attempts: number;
  nextRetryAt: Date;
  lastError?: string;
}

@Injectable()
export class NotificationQueueService {
  private readonly logger = new Logger(NotificationQueueService.name);
  private queue: Map<string, QueueItem> = new Map();
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAYS = [1000, 5000, 15000]; // 1s, 5s, 15s

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private notificationsGateway: NotificationsGateway,
    private deadLetterQueueService: DeadLetterQueueService,
  ) {}

  async enqueue(notification: Notification): Promise<void> {
    try {
      this.logger.log(`Enqueueing notification ${notification.id}`);
      
      const queueItem: QueueItem = {
        notification,
        attempts: 0,
        nextRetryAt: new Date(),
      };

      this.queue.set(notification.id, queueItem);
      
      // Try immediate delivery
      await this.processNotification(notification.id);
    } catch (error) {
      this.logger.error(`Failed to enqueue notification ${notification.id}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.markAsFailed(notification.id, errorMessage);
    }
  }

  @Cron(CronExpression.EVERY_SECOND)
  async processQueue(): Promise<void> {
    try {
      const now = new Date();
      const itemsToProcess: string[] = [];

      for (const [id, item] of this.queue.entries()) {
        if (item.nextRetryAt <= now) {
          itemsToProcess.push(id);
        }
      }

      // Process in batches to avoid overwhelming the system
      const batchSize = 10;
      for (let i = 0; i < itemsToProcess.length; i += batchSize) {
        const batch = itemsToProcess.slice(i, i + batchSize);
        await Promise.allSettled(
          batch.map(id => this.processNotification(id))
        );
      }
    } catch (error) {
      this.logger.error('Error processing notification queue:', error);
    }
  }

  private async processNotification(notificationId: string): Promise<void> {
    const queueItem = this.queue.get(notificationId);
    if (!queueItem) return;

    const { notification, attempts } = queueItem;

    try {
      this.logger.log(`Processing notification ${notificationId} (attempt ${attempts + 1})`);
      
      // Emit via Socket.IO
      this.notificationsGateway.emitNotification(notification);
      
      // Update status to delivered
      await this.notificationRepo.update(notificationId, {
        deliveryStatus: 'delivered' as any,
        retryCount: attempts,
      });

      // Remove from queue
      this.queue.delete(notificationId);
      
      this.logger.log(`Successfully delivered notification ${notificationId}`);
    } catch (error) {
      this.logger.error(`Failed to deliver notification ${notificationId}:`, error);
      
      const newAttempts = attempts + 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (newAttempts >= this.MAX_RETRIES) {
        // Max retries reached, add to dead letter queue
        await this.deadLetterQueueService.addToDeadLetterQueue(
          notification,
          errorMessage,
          newAttempts
        );
        await this.markAsFailed(notificationId, errorMessage);
        this.queue.delete(notificationId);
      } else {
        // Schedule retry
        const delay = this.RETRY_DELAYS[Math.min(newAttempts - 1, this.RETRY_DELAYS.length - 1)];
        const nextRetryAt = new Date(Date.now() + delay);
        
        this.queue.set(notificationId, {
          ...queueItem,
          attempts: newAttempts,
          nextRetryAt,
          lastError: errorMessage,
        });

        // Update status to retrying
        await this.notificationRepo.update(notificationId, {
          deliveryStatus: 'retrying' as any,
          retryCount: newAttempts,
          lastError: errorMessage,
        });

        this.logger.log(`Scheduled retry for notification ${notificationId} at ${nextRetryAt}`);
      }
    }
  }

  private async markAsFailed(notificationId: string, error: string): Promise<void> {
    try {
      await this.notificationRepo.update(notificationId, {
        deliveryStatus: 'failed' as any,
        lastError: error,
      });
      this.logger.error(`Notification ${notificationId} marked as failed: ${error}`);
    } catch (updateError) {
      this.logger.error(`Failed to mark notification ${notificationId} as failed:`, updateError);
    }
  }

  async getQueueStatus(): Promise<{
    pending: number;
    retrying: number;
    failed: number;
  }> {
    const pending = Array.from(this.queue.values()).filter(
      item => item.attempts === 0
    ).length;
    
    const retrying = Array.from(this.queue.values()).filter(
      item => item.attempts > 0
    ).length;

    const failed = await this.notificationRepo.count({
      where: { deliveryStatus: 'failed' as any }
    });

    return { pending, retrying, failed };
  }

  async retryFailedNotification(notificationId: string): Promise<boolean> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId }
    });

    if (!notification) {
      this.logger.warn(`Notification ${notificationId} not found for retry`);
      return false;
    }

    // Reset status and re-enqueue
    await this.notificationRepo.update(notificationId, {
      deliveryStatus: 'pending',
      retryCount: 0,
      lastError: null,
    });

    await this.enqueue(notification);
    return true;
  }

  async cleanupOldNotifications(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    try {
      const result = await this.notificationRepo
        .createQueryBuilder()
        .delete()
        .from(Notification)
        .where('createdAt < :cutoffDate', { cutoffDate })
        .andWhere('deliveryStatus = :delivered', { delivered: 'delivered' as any })
        .execute();

      this.logger.log(`Cleaned up ${result.affected || 0} old delivered notifications`);
    } catch (error) {
      this.logger.error('Failed to cleanup old notifications:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async dailyCleanup(): Promise<void> {
    await this.cleanupOldNotifications(30);
  }
}