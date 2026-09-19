import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './user.entity';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    private notificationsService: NotificationsService,
  ) { }

  async onModuleInit() {
    try {
      await this.seedDefaultUsers();
    } catch (err) {
      console.warn('⚠️ User seed warning (will retry on next db connect):', err.message);
    }
  }

  async seedDefaultUsers() {
    const defaultAccounts = [
      {
        email: 'admin@hospital.com',
        firstName: 'System',
        lastName: 'Admin',
        role: UserRole.ADMIN,
        department: 'Administration',
        phone: '123-456-7890',
      },
      {
        email: 'reception@hospital.com',
        firstName: 'Front Desk',
        lastName: 'Receptionist',
        role: UserRole.RECEPTIONIST,
        department: 'Reception',
        phone: '123-456-7891',
      },
      {
        email: 'nurse@hospital.com',
        firstName: 'Head',
        lastName: 'Nurse',
        role: UserRole.NURSE,
        department: 'Emergency & Triage',
        phone: '123-456-7892',
      },
      {
        email: 'doctor@hospital.com',
        firstName: 'Dr. Sarah',
        lastName: 'Jenkins',
        role: UserRole.DOCTOR,
        department: 'Cardiology',
        phone: '123-456-7895',
      },
      {
        email: 'doctor.smith@hospital.com',
        firstName: 'Dr. John',
        lastName: 'Smith',
        role: UserRole.DOCTOR,
        department: 'Neurology',
        phone: '123-456-7896',
      },
      {
        email: 'doctor.patel@hospital.com',
        firstName: 'Dr. Priya',
        lastName: 'Patel',
        role: UserRole.DOCTOR,
        department: 'Pediatrics',
        phone: '123-456-7897',
      },
      {
        email: 'doctor.williams@hospital.com',
        firstName: 'Dr. Robert',
        lastName: 'Williams',
        role: UserRole.DOCTOR,
        department: 'Orthopedics',
        phone: '123-456-7898',
      },
      {
        email: 'doctor.davis@hospital.com',
        firstName: 'Dr. Emily',
        lastName: 'Davis',
        role: UserRole.DOCTOR,
        department: 'General',
        phone: '123-456-7899',
      },
      {
        email: 'pharmacy@hospital.com',
        firstName: 'Chief',
        lastName: 'Pharmacist',
        role: UserRole.PHARMACIST,
        department: 'Pharmacy',
        phone: '123-456-7893',
      },
      {
        email: 'manager@hospital.com',
        firstName: 'Hospital',
        lastName: 'Manager',
        role: UserRole.MANAGEMENT,
        department: 'Management',
        phone: '123-456-7894',
      },
      {
        email: 'lab@hospital.com',
        firstName: 'Senior',
        lastName: 'Lab Technician',
        role: UserRole.LAB_TECHNICIAN,
        department: 'Laboratory',
        phone: '123-456-7900',
      },
    ];

    const hashedPassword = await bcrypt.hash('demo123', 10);

    for (const acc of defaultAccounts) {
      const existing = await this.findByEmail(acc.email);
      if (!existing) {
        await this.create({
          ...acc,
          password: hashedPassword,
          isActive: true,
        });
        console.log(`✅ Seeded default user: ${acc.email} (${acc.role})`);
      }
    }
  }

  async findByEmail(email: string) {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  async create(data: Partial<User>) {
    const user = this.usersRepo.create(data);
    return this.usersRepo.save(user);
  }

  async findAll() {
    return this.usersRepo.find({
      select: ['id', 'email', 'firstName', 'lastName', 'role', 'phone', 'department', 'dutyType', 'isActive', 'isApproved', 'permissions', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async findDoctors(department?: string) {
    const query = this.usersRepo.createQueryBuilder('u')
      .where('u.role = :role', { role: UserRole.DOCTOR })
      .andWhere('u.isActive = :isActive', { isActive: true });

    if (department) {
      query.andWhere('u.department ILIKE :dept', { dept: `%${department}%` });
    }

    return query.select(['u.id', 'u.firstName', 'u.lastName', 'u.email', 'u.department', 'u.phone']).getMany();
  }

  async approveUser(id: string) {
    await this.usersRepo.update(id, { isApproved: true, isActive: true });
    return this.findById(id);
  }

  async resetUserPassword(id: string, newPassword = 'demo123') {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersRepo.update(id, { password: hashedPassword });
    return { success: true, message: `Password reset to ${newPassword}` };
  }

  async update(id: string, data: Partial<User>) {
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }
    await this.usersRepo.update(id, data);
    return this.findById(id);
  }

  async remove(id: string) {
    await this.usersRepo.delete(id);
    return { success: true };
  }

  async clearDatabase() {
    // Delete non-admin users or reset users
    const allUsers = await this.usersRepo.find();
    for (const u of allUsers) {
      if (u.email !== 'admin@hospital.com') {
        await this.usersRepo.delete(u.id);
      }
    }
    // Re-seed defaults
    await this.seedDefaultUsers();
    return { success: true, message: 'Database reset successfully and default logins restored.' };
  }

  async findByPhone(phone: string) {
    return this.usersRepo.findOne({
      where: { phone },
    });
  }

  async createEmployee(data: Partial<User>) {
    const existing = await this.findByEmail(data.email!);

    if (existing) {
      throw new Error('Employee email already exists');
    }

    if (!data.password) {
      throw new Error('Password is required');
    }

    // Password entered by admin in frontend
    const plainPassword = data.password;

    // Store only hashed password
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const user = this.usersRepo.create({
      ...data,
      password: hashedPassword,
      isActive: true,
      isApproved: true,
    });

    const savedUser = await this.usersRepo.save(user);

    // Send SAME password entered by admin
    await this.notificationsService.sendEmail(
      savedUser.email,
      'MediCore Hospital - Employee Login Credentials',
      `Dear ${savedUser.firstName} ${savedUser.lastName},

Your employee account has been created successfully.

Login Details
--------------------------------
Email      : ${savedUser.email}
Password   : ${plainPassword}
Role       : ${savedUser.role}
Department : ${savedUser.department || 'Not Assigned'}
--------------------------------

Please use these credentials to login.

Regards,
MediCore Hospital Administration`,
    );

    return {
      success: true,
      message: 'Employee created and login credentials sent to email',
      user: savedUser,
    };
  }
}
