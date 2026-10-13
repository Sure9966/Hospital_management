import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import { LabService } from './lab.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LabTestPriority, LabTestStatus } from './lab-test.entity';
import { SupabaseStorageService } from '../files/supabase-storage.service';

@Controller('lab')
@UseGuards(JwtAuthGuard)
export class LabController {
  constructor(
    private readonly labService: LabService,
    private readonly supabaseStorageService: SupabaseStorageService,
  ) {}

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    const creatorName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'System';
    return this.labService.create({ ...body, orderedBy: body.orderedBy || creatorName }, user?.id);
  }

  @Get()
  findAll(
    @Query('status') status?: LabTestStatus,
    @Query('priority') priority?: LabTestPriority,
    @Query('search') search?: string,
  ) {
    return this.labService.findAll({ status, priority, search });
  }

  @Get('patient/:patientId')
  findByPatient(@Param('patientId') patientId: string) {
    return this.labService.findByPatient(patientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.labService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.labService.update(id, body);
  }

  @Put(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body('status') status: LabTestStatus,
    @CurrentUser() user: any,
  ) {
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Lab Tech';
    return this.labService.updateStatus(id, status, userName);
  }

  @Put(':id/results')
  recordResults(
    @Param('id') id: string,
    @Body('resultSummary') resultSummary: string,
    @Body('reportUrl') reportUrl?: string,
    @Body('testValues') testValues?: string,
    @CurrentUser() user?: any,
  ) {
    const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Lab Tech';
    return this.labService.recordResults(id, resultSummary, reportUrl, testValues, userName);
  }

  @Post(':id/upload-report')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async uploadReport(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No report file provided');
    }
    const ext = extname(file.originalname || 'report.pdf') || '.pdf';
    const storageKey = `lab-reports/lab_${id}_${Date.now()}${ext}`;
    const uploadResult = await this.supabaseStorageService.uploadPdf(
      storageKey,
      file.buffer,
      file.mimetype,
    );
    const reportUrl = uploadResult.publicUrl || `/uploads/${file.originalname}`;

    await this.labService.update(id, { reportUrl });
    return {
      success: true,
      reportUrl,
      key: storageKey,
      signedUrl: uploadResult.signedUrl,
      source: uploadResult.source,
    };
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.labService.remove(id);
  }
}

