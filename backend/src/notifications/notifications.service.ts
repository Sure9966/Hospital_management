import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationMetadata } from './notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationQueueService } from './notification-queue.service';
import { CircuitBreakerService } from './circuit-breaker.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private notificationsGateway: NotificationsGateway,
    private notificationQueueService: NotificationQueueService,
    private circuitBreakerService: CircuitBreakerService,
  ) { }

  async create(data: Partial<Notification>) {
    try {
      // Check for idempotency - if notification with same key exists, return it
      if (data.metadata?.idempotencyKey) {
        const recentNotifications = await this.notificationRepo
          .createQueryBuilder('n')
          .where('n.type = :type', { type: data.type })
          .orderBy('n.createdAt', 'DESC')
          .take(10)
          .getMany();

        const existing = recentNotifications.find(
          n => n.metadata?.idempotencyKey === data.metadata?.idempotencyKey
        );
        
        if (existing) {
          this.logger.log(`Returning existing notification for idempotency key: ${data.metadata.idempotencyKey}`);
          return existing;
        }
      }

      const notification = this.notificationRepo.create({
        ...data,
        deliveryStatus: 'pending' as any,
        retryCount: 0,
      });
      const saved = await this.notificationRepo.save(notification);
      
      // Enqueue for reliable delivery
      await this.notificationQueueService.enqueue(saved);
      
      return saved;
    } catch (error) {
      this.logger.error('Failed to create notification:', error);
      throw error;
    }
  }

  async findAll(userId?: string, role?: string) {
    const query = this.notificationRepo.createQueryBuilder('n')
      .where('n.isRead = :isRead', { isRead: false })
      .orderBy('n.createdAt', 'DESC');

    // if (role) {
    //   query.andWhere('(n.targetRole = :role OR n.targetRole IS NULL)', { role });
    // }
    // if (userId) {
    //   query.andWhere('(n.targetUserId = :userId OR n.targetUserId IS NULL)', { userId });
    // }

    if (userId && role) {
      query.andWhere(
        `(
          n.targetUserId = :userId
          OR (
            n.targetUserId IS NULL
            AND n.targetRole = :role
          )
          OR (
            n.targetUserId IS NULL
            AND n.targetRole IS NULL
          )
        )`,
        { userId, role },
      );
    }

    return query.take(50).getMany();
    // return query.take(50).getMany();
  }

  async markAsRead(id: string) {
    await this.notificationRepo.update(id, { isRead: true });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.notificationRepo
      .createQueryBuilder()
      .update(Notification)
      .set({ isRead: true })
      .where('targetUserId = :userId OR targetUserId IS NULL', { userId })
      .execute();
    return { success: true };
  }

  // async sendEmail(to: string, subject: string, text: string) {
  //   // Simulated SMTP transport log with production-grade email dispatch logic
  //   console.log(`📧 [EMAIL SENT] To: ${to} | Subject: "${subject}" | Content: "${text}"`);
  //   return { success: true, message: `Email delivered to ${to}` };
  // }
  async sendEmail(
    to: string,
    subject: string,
    text: string,
  ) {
    const nodemailer = require('nodemailer');

    this.logger.log(`Attempting to send email to: ${to}`);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      debug: true,
      logger: true,
    });

    try {
      await transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      this.logger.error('SMTP connection verification failed:', error);
      throw error;
    }

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
      });
      this.logger.log(`Email sent successfully to ${to}. Message ID: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }

  private async sendEmailSafe(to: string, subject: string, text: string): Promise<void> {
    // Use circuit breaker to protect against SMTP failures
    this.circuitBreakerService.execute(
      'smtp',
      () => this.sendEmail(to, subject, text),
      () => {
        // Fallback: just log the failure
        this.logger.warn(`SMTP circuit breaker triggered - email not sent to ${to}`);
        return { success: false, messageId: null };
      }
    ).catch(error => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Email sending failed (non-blocking): ${errorMessage}`);
    });
  }

  async sendToUser(
    title: string,
    message: string,
    targetUserId: string,
    type: string = 'general',
    relatedId?: string,
    createdById?: string,
    idempotencyKey?: string,
  ) {
    const metadata: NotificationMetadata = idempotencyKey ? { idempotencyKey } : {};
    const saved = await this.create({ 
      title, 
      message, 
      targetUserId, 
      type, 
      relatedId, 
      createdById,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
    return saved;
  }

  async sendToRole(
    title: string,
    message: string,
    targetRole: string,
    type: string = 'general',
    relatedId?: string,
    createdById?: string,
    idempotencyKey?: string,
  ) {
    const metadata: NotificationMetadata = idempotencyKey ? { idempotencyKey } : {};
    const saved = await this.create({ 
      title, 
      message, 
      targetRole, 
      type, 
      relatedId, 
      createdById,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
    // Auto dispatch email notifications to role employees (non-blocking)
    this.sendEmailSafe(`${targetRole}@hospital.com`, `🏥 MediCore Alert: ${title}`, message);
    return saved;
  }
}
