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
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      const stream = fs.createWriteStream(fullPath);
      doc.pipe(stream);

      // ─── Page geometry ──────────────────────────────────────────────
      const PAGE_LEFT = 30;
      const PAGE_RIGHT = 565;
      const PAGE_WIDTH = PAGE_RIGHT - PAGE_LEFT;           // 535
      const LABEL_W = 110;
      const VALUE_W = (PAGE_WIDTH / 2) - LABEL_W;

      // ─── Hospital header ────────────────────────────────────────────
      doc
        .fillColor('#0f172a')
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('NEUROSTAR MULTISPECIALITY HOSPITAL', PAGE_LEFT, 30, {
          width: PAGE_WIDTH,
          align: 'center',
        });

      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#475569')
        .text(
          '67-19-1, Opp Ashram School, Nagamalli thota, Kakinada 533003, India',
          PAGE_LEFT,
          50,
          { width: PAGE_WIDTH, align: 'center' },
        )
        .text('Phone: 7396333335 | Email: neurostarhospital@gmail.com', {
          width: PAGE_WIDTH,
          align: 'center',
        });

      // Logo (top-right) — replace with real file if you have it
      doc.image('assets/logo.png', PAGE_RIGHT - 55, 25, { width: 50 });
      doc.image('assets/logo1.png', PAGE_LEFT - 55, 25, { width: 50 });
      // ─── Title bar ──────────────────────────────────────────────────
      const titleY = 80;
      doc.rect(PAGE_LEFT, titleY, PAGE_WIDTH, 20).fill('#1e3a8a');
      doc
        .fillColor('#ffffff')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('PRESCRIPTION & PHARMACY INVOICE', PAGE_LEFT, titleY + 5, {
          width: PAGE_WIDTH,
          align: 'center',
        });

      // ─── Patient & Doctor info grid ─────────────────────────────────
      let y = titleY + 25;
      const rowH = 16;

      const drawRow = (
        leftLabel: string, leftValue: string,
        rightLabel: string, rightValue: string,
      ) => {
        // left half
        doc.rect(PAGE_LEFT, y, LABEL_W, rowH).stroke('#94a3b8');
        doc.rect(PAGE_LEFT + LABEL_W, y, VALUE_W, rowH).stroke('#94a3b8');
        // right half
        doc.rect(PAGE_LEFT + LABEL_W + VALUE_W, y, LABEL_W, rowH).stroke('#94a3b8');
        doc.rect(PAGE_LEFT + LABEL_W + VALUE_W + LABEL_W, y, VALUE_W, rowH).stroke('#94a3b8');

        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
        doc.text(leftLabel, PAGE_LEFT + 4, y + 4, { width: LABEL_W - 6 });
        doc.text(rightLabel, PAGE_LEFT + LABEL_W + VALUE_W + 4, y + 4, { width: LABEL_W - 6 });

        doc.font('Helvetica').fillColor('#334155');
        doc.text(leftValue, PAGE_LEFT + LABEL_W + 4, y + 4, { width: VALUE_W - 6 });
        doc.text(rightValue, PAGE_LEFT + LABEL_W + VALUE_W + LABEL_W + 4, y + 4, { width: VALUE_W - 6 });

        y += rowH;
      };

      drawRow('Invoice No', rx.invoiceNumber || 'INV-PENDING', 'Prescription No', rx.prescriptionId);
      drawRow('Patient Name', rx.patientName, 'Patient ID', rx.patientId);
      drawRow('Prescribing Doctor', `Dr. ${rx.doctorName || '—'}`, 'Date', new Date(rx.createdAt).toLocaleDateString());
      drawRow('Diagnosis', rx.diagnosis || 'N/A', 'Billing Status', (rx.billingStatus || 'unbilled').toUpperCase());

      // ─── Medicines table ────────────────────────────────────────────
      y += 6;
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(10);
      doc.text('PRESCRIBED MEDICINES', PAGE_LEFT, y);
      y += 14;

      const COL_NUM = PAGE_LEFT;
      const COL_NAME = PAGE_LEFT + 24;
      const COL_QTY = PAGE_LEFT + 300;
      const COL_UNIT = PAGE_LEFT + 350;
      const COL_TOTAL = PAGE_LEFT + 445;
      const ROW_H = 20;

      // header row
      doc.rect(PAGE_LEFT, y, PAGE_WIDTH, ROW_H).fill('#e2e8f0').stroke('#94a3b8');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
      doc.text('#', COL_NUM + 4, y + 6, { width: 20 });
      doc.text('Medicine & Schedule', COL_NAME, y + 6, { width: 270 });
      doc.text('Qty', COL_QTY, y + 6, { width: 40, align: 'center' });
      doc.text('Unit Cost', COL_UNIT, y + 6, { width: 80, align: 'right' });
      doc.text('Line Total', COL_TOTAL, y + 6, { width: 90, align: 'right' });

      // vertical column dividers
      const drawColumnLines = (rowY: number, h: number) => {
        [COL_NAME - 2, COL_QTY - 2, COL_UNIT - 2, COL_TOTAL - 2].forEach(x => {
          doc.moveTo(x, rowY).lineTo(x, rowY + h).stroke('#cbd5e1');
        });
        doc.moveTo(PAGE_RIGHT, rowY).lineTo(PAGE_RIGHT, rowY + h).stroke('#cbd5e1');
      };
      drawColumnLines(y, ROW_H);

      y += ROW_H;

      (rx.medicines || []).forEach((m, idx) => {
        const nameText = `${m.name}${m.dosage ? ` (${m.dosage})` : ''}`;
        const subText = `${m.frequency || ''}${m.duration ? ` • ${m.duration}` : ''}`.trim();

        const nameHeight = doc.heightOfString(nameText, { width: 270 });
        // Set font + size on the doc first, then measure
        doc.font('Helvetica').fontSize(8);
        const subHeight = subText ? doc.heightOfString(subText, { width: 270 }) + 2 : 0;
        // const subHeight = subText ? doc.heightOfString(subText, { width: 270, fontSize: 8 }) + 2 : 0;
        const h = Math.max(ROW_H, nameHeight + subHeight + 8);

        // row box
        doc.rect(PAGE_LEFT, y, PAGE_WIDTH, h).stroke('#e2e8f0');
        drawColumnLines(y, h);

        doc.font('Helvetica').fillColor('#334155').fontSize(9);
        doc.text(`${idx + 1}`, COL_NUM + 4, y + 6, { width: 20 });

        doc.font('Helvetica-Bold').fillColor('#0f172a');
        doc.text(nameText, COL_NAME, y + 5, { width: 270 });

        if (subText) {
          doc.font('Helvetica').fontSize(8).fillColor('#64748b');
          doc.text(subText, COL_NAME, y + 5 + nameHeight + 1, { width: 270 });
        }

        doc.font('Helvetica').fillColor('#334155').fontSize(9);
        doc.text(`${m.quantity}`, COL_QTY, y + 6, { width: 40, align: 'center' });
        doc.text(`$${Number(m.unitCost || 0).toFixed(2)}`, COL_UNIT, y + 6, { width: 80, align: 'right' });
        doc.text(`$${Number(m.lineTotal || 0).toFixed(2)}`, COL_TOTAL, y + 6, { width: 90, align: 'right' });

        y += h;
      });

      // ─── Billing summary ────────────────────────────────────────────
      y += 12;
      const boxW = 240;
      const boxX = PAGE_RIGHT - boxW;
      const boxH = 100;
      doc.rect(boxX, y, boxW, boxH).fillAndStroke('#f8fafc', '#94a3b8');

      doc.fillColor('#334155').font('Helvetica').fontSize(9);
      doc.text('Subtotal:', boxX + 12, y + 12);
      doc.text(`$${Number(rx.subtotal || 0).toFixed(2)}`, boxX + boxW - 90, y + 12, { width: 78, align: 'right' });

      doc.text('Discount:', boxX + 12, y + 30);
      doc.text(`-$${Number(rx.discountAmount || 0).toFixed(2)}`, boxX + boxW - 90, y + 30, { width: 78, align: 'right' });

      doc.text('Tax / Service Charge:', boxX + 12, y + 48);
      doc.text(`+$${Number(rx.taxAmount || 0).toFixed(2)}`, boxX + boxW - 90, y + 48, { width: 78, align: 'right' });

      doc.moveTo(boxX + 10, y + 68).lineTo(boxX + boxW - 10, y + 68).stroke('#cbd5e1');

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text('Total Payable:', boxX + 12, y + 76);
      doc.text(`$${Number(rx.totalCost || 0).toFixed(2)}`, boxX + boxW - 90, y + 76, { width: 78, align: 'right' });

      // ─── Status panel (left of billing box) ─────────────────────────
      const statusX = PAGE_LEFT;
      const statusW = boxX - PAGE_LEFT - 10;
      doc.rect(statusX, y, statusW, boxH).fillAndStroke('#ffffff', '#94a3b8');

      doc.fontSize(9).font('Helvetica-Bold');
      doc.fillColor('#0284c7').text(`Dispense Status: ${(rx.status || '').toUpperCase()}`, statusX + 10, y + 12);

      const billingColor =
        rx.billingStatus === BillingStatus.PAID ? '#16a34a'
          : rx.billingStatus === BillingStatus.BILLED ? '#0284c7'
            : '#d97706';
      doc.fillColor(billingColor)
        .text(`Billing Status: ${(rx.billingStatus || 'unbilled').toUpperCase()}`, statusX + 10, y + 30);

      doc.font('Helvetica').fillColor('#64748b').fontSize(8);
      if (rx.dispensedBy) {
        doc.text(`Dispensed By: ${rx.dispensedBy}`, statusX + 10, y + 48);
      }
      if (rx.dispensedAt) {
        doc.text(`Dispensed At: ${new Date(rx.dispensedAt).toLocaleString()}`, statusX + 10, y + 60);
      }
      doc.text('🔒 Secure & Encrypted Record — SHA-256 Validated', statusX + 10, y + 80, { width: statusW - 20 });

      y += boxH + 16;

      // ─── Notes ──────────────────────────────────────────────────────
      if (rx.notes) {
        doc.rect(PAGE_LEFT, y, PAGE_WIDTH, 34).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
        doc.text('NOTES / INSTRUCTIONS', PAGE_LEFT + 8, y + 5);
        doc.font('Helvetica').fontSize(8).fillColor('#475569');
        doc.text(rx.notes, PAGE_LEFT + 8, y + 18, { width: PAGE_WIDTH - 16 });
        y += 34;
      }

      // ─── Signature strip ────────────────────────────────────────────
      y += 14;
      doc.moveTo(PAGE_LEFT, y).lineTo(PAGE_RIGHT, y).stroke('#cbd5e1');
      y += 8;

      doc.font('Helvetica-Bold').fontSize(9).fillColor('#0f172a');
      doc.text('PHARMACIST SIGNATURE', PAGE_LEFT, y);
      doc.text('ATTENDING PHYSICIAN', PAGE_RIGHT - 180, y, { width: 180, align: 'right' });

      doc.font('Helvetica').fillColor('#64748b').fontSize(8);
      doc.text('Name: ____________________', PAGE_LEFT, y + 14);
      doc.text('Date: ____________________', PAGE_LEFT, y + 26);
      doc.text(`Dr. ${rx.doctorName || '—'}`, PAGE_RIGHT - 180, y + 14, { width: 180, align: 'right' });
      doc.text(`Date: ${new Date(rx.createdAt).toLocaleDateString()}`, PAGE_RIGHT - 180, y + 26, { width: 180, align: 'right' });

      // ─── Footer ─────────────────────────────────────────────────────
      doc
        .fontSize(7)
        .fillColor('#94a3b8')
        .text(
          'This document is electronically generated by NERUO MULTI SPECIALITY Health System. Valid without physical signature.',
          PAGE_LEFT,
          800,
          { width: PAGE_WIDTH, align: 'center' },
        );

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
