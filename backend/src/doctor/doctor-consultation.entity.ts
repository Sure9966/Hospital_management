import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ConsultationStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FOLLOW_UP_REQUIRED = 'follow_up_required',
  DISCHARGED = 'discharged',
}

@Entity('doctor_consultations')
export class DoctorConsultation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column({ nullable: true })
  doctorName: string;

  @Column({ nullable: true })
  doctorId: string;

  @Column('text', { nullable: true })
  consultationNotes: string;

  @Column('text', { nullable: true })
  diagnosis: string;

  @Column('simple-array', { nullable: true })
  testOrders: string[];

  @Column({ nullable: true })
  followUpDate: string;

  @Column('text', { nullable: true })
  followUpInstructions: string;

  @Column({
    type: 'enum',
    enum: ConsultationStatus,
    default: ConsultationStatus.IN_PROGRESS,
  })
  status: ConsultationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
