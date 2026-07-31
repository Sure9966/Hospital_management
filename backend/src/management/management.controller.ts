import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ManagementService } from './management.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

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
}
