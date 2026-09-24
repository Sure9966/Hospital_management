import { Injectable, OnModuleInit, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ward, Bed, BedStatus, Admission, AdmissionStatus } from './bed.entity';
import { Patient, PatientStatus } from '../patients/patient.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class BedsService implements OnModuleInit {
  constructor(
    @InjectRepository(Ward) private wardRepo: Repository<Ward>,
    @InjectRepository(Bed) private bedRepo: Repository<Bed>,
    @InjectRepository(Admission) private admissionRepo: Repository<Admission>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    private notificationsService: NotificationsService,
  ) { }

  async onModuleInit() {
    try {
      await this.seedDefaultBedsAndWards();
    } catch (err) {
      console.warn('⚠️ Bed management seed warning:', err.message);
    }
  }

  async seedDefaultBedsAndWards() {
    const wardCount = await this.wardRepo.count();
    if (wardCount === 0) {
      const defaultWards = [
        { name: 'ICU (Intensive Care)', floor: '2nd Floor - Wing A', description: 'Critical care unit with 24/7 monitoring' },
        { name: 'General Ward A', floor: '1st Floor - Wing A', description: 'General inpatient male & female care unit A' },
        { name: 'General Ward B', floor: '1st Floor - Wing B', description: 'General inpatient male & female care unit B' },
        { name: 'VIP Suite Ward', floor: '4th Floor - Executive Wing', description: 'VIP private rooms and luxury care' },
        { name: 'Normal Inpatient Ward', floor: '3rd Floor - Wing C', description: 'Standard single & twin sharing rooms' },
      ];
      for (const wData of defaultWards) {
        await this.wardRepo.save(this.wardRepo.create(wData));
      }
      console.log('✅ Default Wards Seeded (No default beds pre-populated)');
    }
  }

  async purgeAllBeds() {
    await this.bedRepo.delete({});
    return { success: true, message: 'All default beds purged successfully' };
  }

  // Wards
  async findAllWards() {
    return this.wardRepo.find({ relations: ['beds'], order: { createdAt: 'ASC' } });
  }

  async createWard(data: Partial<Ward>) {
    const ward = this.wardRepo.create(data);
    return this.wardRepo.save(ward);
  }

  // Beds
  async findAllBeds() {
    return this.bedRepo.find({ relations: ['ward'], order: { roomNumber: 'ASC', bedNumber: 'ASC' } });
  }

  async createBed(data: Partial<Bed>) {
    if (!data.bedNumber || !data.bedNumber.trim()) {
      throw new BadRequestException('Bed number is required');
    }
    const cleanBedNumber = data.bedNumber.trim();
    const existing = await this.bedRepo
      .createQueryBuilder('bed')
      .where('LOWER(bed.bedNumber) = LOWER(:bedNumber)', { bedNumber: cleanBedNumber })
      .getOne();

    if (existing) {
      throw new ConflictException(`Bed number "${cleanBedNumber}" already exists! Duplicate bed numbers are not allowed.`);
    }

    const bed = this.bedRepo.create({
      ...data,
      bedNumber: cleanBedNumber,
    });
    return this.bedRepo.save(bed);
  }

  async updateBedStatus(id: string, status: BedStatus) {
    const updateData: Partial<Bed> = { status };
    if (status === BedStatus.VACANT || status === BedStatus.CLEANING) {
      updateData.currentPatientId = null;
      updateData.currentPatientName = null;
      updateData.admissionDate = null;
    }
    await this.bedRepo.update(id, updateData);
    return this.bedRepo.findOne({ where: { id }, relations: ['ward'] });
  }

  async deleteBed(id: string) {
    return this.bedRepo.delete(id);
  }

  // Admissions
  async findAllAdmissions() {
    return this.admissionRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createAdmission(data: Partial<Admission>) {
    const admission = this.admissionRepo.create(data);
    return this.admissionRepo.save(admission);
  }

  async allocateBed(admissionId: string, bedId: string) {
    const admission = await this.admissionRepo.findOne({ where: { id: admissionId } });
    const bed = await this.bedRepo.findOne({ where: { id: bedId }, relations: ['ward'] });

    if (!admission || !bed) {
      throw new Error('Admission request or Bed not found');
    }

    if (bed.status !== BedStatus.VACANT) {
      throw new Error(`Bed ${bed.bedNumber} is not vacant!`);
    }

    // Update Bed state
    bed.status = BedStatus.OCCUPIED;
    bed.currentPatientId = admission.patientId;
    bed.currentPatientName = admission.patientName;
    bed.admissionDate = new Date().toISOString();
    await this.bedRepo.save(bed);

    // Update Admission state
    admission.status = AdmissionStatus.ADMITTED;
    admission.allocatedBedId = bed.id;
    admission.allocatedBedNumber = bed.bedNumber;
    admission.allocatedRoomNumber = bed.roomNumber;
    admission.allocatedBedType = bed.bedType || bed.subType || 'Normal';
    admission.allocatedWardName = bed.ward ? bed.ward.name : 'General';
    admission.admittedAt = new Date();
    await this.admissionRepo.save(admission);

    // Update Patient Entity record if present
    if (admission.patientId) {
      let patient = await this.patientRepo.findOne({ where: { patientId: admission.patientId } });
      if (!patient) {
        patient = await this.patientRepo.findOne({ where: { id: admission.patientId } });
      }
      if (patient) {
        patient.status = PatientStatus.ADMITTED;
        patient.bedNumber = bed.bedNumber;
        patient.ward = `${bed.ward?.name || 'Ward'} (${bed.roomNumber})`;
        await this.patientRepo.save(patient);
      }
    }

    return { admission, bed };
  }

  async dischargePatient(bedId: string, admissionId?: string) {
    const bed = await this.bedRepo.findOne({ where: { id: bedId } });
    if (!bed) throw new Error('Bed not found');

    const patientId = bed.currentPatientId;
    const patientName = bed.currentPatientName || 'Patient';

    // Update Bed to cleaning status post discharge
    bed.status = BedStatus.CLEANING;
    bed.currentPatientId = null;
    bed.currentPatientName = null;
    bed.admissionDate = null;
    await this.bedRepo.save(bed);

    if (admissionId) {
      const admission = await this.admissionRepo.findOne({ where: { id: admissionId } });
      if (admission) {
        admission.status = AdmissionStatus.DISCHARGED;
        admission.dischargedAt = new Date();
        await this.admissionRepo.save(admission);
      }
    }

    // Update Patient entity status to DISCHARGED
    if (patientId) {
      let patient = await this.patientRepo.findOne({ where: { patientId } });
      if (!patient) {
        patient = await this.patientRepo.findOne({ where: { id: patientId } });
      }
      if (patient) {
        patient.status = PatientStatus.DISCHARGED;
        patient.bedNumber = undefined;
        patient.ward = undefined;
        await this.patientRepo.save(patient);
      }
    }

    // Broadcast patient discharge event to all portals (Receptionist, Nurse, Doctor, Pharmacist, Management, Lab)
    const idempotencyKey = `discharge-${patientId || bedId}-${Date.now()}`;
    const rolesToNotify = ['receptionist', 'nurse', 'doctor', 'pharmacist', 'management', 'lab_technician'];

    for (const role of rolesToNotify) {
      await this.notificationsService.sendToRole(
        'Patient Discharged',
        `Patient ${patientName} (${patientId || 'Inpatient'}) has been discharged. Bed ${bed.bedNumber} is now freed for sanitization.`,
        role,
        'discharge',
        patientId || bedId,
        undefined,
        `${idempotencyKey}-${role}`,
      );
    }

    return bed;
  }

  async transferBed(data: { patientId?: string; fromBedId?: string; toBedId: string; reason?: string }) {
    const { patientId, fromBedId, toBedId, reason } = data;

    if (!toBedId) {
      throw new BadRequestException('Destination bed ID is required');
    }

    const toBed = await this.bedRepo.findOne({ where: { id: toBedId }, relations: ['ward'] });
    if (!toBed) {
      throw new NotFoundException('Destination bed not found');
    }

    if (toBed.status !== BedStatus.VACANT) {
      throw new BadRequestException(`Destination bed ${toBed.bedNumber} is not vacant (Current status: ${toBed.status})!`);
    }

    let fromBed: Bed | null = null;
    if (fromBedId) {
      fromBed = await this.bedRepo.findOne({ where: { id: fromBedId }, relations: ['ward'] });
    } else if (patientId) {
      fromBed = await this.bedRepo.findOne({ where: { currentPatientId: patientId }, relations: ['ward'] });
    }

    let patient: Patient | null = null;
    if (patientId) {
      patient = await this.patientRepo.findOne({ where: { id: patientId } });
      if (!patient) {
        patient = await this.patientRepo.findOne({ where: { patientId } });
      }
    }
    if (!patient && fromBed && fromBed.currentPatientId) {
      patient = await this.patientRepo.findOne({ where: { id: fromBed.currentPatientId } });
      if (!patient) {
        patient = await this.patientRepo.findOne({ where: { patientId: fromBed.currentPatientId } });
      }
    }

    const patientName = patient ? `${patient.firstName} ${patient.lastName}` : (fromBed?.currentPatientName || 'Patient');
    const pId = patient ? patient.patientId : (patientId || fromBed?.currentPatientId || '');
    const admissionDate = fromBed?.admissionDate || new Date().toISOString();

    // 1. Vacate origin bed if present
    if (fromBed) {
      fromBed.status = BedStatus.CLEANING;
      fromBed.currentPatientId = null;
      fromBed.currentPatientName = null;
      fromBed.admissionDate = null;
      await this.bedRepo.save(fromBed);
    }

    // 2. Occupy destination bed
    toBed.status = BedStatus.OCCUPIED;
    toBed.currentPatientId = patient?.id || pId;
    toBed.currentPatientName = patientName;
    toBed.admissionDate = admissionDate;
    await this.bedRepo.save(toBed);

    // 3. Update Patient record
    if (patient) {
      patient.status = PatientStatus.ADMITTED;
      patient.bedNumber = toBed.bedNumber;
      patient.ward = `${toBed.ward?.name || 'Ward'} (${toBed.roomNumber})`;
      await this.patientRepo.save(patient);
    }

    // 4. Update Admission record if present
    if (pId) {
      const admission = await this.admissionRepo.findOne({
        where: { patientId: pId, status: AdmissionStatus.ADMITTED },
        order: { createdAt: 'DESC' },
      });
      if (admission) {
        admission.allocatedBedId = toBed.id;
        admission.allocatedBedNumber = toBed.bedNumber;
        admission.allocatedRoomNumber = toBed.roomNumber;
        admission.allocatedWardName = toBed.ward?.name || 'General';
        admission.allocatedBedType = toBed.bedType || toBed.subType || 'Normal';
        if (reason) {
          admission.notes = admission.notes ? `${admission.notes} | Transfer: ${reason}` : `Transfer: ${reason}`;
        }
        await this.admissionRepo.save(admission);
      }
    }

    // 5. Notify all portals
    const fromLocation = fromBed ? `${fromBed.ward?.name || 'Ward'} (${fromBed.bedNumber})` : 'Previous Bed';
    const toLocation = `${toBed.ward?.name || 'Ward'} (${toBed.bedNumber})`;
    const notificationMsg = `Patient ${patientName} (${pId}) transferred from ${fromLocation} to ${toLocation}. ${reason ? `Reason: ${reason}` : ''}`;
    
    const rolesToNotify = ['receptionist', 'nurse', 'doctor', 'pharmacist', 'management'];
    const idempotencyKey = `transfer-${pId}-${toBed.id}-${Date.now()}`;
    for (const role of rolesToNotify) {
      await this.notificationsService.sendToRole(
        'Patient Bed Transfer',
        notificationMsg,
        role,
        'bed_transfer',
        pId,
        undefined,
        `${idempotencyKey}-${role}`,
      );
    }

    return {
      success: true,
      message: `Patient ${patientName} transferred to bed ${toBed.bedNumber} successfully`,
      patient,
      fromBed,
      toBed,
    };
  }
}
