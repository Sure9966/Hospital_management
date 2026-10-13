import {
  Controller, Post, Get, Param, Delete,
  UseGuards, UseInterceptors, UploadedFile, Res, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SupabaseStorageService } from './supabase-storage.service';
import * as fs from 'fs';

const storage = diskStorage({
  destination: (req, file, cb) => {
    const dir = join(process.cwd(), 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}${extname(file.originalname)}`);
  },
});

@Controller('files')
export class FilesController {
  constructor(private readonly supabaseStorageService: SupabaseStorageService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { storage, limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(@UploadedFile() file: Express.Multer.File) {
    const filepath = join(process.cwd(), 'uploads', file.filename);
    const fileBuffer = fs.readFileSync(filepath);
    const storageKey = `uploads/${file.filename}`;

    const uploadResult = await this.supabaseStorageService.uploadPdf(
      storageKey,
      fileBuffer,
      file.mimetype,
    );

    return {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      key: storageKey,
      url: uploadResult.publicUrl || `/uploads/${file.filename}`,
      signedUrl: uploadResult.signedUrl,
      source: uploadResult.source,
    };
  }

  @Get('storage/status')
  async getStorageStatus() {
    const isReady = this.supabaseStorageService.isReady();
    const bucketName = this.supabaseStorageService.getStorageBucketName();
    const verified = await this.supabaseStorageService.verifyBucket();
    return {
      ready: isReady,
      bucket: bucketName,
      verified,
    };
  }

  @Get(':filename')
  async getFile(@Param('filename') filename: string, @Res() res: Response) {
    const storageKey = `uploads/${filename}`;
    const result = await this.supabaseStorageService.downloadPdf(storageKey, filename);

    if (!result) {
      throw new NotFoundException('File not found');
    }

    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `inline; filename="${result.filename}"`,
      'Content-Length': result.size,
    });

    res.send(result.buffer);
  }

  @Delete(':filename')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('filename') filename: string) {
    const storageKey = `uploads/${filename}`;
    const success = await this.supabaseStorageService.deleteFile(storageKey);
    return { success };
  }
}

