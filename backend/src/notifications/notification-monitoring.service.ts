import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, DeliveryStatus } from './notification.entity';

export interface NotificationMetrics {
  totalCreated: number;
  totalDelivered: number;
  totalFailed: number;
  totalPending: number;
  totalRetrying: number;
  deliveryRate: number;
  averageDeliveryTime: number;
  failureRate: number;
  byType: Record<string, number>;
  byTarget: Record<string, number>;
}

@Injectable()
export class NotificationMonitoringService {
  private readonly logger = new Logger(NotificationMonitoringService.name);
  private metricsHistory: Map<string, NotificationMetrics> = new Map();

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
  ) {}

  async getCurrentMetrics(): Promise<NotificationMetrics> {
    try {
      const totalCreated = await this.notificationRepo.count();
      const totalDelivered = await this.notificationRepo.count({
        where: { deliveryStatus: 'delivered' as DeliveryStatus }
      });
      const totalFailed = await this.notificationRepo.count({
        where: { deliveryStatus: 'failed' as DeliveryStatus }
      });
      const totalPending = await this.notificationRepo.count({
        where: { deliveryStatus: 'pending' as DeliveryStatus }
      });
      const totalRetrying = await this.notificationRepo.count({
        where: { deliveryStatus: 'retrying' as DeliveryStatus }
      });

      const totalAttempted = totalDelivered + totalFailed;
      const deliveryRate = totalAttempted > 0 ? (totalDelivered / totalAttempted) * 100 : 0;
      const failureRate = totalAttempted > 0 ? (totalFailed / totalAttempted) * 100 : 0;

      // Calculate average delivery time
      const deliveredNotifications = await this.notificationRepo.find({
        where: { deliveryStatus: 'delivered' as DeliveryStatus },
        take: 100,
        order: { createdAt: 'DESC' }
      });

      let averageDeliveryTime = 0;
      if (deliveredNotifications.length > 0) {
        const deliveryTimes = deliveredNotifications.map(n => {
          const createdAt = new Date(n.createdAt).getTime();
          const updatedAt = new Date(n.updatedAt).getTime();
          return updatedAt - createdAt;
        });
        averageDeliveryTime = deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length;
      }

      // Get breakdown by type
      const byType: Record<string, number> = {};
      const typeResults = await this.notificationRepo
        .createQueryBuilder('n')
        .select('n.type', 'type')
        .addSelect('COUNT(*)', 'count')
        .groupBy('n.type')
        .getRawMany();
      
      for (const result of typeResults) {
        byType[result.type || 'general'] = parseInt(result.count, 10);
      }

      // Get breakdown by target
      const byTarget: Record<string, number> = {};
      const targetResults = await this.notificationRepo
        .createQueryBuilder('n')
        .select('n.targetRole', 'targetRole')
        .addSelect('COUNT(*)', 'count')
        .where('n.targetRole IS NOT NULL')
        .groupBy('n.targetRole')
        .getRawMany();
      
      for (const result of targetResults) {
        byTarget[result.targetRole] = parseInt(result.count, 10);
      }

      const metrics: NotificationMetrics = {
        totalCreated,
        totalDelivered,
        totalFailed,
        totalPending,
        totalRetrying,
        deliveryRate,
        averageDeliveryTime,
        failureRate,
        byType,
        byTarget,
      };

      // Store in history
      const timestamp = new Date().toISOString();
      this.metricsHistory.set(timestamp, metrics);

      // Keep only last 100 data points
      if (this.metricsHistory.size > 100) {
        const oldestKey = Array.from(this.metricsHistory.keys())[0];
        this.metricsHistory.delete(oldestKey);
      }

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get current metrics:', error);
      throw error;
    }
  }

  async getMetricsHistory(hours: number = 24): Promise<NotificationMetrics[]> {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    const history: NotificationMetrics[] = [];
    for (const [timestamp, metrics] of this.metricsHistory.entries()) {
      const metricTime = new Date(timestamp);
      if (metricTime >= cutoffTime) {
        history.push(metrics);
      }
    }

    return history;
  }

  async getFailedNotifications(limit: number = 50): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { deliveryStatus: 'failed' as DeliveryStatus },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRetryableNotifications(limit: number = 50): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { deliveryStatus: 'retrying' as DeliveryStatus },
      order: { updatedAt: 'ASC' },
      take: limit,
    });
  }

  async getDeliveryStatsForUser(userId: string): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  }> {
    const total = await this.notificationRepo.count({
      where: { targetUserId: userId } as any
    });
    const delivered = await this.notificationRepo.count({
      where: { targetUserId: userId, deliveryStatus: 'delivered' as DeliveryStatus }
    });
    const failed = await this.notificationRepo.count({
      where: { targetUserId: userId, deliveryStatus: 'failed' as DeliveryStatus }
    });
    const pending = await this.notificationRepo.count({
      where: { targetUserId: userId, deliveryStatus: 'pending' as DeliveryStatus }
    });

    return { total, delivered, failed, pending };
  }

  async getDeliveryStatsForRole(role: string): Promise<{
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  }> {
    const total = await this.notificationRepo.count({
      where: { targetRole: role } as any
    });
    const delivered = await this.notificationRepo.count({
      where: { targetRole: role, deliveryStatus: 'delivered' as DeliveryStatus }
    });
    const failed = await this.notificationRepo.count({
      where: { targetRole: role, deliveryStatus: 'failed' as DeliveryStatus }
    });
    const pending = await this.notificationRepo.count({
      where: { targetRole: role, deliveryStatus: 'pending' as DeliveryStatus }
    });

    return { total, delivered, failed, pending };
  }

  async logMetricEvent(event: string, data: Record<string, any>): Promise<void> {
    this.logger.log(`[METRIC] ${event}: ${JSON.stringify(data)}`);
    
    // In production, you would send this to a monitoring service
    // like Datadog, New Relic, or CloudWatch
  }

  async generateHealthReport(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    metrics: NotificationMetrics;
    issues: string[];
    recommendations: string[];
  }> {
    const metrics = await this.getCurrentMetrics();
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check delivery rate
    if (metrics.deliveryRate < 95) {
      issues.push(`Low delivery rate: ${metrics.deliveryRate.toFixed(2)}%`);
      recommendations.push('Investigate notification delivery failures');
    }

    // Check failure rate
    if (metrics.failureRate > 5) {
      issues.push(`High failure rate: ${metrics.failureRate.toFixed(2)}%`);
      recommendations.push('Review SMTP configuration and network connectivity');
    }

    // Check pending notifications
    if (metrics.totalPending > 100) {
      issues.push(`High pending queue: ${metrics.totalPending} notifications`);
      recommendations.push('Check notification queue processor health');
    }

    // Check average delivery time
    if (metrics.averageDeliveryTime > 5000) {
      issues.push(`Slow delivery time: ${(metrics.averageDeliveryTime / 1000).toFixed(2)}s average`);
      recommendations.push('Optimize notification processing pipeline');
    }

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (issues.length >= 3 || metrics.failureRate > 20) {
      status = 'unhealthy';
    } else if (issues.length > 0) {
      status = 'degraded';
    }

    return {
      status,
      metrics,
      issues,
      recommendations,
    };
  }
}