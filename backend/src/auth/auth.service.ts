import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';

import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) { }

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    if (!user.isActive) throw new UnauthorizedException('Account is inactive. Contact IT Admin.');
    if (user.isApproved === false) throw new UnauthorizedException('Account pending IT Admin approval');
    return user;
  }

  async login(email: string, password: string) {
    const user = await this.validateUser(email, password);
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
      department: user.department,
    };
    const { password: _, ...safeUser } = user;
    return {
      accessToken: this.jwtService.sign(payload),
      user: safeUser,
    };
  }

  async register(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    phone?: string;
    department?: string;
    isApproved?: boolean;
  }) {
    const existing = await this.usersService.findByEmail(data.email);
    if (existing) {
      // throw new UnauthorizedException('Email already in use');
      throw new ConflictException('Email already in use');
    }
    // check phone
    const existingPhone = await this.usersService.findByPhone(data.phone);

    if (existingPhone) {
      // throw new UnauthorizedException('Phone number already registered');
      throw new ConflictException('Phone number already in use');
    }
    if (!data.email?.trim() || !data.password?.trim() || !data.firstName?.trim() || !data.lastName?.trim() || !data.phone?.trim() || !data.department?.trim() || !data.role) {
      throw new BadRequestException('All employee fields are required');
    }
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      ...data,
      password: hashed,
      isApproved: data.isApproved !== undefined ? data.isApproved : true,
    });

    // Send welcome email notification to employee
    // await this.notificationsService.sendEmail(
    //   user.email,
    //   `🏥 Welcome to MediCore HMS - ${user.role.toUpperCase()} Portal Access`,
    //   `Hello ${user.firstName} ${user.lastName},\n\nYour employee account has been created for the role: ${user.role.toUpperCase()}.\nDepartment: ${user.department || 'General'}\nLogin URL: http://localhost:3000/login\n\nPlease log in and change your password.`,
    // );

    await this.notificationsService.sendEmail(
      user.email,
      'MediCore Hospital - Employee Login Credentials',
      `Dear ${user.firstName} ${user.lastName},

      Your employee account has been created successfully.

      Login Details
      --------------------------------
      Email      : ${user.email}
      Password   : ${data.password}
      Role       : ${user.role}
      Department : ${user.department || 'Not Assigned'}
      --------------------------------

      Login URL: http://localhost:3000/login

      Please use the above credentials to login to the hospital management system.

      For security, please change your password after your first login.

      Regards,
      MediCore Hospital Administration`,
    );

    const { password: _, ...safeUser } = user;
    return safeUser;
  }
}
