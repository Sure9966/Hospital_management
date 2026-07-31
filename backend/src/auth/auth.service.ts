import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

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
    const payload = { sub: user.id, email: user.email, role: user.role };
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
      throw new UnauthorizedException('Email already in use');
    }
    const hashed = await bcrypt.hash(data.password, 10);
    const user = await this.usersService.create({
      ...data,
      password: hashed,
      isApproved: data.isApproved !== undefined ? data.isApproved : true,
    });
    const { password: _, ...safeUser } = user;
    return safeUser;
  }
}
