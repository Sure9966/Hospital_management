import { Controller, Get, Post, Body, UseGuards, Param, Res } from '@nestjs/common';
import { ManagementService } from './management.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';

@Controller('management')
@UseGuards(JwtAuthGuard)
export class ManagementController {
  constructor(private readonly managementService: ManagementService) {}

  @Get('dashboard')
  getDashboard() { return this.managementService.getDashboardStats(); }

  @Post('broadcast')
  broadcast(@Body() body: { title: string; message: string; targetRole?: string }) {
    return this.managementService.broadcast(body.title, body.message, body.targetRole);
  }

  @Get('discharges')
  getAllDischarges() {
    return this.managementService.getAllDischargeSummaries();
  }

  @Get('discharges/:id/pdf')
  async getDischargePdf(@Param('id') id: string, @Res() res: Response) {
    const { stream, filename, mimeType, size } = await this.managementService.getDischargePdfStream(id);
    
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': size,
    });
    
    stream.pipe(res);
  }
}
