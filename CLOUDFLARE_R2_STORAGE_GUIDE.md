# ☁️ Cloudflare R2 Storage Integration Guide for MediCore HMS

This guide provides step-by-step instructions on integrating **Cloudflare R2 Object Storage** into the **MediCore Hospital Management System (NestJS Backend + Next.js Frontend)** for storing and serving patient PDF invoices, lab reports, prescriptions, and medical records securely with zero egress fees.

---

## 📌 Why Cloudflare R2?

* **Zero Egress Fees**: Unlike AWS S3, Cloudflare R2 charges $0 for egress bandwidth when serving files to users.
* **S3 API Compatibility**: R2 works seamlessly with standard AWS S3 SDK (`@aws-sdk/client-s3`).
* **High Performance**: Built-in integration with Cloudflare's global edge CDN network.
* **Generous Free Tier**: 10 GB storage per month and 10 million read requests free.

---

## 🛠️ Step 1: Create Cloudflare R2 Bucket & API Credentials

1. Log into your [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, select **R2 Object Storage**.
3. Click **Create Bucket**:
   * **Bucket Name**: `medicore-hospital-pdfs`
   * Click **Create Bucket**.
4. Go to **Manage R2 API Tokens** (on the right sidebar under R2 Overview).
5. Click **Create API Token**:
   * **Token Name**: `medicore-backend-token`
   * **Permissions**: `Object Read & Write` (Admin Read & Write)
   * **Specify bucket**: `medicore-hospital-pdfs` (or All Buckets)
   * Click **Create API Token**.
6. Copy down the generated credentials (shown only once):
   * 🔑 **Account ID**
   * 🔑 **Access Key ID**
   * 🔑 **Secret Access Key**
   * 🌐 **S3 Endpoint**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

---

## 📦 Step 2: Install AWS S3 SDK in Backend

In your NestJS backend directory:

```bash
cd backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

---

## ⚙️ Step 3: Configure `backend/.env`

Add the Cloudflare R2 credentials to your `backend/.env` file:

```env
# --- Cloudflare R2 Storage Configuration ---
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
R2_BUCKET_NAME=medicore-hospital-pdfs
R2_ENDPOINT=https://your_cloudflare_account_id.r2.cloudflarestorage.com
R2_PUBLIC_URL=https://pub-xxxxxx.r2.dev

# (Optional fallback when R2 is disabled)
UPLOAD_DIR=./uploads
```

---

## 💻 Step 4: Create NestJS R2 Storage Service

Create a dedicated NestJS storage module in `backend/src/files/r2-storage.service.ts`:

```typescript
// File: backend/src/files/r2-storage.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2StorageService {
  private s3Client: S3Client;
  private bucketName: string;
  private publicUrl: string;
  private readonly logger = new Logger(R2StorageService.name);

  constructor(private configService: ConfigService) {
    const accountId = this.configService.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('R2_SECRET_ACCESS_KEY');

    this.bucketName = this.configService.get<string>('R2_BUCKET_NAME', 'medicore-hospital-pdfs');
    this.publicUrl = this.configService.get<string>('R2_PUBLIC_URL', '');

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  /**
   * Upload a PDF file buffer directly to Cloudflare R2 bucket
   */
  async uploadPdf(fileBuffer: Buffer, key: string, contentType = 'application/pdf'): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);
      this.logger.log(`Uploaded file to Cloudflare R2: ${key}`);

      // Return public URL or R2 key path
      return this.publicUrl ? `${this.publicUrl}/${key}` : key;
    } catch (error) {
      this.logger.error(`Error uploading PDF to Cloudflare R2`, error);
      throw error;
    }
  }

  /**
   * Generate temporary signed download URL for private R2 objects (valid for 1 hour)
   */
  async getPresignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });
    return getSignedUrl(this.s3Client, command, { expiresIn: expiresInSeconds });
  }

  /**
   * Delete a file from Cloudflare R2 bucket
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting file from R2`, error);
      return false;
    }
  }
}
```

---

## 📑 Step 5: Save PDF Invoices & Prescriptions to R2

Example integration inside Pharmacy / Medical Invoice Generation (`backend/src/pharmacy/pharmacy.service.ts`):

```typescript
import { Injectable } from '@nestjs/common';
import { R2StorageService } from '../files/r2-storage.service';

@Injectable()
export class PharmacyService {
  constructor(private r2Storage: R2StorageService) {}

  async generateAndUploadPrescriptionPdf(prescriptionData: any) {
    // 1. Generate PDF Buffer (e.g. via PDFKit or Puppeteer)
    const pdfBuffer: Buffer = await this.createPdfBuffer(prescriptionData);
    
    // 2. Define unique R2 object key
    const fileName = `prescriptions/RX-${prescriptionData.id}-${Date.now()}.pdf`;

    // 3. Upload to Cloudflare R2
    const pdfUrl = await this.r2Storage.uploadPdf(pdfBuffer, fileName);

    return {
      success: true,
      pdfUrl,
      fileName,
    };
  }

  private async createPdfBuffer(data: any): Promise<Buffer> {
    // Your PDFKit / HTML PDF rendering logic returning Buffer
    return Buffer.from('PDF Content Placeholder');
  }
}
```

---

## 🖥️ Step 6: Frontend PDF Download & Preview in Next.js

In Next.js frontend ([`frontend/src/app/dashboard/pharmacist/page.tsx`](file:///c:/Users/user/Documents/nextjs/frontend/src/app/dashboard/pharmacist/page.tsx)):

```tsx
const handleViewPrescriptionPdf = async (prescriptionId: string) => {
  try {
    // Fetch PDF presigned URL or direct link from NestJS API
    const res = await api.get(`/pharmacy/prescriptions/${prescriptionId}/pdf-url`);
    const { pdfUrl } = res.data;

    // Open PDF in new browser tab for viewing or printing
    window.open(pdfUrl, '_blank');
  } catch (err) {
    toast.error('Could not load PDF file');
  }
};
```

---

## 🛡️ Security Best Practices

1. **Private Bucket + Presigned URLs**: Keep R2 bucket private and serve files through presigned short-lived URLs (`getPresignedDownloadUrl`).
2. **Access Control**: Enforce NestJS JWT Guards before generating PDF download URLs.
3. **Automatic Cleanup**: Set Lifecycle rules in Cloudflare R2 Dashboard to auto-expire temporary draft files after 90 days if required.
