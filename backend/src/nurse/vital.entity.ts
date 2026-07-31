import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum VitalStatus {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

@Entity('vitals')
export class Vital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column({ nullable: true })
  temperature: string;

  @Column({ nullable: true })
  bloodPressure: string;

  @Column({ nullable: true })
  heartRate: string;

  @Column({ nullable: true })
  oxygenSaturation: string;

  @Column({ nullable: true })
  respiratoryRate: string;

  @Column({ nullable: true })
  weight: string;

  @Column({ nullable: true })
  height: string;

  @Column({ nullable: true })
  bloodSugar: string;

  @Column({ nullable: true })
  pain: string;

  @Column('text', { nullable: true })
  notes: string;

  @Column('text', { nullable: true })
  triageNotes: string;

  @Column({ nullable: true })
  triagePriority: string; // e.g. Urgent, High, Routine, Emergency

  @Column({ type: 'enum', enum: VitalStatus, default: VitalStatus.NORMAL })
  status: VitalStatus;

  @Column({ nullable: true })
  recordedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
