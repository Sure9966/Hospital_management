import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  Index,
} from 'typeorm';

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string; // e.g., 'ICU', 'General Male Ward', 'Emergency Care', 'Pediatric'

  @Column({ nullable: true })
  floor: string; // e.g., '1st Floor', '3rd Floor Wing B'

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Bed, (bed) => bed.ward)
  beds: Bed[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum BedStatus {
  VACANT = 'vacant',
  OCCUPIED = 'occupied',
  CLEANING = 'cleaning',
  MAINTENANCE = 'maintenance',
}

@Entity('beds')
@Index('IDX_BEDS_STATUS', ['status'])
@Index('IDX_BEDS_WARD_STATUS', ['wardId', 'status'])
export class Bed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  bedNumber: string; // e.g., 'BED-ICU-101', 'BED-GEN-204'

  @Column()
  roomNumber: string; // e.g., 'Room 101', 'Room 204'

  @Column({ type: 'enum', enum: BedStatus, default: BedStatus.VACANT })
  status: BedStatus;

  @Column({ nullable: true })
  wardId: string;

  @ManyToOne(() => Ward, (ward) => ward.beds, { onDelete: 'CASCADE', nullable: true })
  ward: Ward;

  @Column({ nullable: true })
  currentPatientId: string;

  @Column({ nullable: true })
  currentPatientName: string;

  @Column({ nullable: true })
  admissionDate: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

export enum AdmissionStatus {
  PENDING = 'pending',
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
  CANCELLED = 'cancelled',
}

@Entity('admissions')
@Index('IDX_ADMISSIONS_STATUS', ['status'])
@Index('IDX_ADMISSIONS_CREATED', ['createdAt'])
export class Admission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @Column()
  patientName: string;

  @Column({ nullable: true })
  doctorName: string;

  @Column({ nullable: true })
  diagnosis: string;

  @Column({ nullable: true })
  requestedWard: string;

  @Column({ nullable: true })
  allocatedBedId: string;

  @Column({ nullable: true })
  allocatedBedNumber: string;

  @Column({ nullable: true })
  allocatedWardName: string;

  @Column({ type: 'enum', enum: AdmissionStatus, default: AdmissionStatus.PENDING })
  status: AdmissionStatus;

  @Column({ nullable: true })
  preferredBedNumber: string;

  @Column({ nullable: true })
  admittedAt: Date;

  @Column({ nullable: true })
  dischargedAt: Date;

  @Column({ nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
