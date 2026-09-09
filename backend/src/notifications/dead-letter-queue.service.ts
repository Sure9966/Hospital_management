import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationMetadata } from './notification.entity';

export interface DeadLetterItem {
  notification: Notification;
  reason: string;
  failedAt: Date;
  retryAttempts: number;
}

@Injectable()
export class DeadLetterQueueService {
  private readonly logger = new Logger(DeadLetterQueueService.name);
  private deadLetterQueue: Map<string, DeadLetterItem> = new Map();

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async addToDeadLetterQueue(
    notification: Notification,
    reason: string,
    retryAttempts: number
  ): Promise<void> {
    try {
      const deadLetterItem: DeadLetterItem = {
        notification,
        reason,
        failedAt: new Date(),
        retryAttempts,
      };

      this.deadLetterQueue.set(notification.id, deadLetterItem);
      
      // Update notification metadata
      const currentMetadata = notification.metadata || {};
      const updatedMetadata: NotificationMetadata = {
        ...currentMetadata,
        deadLetterReason: reason,
        deadLetterAt: new Date().toISOString(),
        retryAttempts,
      };
      
      await this.notificationRepo.update(notification.id, {
        metadata: updatedMetadata as any,
      });

      this.logger.error(
        `Notification ${notification.id} added to dead letter queue. Reason: ${reason}, Attempts: ${retryAttempts}`
      );
    } catch (error) {
      this.logger.error(`Failed to add notification ${notification.id} to dead letter queue:`, error);
    }
  }

  async removeFromDeadLetterQueue(notificationId: string): Promise<boolean> {
    const removed = this.deadLetterQueue.delete(notificationId);
    if (removed) {
      this.logger.log(`Notification ${notificationId} removed from dead letter queue`);
    }
    return removed;
  }

  getDeadLetterQueue(): DeadLetterItem[] {
    return Array.from(this.deadLetterQueue.values());
  }

  getDeadLetterItem(notificationId: string): DeadLetterItem | undefined {
    return this.deadLetterQueue.get(notificationId);
  }

  async retryFromDeadLetterQueue(notificationId: string): Promise<boolean> {
    const deadLetterItem = this.deadLetterQueue.get(notificationId);
    if (!deadLetterItem) {
      this.logger.warn(`Notification ${notificationId} not found in dead letter queue`);
      return false;
    }

    try {
      // Reset notification status
      const currentMetadata = deadLetterItem.notification.metadata || {};
      const updatedMetadata: NotificationMetadata = {
        ...currentMetadata,
        retriedFromDeadLetterAt: new Date().toISOString(),
      };
      
      await this.notificationRepo.update(notificationId, {
        deliveryStatus: 'pending' as any,
        retryCount: 0,
        lastError: null,
        metadata: updatedMetadata as any,
      });

      // Remove from dead letter queue
      this.deadLetterQueue.delete(notificationId);

      this.logger.log(`Notification ${notificationId} requeued from dead letter queue`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to retry notification ${notificationId} from dead letter queue:`, error);
      return false;
    }
  }

  async bulkRetryFromDeadLetterQueue(notificationIds: string[]): Promise<{ success: string[]; failed: string[] }> {
    const results = { success: [], failed: [] };

    for (const id of notificationIds) {
      const success = await this.retryFromDeadLetterQueue(id);
      if (success) {
        results.success.push(id);
      } else {
        results.failed.push(id);
      }
    }

    this.logger.log(
      `Bulk retry completed: ${results.success.length} succeeded, ${results.failed.length} failed`
    );

    return results;
  }

  async purgeDeadLetterQueue(notificationIds: string[]): Promise<number> {
    let purgedCount = 0;

    for (const id of notificationIds) {
      const removed = this.deadLetterQueue.delete(id);
      if (removed) {
        purgedCount++;
        
        // Permanently delete from database
        await this.notificationRepo.delete(id);
      }
    }

    this.logger.log(`Purged ${purgedCount} notifications from dead letter queue`);
    return purgedCount;
  }

  async getDeadLetterQueueStats(): Promise<{
    total: number;
    byReason: Record<string, number>;
    oldest: Date | null;
    newest: Date | null;
  }> {
    const items = this.getDeadLetterQueue();
    const byReason: Record<string, number> = {};

    let oldest: Date | null = null;
    let newest: Date | null = null;

    for (const item of items) {
      byReason[item.reason] = (byReason[item.reason] || 0) + 1;

      if (!oldest || item.failedAt < oldest) {
        oldest = item.failedAt;
      }
      if (!newest || item.failedAt > newest) {
        newest = item.failedAt;
      }
    }

    return {
      total: items.length,
      byReason,
      oldest,
      newest,
    };
  }

  async cleanupOldDeadLetterItems(daysToKeep: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const itemsToRemove: string[] = [];

    for (const [id, item] of this.deadLetterQueue.entries()) {
      if (item.failedAt < cutoffDate) {
        itemsToRemove.push(id);
      }
    }

    const purgedCount = await this.purgeDeadLetterQueue(itemsToRemove);
    this.logger.log(`Cleaned up ${purgedCount} old dead letter items older than ${daysToKeep} days`);

    return purgedCount;
  }

  private mergeMetadata(current: NotificationMetadata, updates: Partial<NotificationMetadata>): NotificationMetadata {
    return {
      ...current,
      ...updates,
    };
  }
}