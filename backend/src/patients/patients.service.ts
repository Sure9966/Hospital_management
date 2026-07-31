import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patient } from './patient.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PatientsService {
  constructor(
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private notificationsService: NotificationsService,
  ) {}

  async create(data: Partial<Patient>, createdById?: string) {
    const count = await this.patientRepo.count();
    const year = new Date().getFullYear();
    const seq = String(count + 1).padStart(4, '0');
    const patientId = `PAT-${year}-${seq}`;
    const opdTokenNumber = `TK-${year}-${seq}`;

    const patient = this.patientRepo.create({
      ...data,
      patientId,
      opdTokenNumber,
    });
    const saved = await this.patientRepo.save(patient);

    await this.notificationsService.sendToRole(
      'New Patient Registered',
      `Patient ${saved.firstName} ${saved.lastName} (${saved.patientId}) - OPD Token: ${saved.opdTokenNumber}`,
      'nurse',
      'registration',
      saved.id,
      createdById,
    );

    await this.notificationsService.sendToRole(
      'New Patient',
      `New patient ${saved.firstName} ${saved.lastName} registered with Token ${saved.opdTokenNumber}.`,
      'management',
      'registration',
      saved.id,
      createdById,
    );

    return saved;
  }

  async findAll() {
    return this.patientRepo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    return this.patientRepo.findOne({ where: { id } });
  }

  async findByPatientId(patientId: string) {
    return this.patientRepo.findOne({ where: { patientId } });
  }

  async update(id: string, data: Partial<Patient>) {
    await this.patientRepo.update(id, data);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.patientRepo.delete(id);
    return { success: true };
  }

  async search(query: string) {
    return this.patientRepo
      .createQueryBuilder('p')
      .where(
        'p.firstName ILIKE :q OR p.lastName ILIKE :q OR p.patientId ILIKE :q OR p.opdTokenNumber ILIKE :q OR p.phone ILIKE :q',
        { q: `%${query}%` },
      )
      .orderBy('p.createdAt', 'DESC')
      .take(20)
      .getMany();
  }
}
