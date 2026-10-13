import { Global, Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { SupabaseStorageService } from './supabase-storage.service';

@Global()
@Module({
  controllers: [FilesController],
  providers: [SupabaseStorageService],
  exports: [SupabaseStorageService],
})
export class FilesModule {}

