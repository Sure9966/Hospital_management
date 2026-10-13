import { Controller, Get, Post, Put, Param, Body, UseGuards, Res, StreamableFile } from '@nestjs/common';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Response } from 'express';

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

  @Get('discharges')
  getAllDischarges() {
    return this.doctorService.getAllDischargeSummaries();
  }

  @Get('discharges/:id/pdf')
  async getDischargePdf(@Param('id') id: string, @Res() res: Response) {
    const { stream, filename, mimeType, size } = await this.doctorService.getDischargePdfStream(id);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': size,
    });
    
    stream.pipe(res);
  }

  @Get('opd-slip/:patientId/pdf')
  async getOpdSlipPdf(@Param('patientId') patientId: string, @Res() res: Response) {
    const { stream, filename, mimeType, size } = await this.doctorService.getOpdSlipPdfStream(patientId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': size,
    });
    stream.pipe(res);
  }

  @Get('opd-slip/:patientId/consultation/:consultationId/pdf')
  async getOpdSlipPdfByConsultation(
    @Param('patientId') patientId: string,
    @Param('consultationId') consultationId: string,
    @Res() res: Response,
  ) {
    const { stream, filename, mimeType, size } = await this.doctorService.getOpdSlipPdfStream(patientId, consultationId);
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': size,
    });
    stream.pipe(res);
  }
}
