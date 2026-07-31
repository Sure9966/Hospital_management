import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { BedsService } from './beds.service';
import { BedStatus } from './bed.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('beds')
@UseGuards(JwtAuthGuard)
export class BedsController {
  constructor(private readonly bedsService: BedsService) {}

  // Wards
  @Get('wards')
  getWards() {
    return this.bedsService.findAllWards();
  }

  @Post('wards')
  createWard(@Body() body: any) {
    return this.bedsService.createWard(body);
  }

  // Beds
  @Get()
  getBeds() {
    return this.bedsService.findAllBeds();
  }

  @Post()
  createBed(@Body() body: any) {
    return this.bedsService.createBed(body);
  }

  @Put(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: BedStatus }) {
    return this.bedsService.updateBedStatus(id, body.status);
  }

  @Delete(':id')
  deleteBed(@Param('id') id: string) {
    return this.bedsService.deleteBed(id);
  }

  // Admissions & Allocation
  @Get('admissions')
  getAdmissions() {
    return this.bedsService.findAllAdmissions();
  }

  @Post('admissions')
  createAdmission(@Body() body: any) {
    return this.bedsService.createAdmission(body);
  }

  @Post('allocate')
  allocateBed(@Body() body: { admissionId: string; bedId: string }) {
    return this.bedsService.allocateBed(body.admissionId, body.bedId);
  }

  @Post(':id/discharge')
  dischargePatient(@Param('id') bedId: string, @Body() body: { admissionId?: string }) {
    return this.bedsService.dischargePatient(bedId, body.admissionId);
  }
}
