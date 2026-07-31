import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PrescriptionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DISPENSED = 'dispensed',
  CANCELLED = 'cancelled',
}

export enum BillingStatus {
  UNBILLED = 'unbilled',
  BILLED = 'billed',
  PAID = 'paid',
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  prescriptionId: string;

  @Column({ nullable: true, unique: true })
  invoiceNumber: string | null;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column()
  doctorName: string;

  @Column('jsonb')
  medicines: {
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    instructions: string;

    // Price for one tablet/unit
    unitCost: number;

    // quantity × unitCost
    lineTotal: number;
  }[];

  @Column({ nullable: true })
  diagnosis: string;

  @Column({
    type: 'enum',
    enum: PrescriptionStatus,
    default: PrescriptionStatus.PENDING,
  })
  status: PrescriptionStatus;

  @Column({ nullable: true })
  dispensedBy: string;

  @Column({ type: 'timestamptz', nullable: true })
  dispensedAt: Date;

  @Column('text', { nullable: true })
  notes: string;

  @Column({
    type: 'enum',
    enum: BillingStatus,
    default: BillingStatus.UNBILLED,
  })
  billingStatus: BillingStatus;

  @Column({ default: true })
  isEncrypted: boolean;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  subtotal: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  discountAmount: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  taxAmount: number;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    default: 0,
  })
  totalCost: number;

  // Object-storage key, not a public URL
  @Column({ nullable: true })
  invoicePdfKey: string | null;

  @Column({ nullable: true })
  invoicePdfName: string | null;

  @Column({ nullable: true })
  invoicePdfMimeType: string | null;

  @Column({ type: 'int', nullable: true })
  invoicePdfSize: number | null;

  @Column({ nullable: true })
  invoicePdfHash: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  invoiceGeneratedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}