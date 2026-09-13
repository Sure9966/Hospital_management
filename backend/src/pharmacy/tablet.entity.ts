import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('tablets')
export class Tablet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  power: string; // e.g. "500mg", "200mg", "10mg", "650mg"

  @Column({
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  price: number;

  @Column({ nullable: true })
  mfgDate: string; // e.g. "2025-01-15"

  @Column({ nullable: true })
  expiryDate: string; // e.g. "2027-01-15"

  @Column({ type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ nullable: true, default: 'General' })
  category: string;

  @Column({ nullable: true })
  manufacturer: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
