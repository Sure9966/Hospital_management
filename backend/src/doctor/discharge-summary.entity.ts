import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
} from 'typeorm';

@Entity('discharge_summaries')
export class DischargeSummary {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    patientId: string;

    @Column()
    patientName: string;

    @Column({ nullable: true })
    doctorId: string;

    @Column({ nullable: true })
    doctorName: string;

    @Column({ nullable: true })
    diagnosis: string;

    @Column()
    dischargeDate: string;

    @Column({ default: 'Stable' })
    conditionAtDischarge: string;

    @Column('text')
    dischargeSummary: string;

    @Column('text', { nullable: true })
    medications: string;

    @Column({ nullable: true })
    followUpDate: string;

    @Column('text', { nullable: true })
    followUpInstructions: string;

    @Column('text', { nullable: true })
    dietInstructions: string;

    @Column('text', { nullable: true })
    activityInstructions: string;

    // PDF metadata fields
    @Column({ nullable: true })
    dischargePdfKey: string;

    @Column({ nullable: true })
    dischargePdfName: string;

    @Column({ nullable: true })
    dischargePdfMimeType: string;

    @Column({ nullable: true })
    dischargePdfSize: number;

    @Column({ nullable: true })
    dischargePdfHash: string;

    @Column({ nullable: true })
    dischargeGeneratedAt: Date;

    @CreateDateColumn()
    createdAt: Date;
}