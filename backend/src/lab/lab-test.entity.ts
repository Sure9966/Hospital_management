import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum LabTestStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum LabTestPriority {
  NORMAL = 'NORMAL',
  URGENT = 'URGENT',
}

@Entity('lab_tests')
export class LabTest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string; // e.g. NMH26000000

  @Column()
  patientName: string;

  @Column({ nullable: true })
  doctorId: string;

  @Column({ nullable: true })
  doctorName: string;

  @Column()
  testName: string; // e.g. Complete Blood Count (CBC), Lipid Profile, Liver Function Test (LFT)

  @Column({ default: 'Pathology' })
  category: string; // Pathology, Radiology, Microbiology, Biochemistry

  @Column({ nullable: true })
  sampleType: string; // Blood, Urine, Swab, Tissue

  @Column({
    type: 'enum',
    enum: LabTestPriority,
    default: LabTestPriority.NORMAL,
  })
  priority: LabTestPriority;

  @Column({
    type: 'enum',
    enum: LabTestStatus,
    default: LabTestStatus.PENDING,
  })
  status: LabTestStatus;

  @Column('text', { nullable: true })
  resultSummary: string; // e.g., "Hemoglobin: 13.5 g/dL (Normal), WBC: 7,500 /mcL"

  @Column('text', { nullable: true })
  testValues: string; // Detailed JSON string of test metrics & reference ranges

  @Column({ nullable: true })
  reportUrl: string; // URL link to uploaded PDF/Image report

  @Column('text', { nullable: true })
  notes: string;

  @Column({ nullable: true })
  orderedBy: string;

  @Column({ nullable: true })
  completedBy: string;

  @Column({ nullable: true })
  patientStatus: string; // e.g. 'admitted', 'discharged', 'registered'

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
