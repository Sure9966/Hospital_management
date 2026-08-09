import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private notificationsGateway: NotificationsGateway,
  ) { }

  async create(data: Partial<Notification>) {
    const notification = this.notificationRepo.create(data);
    const saved = await this.notificationRepo.save(notification);
    // Emit via Socket.IO
    this.notificationsGateway.emitNotification(saved);
    return saved;
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

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });

    return {
      success: true,
    };
  }

  async sendToUser(
    title: string,
    message: string,
    targetUserId: string,
    type: string = 'general',
    relatedId?: string,
    createdById?: string,
  ) {
    const saved = await this.create({ title, message, targetUserId, type, relatedId, createdById });
    this.notificationsGateway.emitNotification(saved);
    return saved;
  }

  async sendToRole(
    title: string,
    message: string,
    targetRole: string,
    type: string = 'general',
    relatedId?: string,
    createdById?: string,
  ) {
    const saved = await this.create({ title, message, targetRole, type, relatedId, createdById });
    // Auto dispatch email notifications to role employees
    this.sendEmail(`${targetRole}@hospital.com`, `🏥 MediCore Alert: ${title}`, message);
    return saved;
  }
}
