import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
  IsEnum,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BillingStatus, PrescriptionStatus } from '../prescription.entity';

export class MedicineItemDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  dosage: string;

  @IsString()
  @IsOptional()
  frequency?: string;

  @IsString()
  @IsOptional()
  duration?: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  instructions?: string;

  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  lineTotal?: number;
}

export class CreatePrescriptionDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsOptional()
  admissionNumber: string;

  @IsString()
  @IsNotEmpty()
  patientName: string;

  @IsString()
  @IsNotEmpty()
  doctorName: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray({ message: 'medicines must be an array' })
  @ValidateNested({ each: true })
  @Type(() => MedicineItemDto)
  medicines: MedicineItemDto[];

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxAmount?: number;
}

export class UpdatePrescriptionDto {
  @IsString()
  @IsOptional()
  patientId?: string;

  @IsString()
  @IsOptional()
  patientName?: string;

  @IsString()
  @IsOptional()
  doctorName?: string;

  @IsString()
  @IsOptional()
  diagnosis?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MedicineItemDto)
  @IsOptional()
  medicines?: MedicineItemDto[];

  @IsEnum(PrescriptionStatus)
  @IsOptional()
  status?: PrescriptionStatus;

  @IsEnum(BillingStatus)
  @IsOptional()
  billingStatus?: BillingStatus;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxAmount?: number;
}

export class DispensePrescriptionDto {
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  taxAmount?: number;

  @IsEnum(BillingStatus)
  @IsOptional()
  billingStatus?: BillingStatus;
}
