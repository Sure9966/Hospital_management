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
  findAll() { return this.patientsService.findAll(); }

  @Get('search')
  search(@Query('q') q: string) { return this.patientsService.search(q); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.patientsService.findOne(id); }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.patientsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.patientsService.remove(id); }
}
