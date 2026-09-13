import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LabTest, LabTestStatus, LabTestPriority } from './lab-test.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Patient } from '../patients/patient.entity';

@Injectable()
export class LabService implements OnModuleInit {
  constructor(
    @InjectRepository(LabTest)
    private labRepo: Repository<LabTest>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    private notificationsService: NotificationsService,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaultLabTests();
    } catch (err) {
      console.warn('⚠️ Lab service seed warning:', err.message);
    }
  }

  async seedDefaultLabTests() {
    const count = await this.labRepo.count();
    if (count > 0) return;

    const sampleTests = [
      {
        patientId: 'NMH260000001',
        patientName: 'Robert Vance',
        doctorName: 'Dr. Sarah Jenkins',
        testName: 'Complete Blood Count (CBC)',
        category: 'Pathology',
        sampleType: 'Blood',
        priority: LabTestPriority.URGENT,
        status: LabTestStatus.PENDING,
        notes: 'Pre-surgery emergency CBC screening required',
        orderedBy: 'Dr. Sarah Jenkins',
        patientStatus: 'admitted',
      },
      {
        patientId: 'NMH260000002',
        patientName: 'Elena Rostova',
        doctorName: 'Dr. Michael Chang',
        testName: 'Lipid Profile & Serum Electrolytes',
        category: 'Biochemistry',
        sampleType: 'Blood',
        priority: LabTestPriority.NORMAL,
        status: LabTestStatus.IN_PROGRESS,
        notes: 'Fasting lipid analysis and potassium levels check',
        orderedBy: 'Dr. Michael Chang',
        patientStatus: 'admitted',
      },
      {
        patientId: 'NMH260000003',
        patientName: 'Sarah Jenkins Demo',
        doctorName: 'Dr. John Smith',
        testName: 'Urinalysis & Routine Culture',
        category: 'Microbiology',
        sampleType: 'Urine',
        priority: LabTestPriority.NORMAL,
        status: LabTestStatus.COMPLETED,
        resultSummary: 'No bacterial growth after 24 hrs. pH 6.5, Specific Gravity 1.015 (Normal).',
        reportUrl: 'https://r2.medicore-hms.com/reports/sample_urinalysis.pdf',
        orderedBy: 'Dr. John Smith',
        completedBy: 'Senior Lab Technician',
        patientStatus: 'registered',
      },
    ];

    for (const testData of sampleTests) {
      await this.labRepo.save(this.labRepo.create(testData));
    }
    console.log('✅ Default Lab Test records seeded successfully');
  }

  async create(data: Partial<LabTest>, createdById?: string): Promise<LabTest> {
    if (data.patientId && data.testName) {
      // Prevent duplicate active test orders for the same patient and test name
      const existing = await this.labRepo.findOne({
        where: {
          patientId: data.patientId,
          testName: data.testName,
        },
        order: { createdAt: 'DESC' },
      });

      if (existing && (existing.status === LabTestStatus.PENDING || existing.status === LabTestStatus.IN_PROGRESS)) {
        console.log(`⚠️ Prevented duplicate lab test order for ${data.patientId} - ${data.testName}`);
        return existing;
      }
    }

    // Sync patient status from Patient entity if available
    let patientStatus = data.patientStatus;
    if (data.patientId) {
      const patient = await this.patientRepo.findOne({ where: { patientId: data.patientId } });
      if (patient) {
        patientStatus = patient.status;
      }
    }

    const test = this.labRepo.create({
      ...data,
      patientStatus,
      status: data.status || LabTestStatus.PENDING,
      priority: data.priority || LabTestPriority.NORMAL,
    });
    const saved = await this.labRepo.save(test);

    // Trigger notification to Lab Technicians
    const idempotencyKey = `lab-order-${saved.id}-${Date.now()}`;
    await this.notificationsService.sendToRole(
      'New Lab Test Ordered',
      `Test "${saved.testName}" ordered for Patient ${saved.patientName} (${saved.patientId}) - Priority: ${saved.priority}`,
      'lab_technician',
      'lab',
      saved.id,
      createdById,
      idempotencyKey,
    );

    return saved;
  }

  async findAll(query?: { status?: LabTestStatus; priority?: LabTestPriority; search?: string }): Promise<LabTest[]> {
    const qb = this.labRepo.createQueryBuilder('lt');

    if (query?.status) {
      qb.andWhere('lt.status = :status', { status: query.status });
    }

    if (query?.priority) {
      qb.andWhere('lt.priority = :priority', { priority: query.priority });
    }

    if (query?.search) {
      qb.andWhere(
        '(lt.patientId ILIKE :s OR lt.patientName ILIKE :s OR lt.testName ILIKE :s OR lt.category ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }

    // Dynamic join or update to ensure current patient status is fresh
    const tests = await qb.orderBy('lt.createdAt', 'DESC').getMany();

    // Enrich with live patient status
    const patientIds = Array.from(new Set(tests.map((t) => t.patientId).filter(Boolean)));
    if (patientIds.length > 0) {
      const patients = await this.patientRepo
        .createQueryBuilder('p')
        .where('p.patientId IN (:...pIds)', { pIds: patientIds })
        .getMany();
      const patientMap = new Map(patients.map((p) => [p.patientId, p.status]));

      for (const t of tests) {
        if (t.patientId && patientMap.has(t.patientId)) {
          t.patientStatus = patientMap.get(t.patientId)!;
        }
      }
    }

    return tests;
  }

  async findOne(id: string): Promise<LabTest> {
    const test = await this.labRepo.findOne({ where: { id } });
    if (!test) {
      throw new NotFoundException(`Lab test with ID ${id} not found`);
    }

    if (test.patientId) {
      const patient = await this.patientRepo.findOne({ where: { patientId: test.patientId } });
      if (patient) {
        test.patientStatus = patient.status;
      }
    }

    return test;
  }

  async findByPatient(patientId: string): Promise<LabTest[]> {
    return this.labRepo.find({
      where: { patientId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(id: string, data: Partial<LabTest>): Promise<LabTest> {
    const existing = await this.findOne(id);
    await this.labRepo.update(existing.id, data);
    return this.findOne(existing.id);
  }

  async updateStatus(id: string, status: LabTestStatus, updatedBy?: string): Promise<LabTest> {
    const test = await this.findOne(id);
    test.status = status;
    if (updatedBy) {
      test.completedBy = updatedBy;
    }
    const saved = await this.labRepo.save(test);

    // Notify doctor & nurse on status change
    const timestamp = Date.now();
    await this.notificationsService.sendToRole(
      `Lab Test ${status}`,
      `Lab Test "${saved.testName}" for ${saved.patientName} (${saved.patientId}) is now ${status}.`,
      'doctor',
      'lab',
      saved.id,
      updatedBy,
      `lab-status-doc-${saved.id}-${timestamp}`,
    );

    await this.notificationsService.sendToRole(
      `Lab Test ${status}`,
      `Lab Test "${saved.testName}" for ${saved.patientName} (${saved.patientId}) is now ${status}.`,
      'nurse',
      'lab',
      saved.id,
      updatedBy,
      `lab-status-nurse-${saved.id}-${timestamp}`,
    );

    return saved;
  }

  async recordResults(
    id: string,
    resultSummary: string,
    reportUrl?: string,
    testValues?: string,
    completedBy?: string,
  ): Promise<LabTest> {
    const test = await this.findOne(id);
    test.resultSummary = resultSummary;
    if (reportUrl) test.reportUrl = reportUrl;
    if (testValues) test.testValues = testValues;
    test.status = LabTestStatus.COMPLETED;
    if (completedBy) test.completedBy = completedBy;

    const saved = await this.labRepo.save(test);

    // Notify Doctor & Nurse that test results are ready
    const timestamp = Date.now();
    await this.notificationsService.sendToRole(
      'Lab Results Ready',
      `Results uploaded for "${saved.testName}" (Patient: ${saved.patientName}).`,
      'doctor',
      'lab',
      saved.id,
      completedBy,
      `lab-result-doctor-${saved.id}-${timestamp}`,
    );

    await this.notificationsService.sendToRole(
      'Lab Results Ready',
      `Results uploaded for "${saved.testName}" (Patient: ${saved.patientName}).`,
      'nurse',
      'lab',
      saved.id,
      completedBy,
      `lab-result-nurse-${saved.id}-${timestamp}`,
    );

    return saved;
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const test = await this.findOne(id);
    await this.labRepo.delete(test.id);
    return { success: true };
  }
}
