import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export type DeliveryStatus = 'pending' | 'delivered' | 'failed' | 'retrying';

export interface NotificationMetadata {
  idempotencyKey?: string;
  deadLetterReason?: string;
  deadLetterAt?: string;
  retryAttempts?: number;
  retriedFromDeadLetterAt?: string;
  [key: string]: any;
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  message: string;

  @Column({ nullable: true })
  type: string; // 'appointment', 'medication', 'emergency', 'lab', 'general'

  @Column({ nullable: true })
  targetRole: string; // who should see this notification

  @Column({ nullable: true })
  targetUserId: string;

  @Column({ default: false })
  isRead: boolean;

  @Column({ nullable: true })
  relatedId: string; // patient id, appointment id etc

  @Column({ nullable: true })
  relatedType: string;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ nullable: true })
  createdById: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({
    type: 'enum',
    enum: ['pending', 'delivered', 'failed', 'retrying'],
    default: 'pending'
  })
  deliveryStatus: DeliveryStatus;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ nullable: true })
  lastError: string;

  @Column({
    type: 'json',
    nullable: true,
  })
  metadata: NotificationMetadata;
}
