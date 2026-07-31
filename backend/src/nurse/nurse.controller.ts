import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { NurseService } from './nurse.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('nurse')
@UseGuards(JwtAuthGuard)
export class NurseController {
  constructor(private readonly nurseService: NurseService) {}

  @Post('vitals')
  record(@Body() body: any, @CurrentUser() user: any) {
    return this.nurseService.recordVitals(body, user?.id);
  }

  @Get('vitals')
  findAll() { return this.nurseService.findAllVitals(); }

  @Get('patient/:id/history')
  getHistory(@Param('id') id: string) {
    return this.nurseService.getPatientFullMedicalHistory(id);
  }

  @Get('vitals/patient/:patientId')
  byPatient(@Param('patientId') patientId: string) {
    return this.nurseService.findVitalsByPatient(patientId);
  }

  @Get('vitals/:id')
  findOne(@Param('id') id: string) { return this.nurseService.findVitalById(id); }

  @Put('vitals/:id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.nurseService.updateVital(id, body);
  }
}
