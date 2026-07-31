import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Res,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { PharmacyService } from './pharmacy.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import {
  CreatePrescriptionDto,
  UpdatePrescriptionDto,
  DispensePrescriptionDto,
} from './dto/prescription.dto';

@Controller('pharmacy')
@UseGuards(JwtAuthGuard)
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Post('prescriptions')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@Body() dto: CreatePrescriptionDto, @CurrentUser() user: any) {
    return this.pharmacyService.createPrescription(dto, user?.id);
  }

  @Get('prescriptions')
  findAll() {
    return this.pharmacyService.findAll();
  }

  @Get('prescriptions/pending')
  getPending() {
    return this.pharmacyService.getPendingPrescriptions();
  }

  @Get('prescriptions/patient/:patientId')
  byPatient(@Param('patientId') patientId: string) {
    return this.pharmacyService.findByPatient(patientId);
  }

  @Get('prescriptions/:id')
  findOne(@Param('id') id: string) {
    return this.pharmacyService.findOne(id);
  }

  @Get('prescriptions/:id/pdf')
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const file = await this.pharmacyService.getInvoiceFileStream(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.setHeader('Content-Length', file.size);
    file.stream.pipe(res);
  }

  @Put('prescriptions/:id/dispense')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  dispense(
    @Param('id') id: string,
    @Body() dto: DispensePrescriptionDto,
    @CurrentUser() user: any,
  ) {
    return this.pharmacyService.dispense(id, user?.email || user?.username || 'Pharmacist', dto);
  }

  @Put('prescriptions/:id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(@Param('id') id: string, @Body() dto: UpdatePrescriptionDto) {
    return this.pharmacyService.updatePrescription(id, dto);
  }
}
