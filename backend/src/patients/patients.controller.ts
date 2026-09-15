import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.patientsService.create(body, user?.id);
  }

  @Post('emergency')
  createEmergency(@Body() body: any, @CurrentUser() user: any) {
    return this.patientsService.createEmergency(body, user?.id);
  }

  @Get('emergency/pending')
  getPendingEmergency() {
    return this.patientsService.findPendingEmergency();
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('doctorId') doctorId?: string) {
    return this.patientsService.findAll(user, doctorId);
  }

  @Get('search')
  search(@Query('q') q: string, @CurrentUser() user: any) {
    return this.patientsService.search(q, user);
  }

  @Get('check-phone')
  checkPhone(@Query('phone') phone: string) {
    return this.patientsService.checkPhoneExists(phone);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.findOne(id, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.patientsService.update(id, body, user);
  }

  @Put(':id/complete-registration')
  completeRegistration(@Param('id') id: string, @Body() body: any) {
    return this.patientsService.completeRegistration(id, body);
  }

  @Post(':id/renew-op')
  renewOpdToken(@Param('id') id: string) {
    return this.patientsService.renewOpdToken(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.patientsService.remove(id); }
}
