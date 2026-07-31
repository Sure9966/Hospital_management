import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ward, Bed, Admission } from './bed.entity';
import { BedsService } from './beds.service';
import { BedsController } from './beds.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ward, Bed, Admission])],
  controllers: [BedsController],
  providers: [BedsService],
  exports: [BedsService],
})
export class BedsModule {}
