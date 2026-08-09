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
  findAllConsultations() {
    return this.doctorService.findAllConsultations();
  }

  @Get('consultations/patient/:patientId')
  findConsultationsByPatient(@Param('patientId') patientId: string) {
    return this.doctorService.findConsultationsByPatient(patientId);
  }

  @Put('consultations/:id')
  updateConsultation(@Param('id') id: string, @Body() body: any) {
    return this.doctorService.updateConsultation(id, body);
  }

  @Get('patient/:id/ehr')
  getPatientEhr(@Param('id') id: string) {
    return this.doctorService.getPatientFullEhr(id);
  }

  @Post('patient/:id/assign-doctor')
  assignDoctor(@Param('id') id: string, @Body('doctorName') doctorName: string, @Body('doctorId') doctorId?: string) {
    return this.doctorService.assignDoctorToPatient(id, doctorName, doctorId);
  }

  @Get('appointments/my')
  getMyAppointments(@CurrentUser() user: any) {
    return this.doctorService.getMyAppointments(user.id);
  }
}
