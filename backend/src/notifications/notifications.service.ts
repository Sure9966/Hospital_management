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
  ) {}

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

    if (role) {
      query.andWhere('(n.targetRole = :role OR n.targetRole IS NULL)', { role });
    }
    if (userId) {
      query.andWhere('(n.targetUserId = :userId OR n.targetUserId IS NULL)', { userId });
    }

    return query.take(50).getMany();
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

  async sendToRole(
    title: string,
    message: string,
    targetRole: string,
    type: string = 'general',
    relatedId?: string,
    createdById?: string,
  ) {
    return this.create({ title, message, targetRole, type, relatedId, createdById });
  }
}
