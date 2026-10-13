import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

export interface StorageUploadResult {
  success: boolean;
  key: string;
  publicUrl: string;
  signedUrl?: string;
  localPath?: string;
  source: 'supabase' | 'local';
  error?: string;
}

export interface StorageDownloadResult {
  success: boolean;
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
  source: 'supabase' | 'local';
}

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabase: SupabaseClient | null = null;
  private bucketName: string;
  private readonly storageDir: string;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.storageDir = path.join(process.cwd(), 'secure_storage');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }

    const url =
      this.configService.get<string>('SUPABASE_URL') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL') ||
      '';
    const key =
      this.configService.get<string>('SUPABASE_KEY') ||
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') ||
      '';

    this.bucketName =
      this.configService.get<string>('SUPABASE_BUCKET_NAME') ||
      this.configService.get<string>('NEXT_PUBLIC_SUPABASE_BUCKET') ||
      'hospital-pdfs';

    if (url && key) {
      try {
        this.supabase = createClient(url, key, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        this.isConfigured = true;
      } catch (err) {
        this.logger.error(`Failed to initialize Supabase client: ${err.message}`);
      }
    } else {
      this.logger.warn('Supabase URL or Key missing. Will operate in local-cache mode.');
    }
  }

  async onModuleInit() {
    if (this.isConfigured && this.supabase) {
      this.logger.log(`Supabase Storage active. Target bucket: "${this.bucketName}"`);
      await this.verifyBucket();
    } else {
      this.logger.warn('Supabase Storage is not configured. Local storage fallback active.');
    }
  }

  /**
   * Verify if the target bucket exists in Supabase.
   */
  async verifyBucket(): Promise<boolean> {
    if (!this.supabase) return false;
    try {
      const { data, error } = await this.supabase.storage.getBucket(this.bucketName);
      if (error) {
        this.logger.warn(
          `Supabase bucket "${this.bucketName}" is not accessible (${error.message}). ` +
          `If not created yet, please create a public bucket named "${this.bucketName}" in your Supabase dashboard. Local backup will be maintained.`,
        );
        return false;
      }
      this.logger.log(`Verified Supabase bucket "${this.bucketName}" exists and is ready.`);
      return true;
    } catch (err: any) {
      this.logger.warn(`Could not verify bucket "${this.bucketName}": ${err.message}`);
      return false;
    }
  }

  /**
   * Upload a PDF or file to Supabase Storage with local cache backup.
   */
  async uploadPdf(
    key: string,
    buffer: Buffer,
    mimeType: string = 'application/pdf',
  ): Promise<StorageUploadResult> {
    // 1. Always save a local copy as resilient backup
    const localFilePath = path.join(this.storageDir, key.replace(/\//g, '_'));
    try {
      const dir = path.dirname(localFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(localFilePath, buffer);
    } catch (err: any) {
      this.logger.warn(`Failed to write local backup file: ${err.message}`);
    }

    // 2. Upload to Supabase Storage if configured
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .upload(key, buffer, {
            contentType: mimeType,
            upsert: true,
          });

        if (error) {
          this.logger.warn(`Supabase upload failed for "${key}": ${error.message}. Using local backup.`);
          return {
            success: false,
            key,
            publicUrl: `/uploads/${path.basename(localFilePath)}`,
            localPath: localFilePath,
            source: 'local',
            error: error.message,
          };
        }

        const publicUrlData = this.supabase.storage.from(this.bucketName).getPublicUrl(key);
        const publicUrl = publicUrlData.data?.publicUrl || '';

        // Optional signed URL
        let signedUrl: string | undefined;
        try {
          const { data: signedData } = await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(key, 60 * 60 * 24); // 24 hours
          if (signedData?.signedUrl) {
            signedUrl = signedData.signedUrl;
          }
        } catch {
          // Ignore signed URL error
        }

        this.logger.log(`Successfully uploaded "${key}" to Supabase Storage (${this.bucketName}).`);
        return {
          success: true,
          key,
          publicUrl,
          signedUrl,
          localPath: localFilePath,
          source: 'supabase',
        };
      } catch (err: any) {
        this.logger.error(`Error uploading to Supabase: ${err.message}`);
        return {
          success: false,
          key,
          publicUrl: `/uploads/${path.basename(localFilePath)}`,
          localPath: localFilePath,
          source: 'local',
          error: err.message,
        };
      }
    }

    return {
      success: true,
      key,
      publicUrl: `/uploads/${path.basename(localFilePath)}`,
      localPath: localFilePath,
      source: 'local',
    };
  }

  /**
   * Download a PDF from Supabase Storage or fallback to local cache.
   */
  async downloadPdf(
    key: string,
    fallbackLocalFilename?: string,
  ): Promise<StorageDownloadResult | null> {
    const filename = path.basename(key);

    // 1. Try Supabase Storage first
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.storage.from(this.bucketName).download(key);
        if (data && !error) {
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          // Update local cache
          const localFilePath = path.join(this.storageDir, key.replace(/\//g, '_'));
          try {
            fs.writeFileSync(localFilePath, buffer);
          } catch {
            // cache update non-fatal
          }

          return {
            success: true,
            buffer,
            filename,
            mimeType: 'application/pdf',
            size: buffer.length,
            source: 'supabase',
          };
        }
      } catch (err: any) {
        this.logger.debug(`Supabase download failed for "${key}": ${err.message}. Checking local disk...`);
      }
    }

    // 2. Check local secure_storage with key or flattened key
    const potentialPaths = [
      path.join(this.storageDir, key),
      path.join(this.storageDir, key.replace(/\//g, '_')),
      path.join(this.storageDir, filename),
      path.join(process.cwd(), 'uploads', filename),
    ];

    if (fallbackLocalFilename) {
      potentialPaths.unshift(
        path.join(this.storageDir, fallbackLocalFilename),
        path.join(process.cwd(), 'uploads', fallbackLocalFilename),
      );
    }

    for (const filePath of potentialPaths) {
      if (fs.existsSync(filePath)) {
        const buffer = fs.readFileSync(filePath);
        return {
          success: true,
          buffer,
          filename: path.basename(filePath),
          mimeType: 'application/pdf',
          size: buffer.length,
          source: 'local',
        };
      }
    }

    return null;
  }

  /**
   * Get public URL for a file in Supabase Storage.
   */
  getPublicUrl(key: string): string {
    if (this.supabase) {
      const { data } = this.supabase.storage.from(this.bucketName).getPublicUrl(key);
      return data.publicUrl;
    }
    return `/uploads/${key}`;
  }

  /**
   * Generate a signed URL for temporary authorized download.
   */
  async getSignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string | null> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .createSignedUrl(key, expiresInSeconds);
        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      } catch (err: any) {
        this.logger.warn(`Failed to create signed URL for "${key}": ${err.message}`);
      }
    }
    return null;
  }

  /**
   * Delete a file from Supabase and local cache.
   */
  async deleteFile(key: string): Promise<boolean> {
    let deleted = false;
    if (this.supabase) {
      try {
        const { error } = await this.supabase.storage.from(this.bucketName).remove([key]);
        if (!error) deleted = true;
      } catch (err: any) {
        this.logger.warn(`Error deleting from Supabase "${key}": ${err.message}`);
      }
    }

    const localPaths = [
      path.join(this.storageDir, key),
      path.join(this.storageDir, key.replace(/\//g, '_')),
      path.join(this.storageDir, path.basename(key)),
      path.join(process.cwd(), 'uploads', path.basename(key)),
    ];
    for (const p of localPaths) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
          deleted = true;
        } catch {
          // ignore
        }
      }
    }
    return deleted;
  }

  getStorageBucketName(): string {
    return this.bucketName;
  }

  isReady(): boolean {
    return this.isConfigured && this.supabase !== null;
  }
}
