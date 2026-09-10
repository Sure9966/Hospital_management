import { Controller, Get, Patch, Param, Query, UseGuards, Post, Delete, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationQueueService } from './notification-queue.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { DeadLetterQueueService } from './dead-letter-queue.service';
import { NotificationMonitoringService } from './notification-monitoring.service';
import { Notification, DeliveryStatus } from './notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly deadLetterQueueService: DeadLetterQueueService,
    private readonly notificationMonitoringService: NotificationMonitoringService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.notificationsService.findAll(user.id, user.role);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string) {
    return this.notificationsService.markAsRead(id);
  }

  @Get('queue/status')
  getQueueStatus() {
    return this.notificationQueueService.getQueueStatus();
  }

  @Post('queue/:id/retry')
  retryNotification(@Param('id') id: string) {
    return this.notificationQueueService.retryFailedNotification(id);
  }

  @Get('circuit-breaker/:name/status')
  getCircuitStatus(@Param('name') name: string) {
    return this.circuitBreakerService.getCircuitStats(name);
  }

  @Post('circuit-breaker/:name/reset')
  resetCircuit(@Param('name') name: string) {
    this.circuitBreakerService.resetCircuit(name);
    return { success: true };
  }

  @Get('dead-letter-queue')
  getDeadLetterQueue() {
    return this.deadLetterQueueService.getDeadLetterQueue();
  }

  @Get('dead-letter-queue/stats')
  getDeadLetterQueueStats() {
    return this.deadLetterQueueService.getDeadLetterQueueStats();
  }

  @Post('dead-letter-queue/:id/retry')
  retryDeadLetter(@Param('id') id: string) {
    return this.deadLetterQueueService.retryFromDeadLetterQueue(id);
  }

  @Post('dead-letter-queue/bulk-retry')
  bulkRetryDeadLetter(@Body('ids') ids: string[]) {
    return this.deadLetterQueueService.bulkRetryFromDeadLetterQueue(ids);
  }

  @Delete('dead-letter-queue/purge')
  purgeDeadLetter(@Body('ids') ids: string[]) {
    return this.deadLetterQueueService.purgeDeadLetterQueue(ids);
  }

  @Get('monitoring/metrics')
  getMetrics() {
    return this.notificationMonitoringService.getCurrentMetrics();
  }

  @Get('monitoring/metrics/history')
  getMetricsHistory(@Query('hours') hours?: string) {
    return this.notificationMonitoringService.getMetricsHistory(
      hours ? parseInt(hours, 10) : 24
    );
  }

  @Get('monitoring/failed')
  getFailedNotifications(@Query('limit') limit?: string) {
    return this.notificationMonitoringService.getFailedNotifications(
      limit ? parseInt(limit, 10) : 50
    );
  }

  @Get('monitoring/health')
  getHealthReport() {
    return this.notificationMonitoringService.generateHealthReport();
  }

  @Get('monitoring/user/:userId')
  getUserStats(@Param('userId') userId: string) {
    return this.notificationMonitoringService.getDeliveryStatsForUser(userId);
  }

  @Get('monitoring/role/:role')
  getRoleStats(@Param('role') role: string) {
    return this.notificationMonitoringService.getDeliveryStatsForRole(role);
  }

  @Get('debug/connected-clients')
  getConnectedClients() {
    return this.notificationsGateway.getAllConnectedClients();
  }

  @Get('debug/user-connection/:userId')
  getUserConnection(@Param('userId') userId: string) {
    return {
      connected: this.notificationsGateway.isUserConnected(userId),
      connectedUsersByRole: this.notificationsGateway.getConnectedUsersByRole('management'),
    };
  }

  // Test endpoint for patient registration notifications
  @Post('test/patient-registration')
  async testPatientRegistration(@Body() data: { 
    patientName: string; 
    patientId: string; 
    tokenNumber: string;
    targetRole?: string;
    targetUserId?: string;
  }) {
    const idempotencyKey = `test-patient-registration-${Date.now()}`;
    
    if (data.targetUserId) {
      return this.notificationsService.sendToUser(
        'Test: New Patient Assigned',
        `Test notification: Patient ${data.patientName} (${data.patientId}) assigned to you. Token: ${data.tokenNumber}`,
        data.targetUserId,
        'registration',
        undefined,
        undefined,
        idempotencyKey,
      );
    } else {
      return this.notificationsService.sendToRole(
        'Test: New Patient Registered',
        `Test notification: Patient ${data.patientName} (${data.patientId}) - OPD Token: ${data.tokenNumber}`,
        data.targetRole || 'management',
        'registration',
        undefined,
        undefined,
        idempotencyKey,
      );
    }
  }
}