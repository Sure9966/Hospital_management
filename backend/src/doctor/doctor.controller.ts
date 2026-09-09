import { Controller, Get, Post, Put, Param, Body, UseGuards } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('doctor')
@UseGuards(JwtAuthGuard)
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) { }

  @Post('consultations')
  createConsultation(@Body() body: any, @CurrentUser() user: any) {
    return this.doctorService.createConsultation(body, user);
  }

  @Get('consultations')
  findAllConsultations(@CurrentUser() user: any) {
    return this.doctorService.findAllConsultations(user);
  }

  @Get('consultations/patient/:patientId')
  findConsultationsByPatient(@Param('patientId') patientId: string, @CurrentUser() user: any) {
    return this.doctorService.findConsultationsByPatient(patientId, user);
  }

  @Put('consultations/:id')
  updateConsultation(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.doctorService.updateConsultation(id, body, user);
  }

  @Get('patient/:id/ehr')
  getPatientEhr(@Param('id') id: string, @CurrentUser() user: any) {
    return this.doctorService.getPatientFullEhr(id, user);
  }

  @Post('patient/:id/assign-doctor')
  assignDoctor(@Param('id') id: string, @Body('doctorName') doctorName: string, @Body('doctorId') doctorId?: string) {
    return this.doctorService.assignDoctorToPatient(id, doctorName, doctorId);
  }

  @Get('appointments/my')
  getMyAppointments(@CurrentUser() user: any) {
    return this.doctorService.getMyAppointments(user.id, user);
  }

  @Post('patient/:id/discharge')
  dischargePatient(
    @Param('id') id: string,
    @Body() body: any,
    @CurrentUser() user: any,
  ) {
    return this.doctorService.dischargePatient(id, body, user);
  }
}
