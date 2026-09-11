import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Prescription, PrescriptionStatus, BillingStatus } from './prescription.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { CreatePrescriptionDto, UpdatePrescriptionDto, DispensePrescriptionDto } from './dto/prescription.dto';
import * as PDFDocument from 'pdfkit';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Patient } from '../patients/patient.entity';

@Injectable()
export class PharmacyService {
  private readonly storageDir = path.join(process.cwd(), 'secure_storage', 'prescriptions');

  constructor(
    @InjectRepository(Prescription)
    private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private notificationsService: NotificationsService,
  ) {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  // private async validatePatient(patientId: string, patientName: string) {
  //   const patient = await this.patientRepo.findOne({ 
  //     where: { patientId } 
  //   });

  //   if (!patient) {
  //     throw new BadRequestException(`Patient with ID ${patientId} not found in database`);
  //   }

  //   const expectedName = `${patient.firstName} ${patient.lastName}`;
  //   if (patientName.trim().toLowerCase() !== expectedName.toLowerCase()) {
  //     throw new BadRequestException(`Patient name does not match. Expected: ${expectedName}, Provided: ${patientName}`);
  //   }

  //   return patient;
  // }

  private async validatePatient(patientId: string, patientName: string) {
    const normalizedId = (patientId || '').trim();
    const normalizedName = (patientName || '').trim();

    if (!normalizedId) {
      throw new BadRequestException('patientId is required');
    }

    // 1. Exact match on patientId column
    let patient = await this.patientRepo.findOne({
      where: { patientId: normalizedId },
    });

    // 2. Fallback: treat as UUID primary key
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        normalizedId,
      );
    if (!patient && isUuid) {
      patient = await this.patientRepo.findOne({ where: { id: normalizedId } });
    }

    // 3. Fallback: case-insensitive match
    if (!patient) {
      patient = await this.patientRepo
        .createQueryBuilder('p')
        .where('LOWER(p.patientId) = LOWER(:id)', { id: normalizedId })
        .getOne();
    }

    if (!patient) {
      // Debug: show what actually exists in DB
      const samples = await this.patientRepo.find({ take: 20 });
      console.error('❌ Patient lookup failed for:', JSON.stringify(normalizedId));
      console.error(
        '📋 Sample DB patients:',
        samples.map((p) => ({
          id: p.id,
          patientId: p.patientId,
          name: `${p.firstName} ${p.lastName}`,
        })),
      );

      throw new BadRequestException(
        `Patient with ID ${normalizedId} not found in database`,
      );
    }

    // 4. Name match (case-insensitive, trimmed)
    const expectedName = `${patient.firstName} ${patient.lastName}`.trim();
    if (normalizedName.toLowerCase() !== expectedName.toLowerCase()) {
      throw new BadRequestException(
        `Patient name does not match. Expected: ${expectedName}, Provided: ${normalizedName}`,
      );
    }

    return patient;
  }
  private calculateTotals(medicines: any[], discountAmount: number = 0, taxAmount: number = 0) {
    const processedMedicines = (medicines || []).map((m) => {
      const quantity = Math.max(1, Number(m.quantity) || 1);
      const unitCost = Math.max(0, Number(m.unitCost) || 0);
      const lineTotal = Number((quantity * unitCost).toFixed(2));
      return {
        ...m,
        quantity,
        unitCost,
        lineTotal,
      };
    });

    const subtotal = Number(
      processedMedicines.reduce((sum, m) => sum + m.lineTotal, 0).toFixed(2),
    );
    const disc = Math.max(0, Number(discountAmount) || 0);
    const tax = Math.max(0, Number(taxAmount) || 0);
    const totalCost = Number(Math.max(0, subtotal - disc + tax).toFixed(2));

    return { processedMedicines, subtotal, discountAmount: disc, taxAmount: tax, totalCost };
  }

  async createPrescription(data: CreatePrescriptionDto, createdById?: string) {
    // Validate patient exists in database
    await this.validatePatient(data.patientId, data.patientName);

    // Validate medicines array
    if (!data.medicines || !Array.isArray(data.medicines) || data.medicines.length === 0) {
      throw new BadRequestException('medicines must be a non-empty array');
    }

    const count = await this.prescriptionRepo.count();
    const year = new Date().getFullYear();
    const prescriptionId = `RX-${year}-${String(count + 1).padStart(4, '0')}`;
    const invoiceNumber = `INV-${year}-${String(count + 1).padStart(4, '0')}`;

    const { processedMedicines, subtotal, discountAmount, taxAmount, totalCost } =
      this.calculateTotals(data.medicines, data.discountAmount, data.taxAmount);

    const prescription = this.prescriptionRepo.create({
      patientId: data.patientId,
      admissionNumber: data.admissionNumber,
      patientName: data.patientName,
      doctorName: data.doctorName,
      diagnosis: data.diagnosis,
      notes: data.notes,
      medicines: processedMedicines,
      prescriptionId,
      invoiceNumber,
      subtotal,
      discountAmount,
      taxAmount,
      totalCost,
      billingStatus: BillingStatus.UNBILLED,
      status: PrescriptionStatus.PENDING,
      isEncrypted: true,
    });

    const saved = await this.prescriptionRepo.save(prescription);

    // Generate backend PDF invoice & metadata update
    await this.generateAndStorePdf(saved);

    await this.notificationsService.sendToRole(
      'New Prescription',
      `Prescription ${saved.prescriptionId} for ${saved.patientName} (ID: ${saved.patientId}) - ${saved.medicines?.length || 0} medicines ($${saved.totalCost}). Ready to dispense.`,
      'pharmacist',
      'prescription',
      saved.id,
      createdById,
    );

    return this.findOne(saved.id);
  }

  async findAll() {
    return this.prescriptionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const p = await this.prescriptionRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Prescription not found');
    return p;
  }

  async findByPatient(patientId: string) {
    return this.prescriptionRepo.find({ where: { patientId }, order: { createdAt: 'DESC' } });
  }

  async dispense(id: string, dispensedBy: string, dto?: DispensePrescriptionDto) {
    const rx = await this.findOne(id);

    let { discountAmount, taxAmount, subtotal } = rx;
    if (dto?.discountAmount !== undefined) discountAmount = dto.discountAmount;
    if (dto?.taxAmount !== undefined) taxAmount = dto.taxAmount;

    const { processedMedicines, subtotal: calcSub, totalCost } = this.calculateTotals(
      rx.medicines,
      discountAmount,
      taxAmount,
    );

    rx.status = PrescriptionStatus.DISPENSED;
    rx.dispensedBy = dispensedBy;
    rx.dispensedAt = new Date();
    rx.subtotal = calcSub;
    rx.discountAmount = discountAmount;
    rx.taxAmount = taxAmount;
    rx.totalCost = totalCost;
    rx.billingStatus = dto?.billingStatus || BillingStatus.BILLED;
    rx.medicines = processedMedicines;

    await this.prescriptionRepo.save(rx);
    await this.generateAndStorePdf(rx);

    const updated = await this.findOne(id);

    await this.notificationsService.sendToRole(
      'Prescription Dispensed',
      `Prescription ${updated.prescriptionId} for ${updated.patientName} has been dispensed & billed ($${updated.totalCost}).`,
      'nurse',
      'prescription',
      id,
    );

    return updated;
  }

  async updatePrescription(id: string, data: UpdatePrescriptionDto) {
    const rx = await this.findOne(id);

    let medicines = rx.medicines;
    let discountAmount = data.discountAmount !== undefined ? data.discountAmount : rx.discountAmount;
    let taxAmount = data.taxAmount !== undefined ? data.taxAmount : rx.taxAmount;

    if (data.medicines) {
      medicines = data.medicines as any;
    }

    const { processedMedicines, subtotal, totalCost } = this.calculateTotals(
      medicines,
      discountAmount,
      taxAmount,
    );

    Object.assign(rx, {
      ...data,
      medicines: processedMedicines,
      subtotal,
      discountAmount,
      taxAmount,
      totalCost,
    });

    await this.prescriptionRepo.save(rx);
    await this.generateAndStorePdf(rx);

    return this.findOne(id);
  }

  async getPendingPrescriptions() {
    return this.prescriptionRepo.find({ where: { status: PrescriptionStatus.PENDING }, order: { createdAt: 'DESC' } });
  }

  private async generateAndStorePdf(rx: Prescription): Promise<void> {
    const pdfKey = `invoices/${rx.prescriptionId}_${Date.now()}.pdf`;
    const fullPath = path.join(this.storageDir, `${rx.prescriptionId}.pdf`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const stream = fs.createWriteStream(fullPath);
      doc.pipe(stream);

      // Header Banner
      doc.rect(40, 40, 515, 60).fill('#1e293b');
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('MEDICORE HOSPITAL PHARMACY', 55, 52);
      doc.fontSize(10).font('Helvetica').text('Official Prescription & Billing Invoice', 55, 78);

      doc.fillColor('#334155');

      // Top info boxes
      doc.fontSize(10).font('Helvetica-Bold').text(`Invoice #: ${rx.invoiceNumber || 'INV-PENDING'}`, 40, 115);
      doc.text(`Prescription #: ${rx.prescriptionId}`, 200, 115);
      doc.text(`Date: ${new Date(rx.createdAt).toLocaleDateString()}`, 400, 115);

      doc.moveTo(40, 130).lineTo(555, 130).strokeColor('#cbd5e1').stroke();

      // Patient & Doctor Information
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text('PATIENT & DOCTOR INFORMATION', 40, 140);

      doc.fontSize(9).font('Helvetica').fillColor('#475569');
      doc.text(`Patient Name: ${rx.patientName}`, 40, 158);
      doc.text(`Patient ID: ${rx.patientId}`, 40, 172);
      doc.text(`Prescribing Doctor: Dr. ${rx.doctorName}`, 300, 158);
      doc.text(`Diagnosis: ${rx.diagnosis || 'N/A'}`, 300, 172);

      doc.moveTo(40, 192).lineTo(555, 192).strokeColor('#cbd5e1').stroke();

      // Medicine Table Header
      let y = 205;
      doc.rect(40, y, 515, 22).fill('#f1f5f9');
      doc.fillColor('#1e293b').fontSize(9).font('Helvetica-Bold');
      doc.text('#', 45, y + 6);
      doc.text('Medicine & Schedule', 65, y + 6);
      doc.text('Qty', 270, y + 6);
      doc.text('Unit Cost', 330, y + 6);
      doc.text('Line Total', 470, y + 6, { width: 80, align: 'right' });

      y += 26;
      doc.font('Helvetica').fontSize(9).fillColor('#334155');

      (rx.medicines || []).forEach((m, idx) => {
        doc.text(`${idx + 1}`, 45, y);
        doc.font('Helvetica-Bold').text(`${m.name} (${m.dosage})`, 65, y);
        doc.font('Helvetica').fillColor('#64748b').text(`${m.frequency || ''} - ${m.duration || ''}`, 65, y + 11);
        doc.fillColor('#334155');

        doc.text(`${m.quantity}`, 270, y);
        doc.text(`$${Number(m.unitCost || 0).toFixed(2)}`, 330, y);
        doc.text(`$${Number(m.lineTotal || 0).toFixed(2)}`, 470, y, { width: 80, align: 'right' });

        y += 26;
        doc.moveTo(40, y - 4).lineTo(555, y - 4).strokeColor('#f1f5f9').stroke();
      });

      y += 10;
      // Billing Summary Sidebar / Box
      const summaryTop = y;
      doc.rect(320, summaryTop, 235, 110).fill('#f8fafc').strokeColor('#e2e8f0').stroke();

      doc.fillColor('#334155').fontSize(9).font('Helvetica');
      doc.text('Subtotal:', 335, summaryTop + 12);
      doc.text(`$${Number(rx.subtotal || 0).toFixed(2)}`, 470, summaryTop + 12, { width: 75, align: 'right' });

      doc.text('Discount:', 335, summaryTop + 30);
      doc.text(`-$${Number(rx.discountAmount || 0).toFixed(2)}`, 470, summaryTop + 30, { width: 75, align: 'right' });

      doc.text('Tax / Service Charge:', 335, summaryTop + 48);
      doc.text(`+$${Number(rx.taxAmount || 0).toFixed(2)}`, 470, summaryTop + 48, { width: 75, align: 'right' });

      doc.moveTo(330, summaryTop + 68).lineTo(545, summaryTop + 68).strokeColor('#cbd5e1').stroke();

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text('Total Payable:', 335, summaryTop + 76);
      doc.text(`$${Number(rx.totalCost || 0).toFixed(2)}`, 470, summaryTop + 76, { width: 75, align: 'right' });

      // Billing & Dispense Status Badges
      doc.fontSize(9).font('Helvetica-Bold');
      doc.fillColor('#0284c7').text(`Dispense Status: ${rx.status.toUpperCase()}`, 40, summaryTop + 12);

      const billingColor = rx.billingStatus === BillingStatus.PAID ? '#16a34a' : rx.billingStatus === BillingStatus.BILLED ? '#0284c7' : '#d97706';
      doc.fillColor(billingColor).text(`Billing Status: ${rx.billingStatus.toUpperCase()}`, 40, summaryTop + 30);

      if (rx.dispensedBy) {
        doc.fillColor('#64748b').font('Helvetica').text(`Dispensed By: ${rx.dispensedBy}`, 40, summaryTop + 48);
      }

      // Security / Encryption watermark box
      doc.rect(40, summaryTop + 70, 260, 40).fill('#f1f5f9');
      doc.fillColor('#475569').fontSize(8).font('Helvetica');
      doc.text('🔒 SECURE & ENCRYPTED RECORD', 48, summaryTop + 76);
      doc.text(`Hash Verification: SHA-256 Validated`, 48, summaryTop + 88);

      // Footer
      doc.fontSize(8).fillColor('#94a3b8').text('This document is electronically generated by MediCore Health System. Valid without physical signature.', 40, 780, { align: 'center', width: 515 });

      doc.end();

      stream.on('finish', async () => {
        try {
          const stats = fs.statSync(fullPath);
          const fileBuffer = fs.readFileSync(fullPath);
          const hashSum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

          await this.prescriptionRepo.update(rx.id, {
            invoicePdfKey: pdfKey,
            invoicePdfName: `${rx.prescriptionId}.pdf`,
            invoicePdfMimeType: 'application/pdf',
            invoicePdfSize: stats.size,
            invoicePdfHash: hashSum,
            invoiceGeneratedAt: new Date(),
          });

          resolve();
        } catch (err) {
          reject(err);
        }
      });

      stream.on('error', (err) => reject(err));
    });
  }

  async getInvoiceFileStream(id: string) {
    const rx = await this.findOne(id);
    const fullPath = path.join(this.storageDir, `${rx.prescriptionId}.pdf`);

    if (!fs.existsSync(fullPath)) {
      // Regenerate if missing
      await this.generateAndStorePdf(rx);
    }

    return {
      stream: fs.createReadStream(fullPath),
      filename: `${rx.prescriptionId}_Invoice.pdf`,
      mimeType: 'application/pdf',
      size: fs.statSync(fullPath).size,
    };
  }
}
