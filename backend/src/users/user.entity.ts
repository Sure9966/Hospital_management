import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  RECEPTIONIST = 'receptionist',
  NURSE = 'nurse',
  DOCTOR = 'doctor',
  PHARMACIST = 'pharmacist',
  MANAGEMENT = 'management',
  PATIENT = 'patient',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.RECEPTIONIST })
  role: UserRole;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  profileImage: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: true })
  isApproved: boolean;

  @Column({ type: 'simple-array', nullable: true })
  permissions: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
