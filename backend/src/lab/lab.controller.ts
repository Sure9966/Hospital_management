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
} from '@nestjs/common';
import { LabService } from './lab.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { LabTestPriority, LabTestStatus } from './lab-test.entity';

@Controller('lab')
@UseGuards(JwtAuthGuard)
export class LabController {
  constructor(private readonly labService: LabService) {}

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

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.labService.remove(id);
  }
}
