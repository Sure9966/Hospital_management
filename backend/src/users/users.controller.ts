import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  findAll() { return this.usersService.findAll(); }

  @Post('clear-database')
  clearDatabase() { return this.usersService.clearDatabase(); }

  @Post('seed-defaults')
  seedDefaults() { return this.usersService.seedDefaultUsers(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.usersService.findById(id); }

  @Post(':id/approve')
  approve(@Param('id') id: string) { return this.usersService.approveUser(id); }

  @Post(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() body: { newPassword?: string }) {
    return this.usersService.resetUserPassword(id, body.newPassword);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.usersService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.usersService.remove(id); }
}
