import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ReceptionistService } from './receptionist.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('receptionist')
@UseGuards(JwtAuthGuard)
export class ReceptionistController {
  constructor(private readonly receptionistService: ReceptionistService) {}

  @Post('appointments')
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.receptionistService.createAppointment(body, user?.id);
  }

  @Get('appointments')
  findAll() { return this.receptionistService.findAllAppointments(); }

  @Get('appointments/today')
  getToday() { return this.receptionistService.getTodayAppointments(); }

  @Get('opd-queue')
  getOpdQueue() { return this.receptionistService.getOpdQueue(); }

  @Get('appointments/:id')
  findOne(@Param('id') id: string) { return this.receptionistService.findAppointmentById(id); }

  @Put('appointments/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.receptionistService.updateAppointment(id, body);
  }

  @Delete('appointments/:id')
  remove(@Param('id') id: string) { return this.receptionistService.deleteAppointment(id); }
}
