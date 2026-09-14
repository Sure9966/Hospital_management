import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PatientStatus {
  REGISTERED = 'registered',
  ADMITTED = 'admitted',
  UNDER_TREATMENT = 'under_treatment',
  DISCHARGED = 'discharged',
}

export enum BloodGroup {
  A_POS = 'A+', A_NEG = 'A-',
  B_POS = 'B+', B_NEG = 'B-',
  O_POS = 'O+', O_NEG = 'O-',
  AB_POS = 'AB+', AB_NEG = 'AB-',
}

@Entity('patients')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  patientId: string; // e.g. NMH26000000

  @Column({ nullable: true, unique: true })
  opdTokenNumber: string; // e.g. TK-2026-0042

  @Column({ nullable: true, unique: true })
  admissionNumber: string; // e.g. IP26000000

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  dateOfBirth: string;

  @Column()
  gender: string;

  @Column({ nullable: true })
  bloodGroup: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column('text', { nullable: true })
  address: string;

  @Column({ nullable: true })
  emergencyContact: string;

  @Column({ nullable: true })
  emergencyPhone: string;

  @Column({ nullable: true })
  insuranceNumber: string;

  @Column({ nullable: true })
  insuranceProvider: string;

  @Column({ nullable: true })
  diagnosis: string;

  @Column({ nullable: true })
  ward: string;

  @Column({ nullable: true })
  bedNumber: string;

  @Column({ nullable: true })
  assignedDoctorId: string;

  @Column({ nullable: true })
  assignedDoctorName: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  admittedBy: string; // doctor name

  @Column({ nullable: true })
  assignedNurse: string;

  @Column({ default: false })
  isEmergency: boolean;

  @Column({ default: true })
  isBasicRegistrationComplete: boolean;

  @Column({ nullable: true })
  emergencySeverity: string; // e.g., 'critical', 'urgent', 'standard'

  @Column({
    type: 'enum',
    enum: PatientStatus,
    default: PatientStatus.REGISTERED,
  })
  status: PatientStatus;

  @Column('text', { nullable: true })
  notes: string;

  @Column({ nullable: true })
  profileImage: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
