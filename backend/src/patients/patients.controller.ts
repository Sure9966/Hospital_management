import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { PatientsService } from './patients.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('patients')
@UseGuards(JwtAuthGuard)
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Post()
  create(@Body() body: any, @CurrentUser() user: any) {
    return this.patientsService.create(body, user?.id);
  }

  @Get()
  findAll(@CurrentUser() user: any, @Query('doctorId') doctorId?: string) {
    return this.patientsService.findAll(user, doctorId);
  }

  @Get('search')
  search(@Query('q') q: string, @CurrentUser() user: any) {
    return this.patientsService.search(q, user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.patientsService.findOne(id, user);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @CurrentUser() user: any) {
    return this.patientsService.update(id, body, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.patientsService.remove(id); }
}
