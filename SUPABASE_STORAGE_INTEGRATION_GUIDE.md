# 🗄️ Supabase Storage Integration Guide for Hospital PDFs

This document explains the **Supabase Storage** integration implemented for **MediCore / Neurostar Hospital Management System**.

---

## 🚀 1. Integration Overview

The application automatically stores, archives, and serves all generated PDF documents using **Supabase Storage**:
- **Prescription Invoices (`invoices/`)**: Generated automatically when prescriptions are created/dispensed.
- **Discharge Summaries (`discharges/`)**: Generated when patients are discharged by doctors.
- **OPD Consultation Slips (`opd-slips/`)**: Generated for outpatient visits and token receipts.
- **Lab Test Reports (`lab-reports/`)**: Uploaded directly by laboratory technicians as official test reports.
- **General Patient Attachments (`uploads/`)**: Medical scans, documents, and records uploaded via `/files/upload`.

### 🛡️ Dual-Storage Architecture (Supabase + Resilient Local Cache)
- When PDFs are generated or uploaded, they are stored in **Supabase Storage**.
- A local backup is maintained in `secure_storage/` ensuring that even in offline scenarios or initial setup phases, document generation never fails.
- When retrieving documents, the system queries Supabase Storage first, caching on demand and generating streams seamlessly.

---

## ⚙️ 2. Environment Variables Configured

### Backend (`backend/.env`)
```env
# --- Supabase Storage Configuration ---
SUPABASE_URL=https://cywhymqevyoaciordvip.supabase.co
SUPABASE_KEY=sb_publishable_KrFHFGBlpJY7wkueNfsFfg_jNg-W5dK
NEXT_PUBLIC_SUPABASE_URL=https://cywhymqevyoaciordvip.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_KrFHFGBlpJY7wkueNfsFfg_jNg-W5dK
SUPABASE_BUCKET_NAME=hospital-pdfs
```

### Frontend (`frontend/.env.local`)
```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://cywhymqevyoaciordvip.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_KrFHFGBlpJY7wkueNfsFfg_jNg-W5dK
NEXT_PUBLIC_SUPABASE_BUCKET=hospital-pdfs
```

---

## 📦 3. Supabase Dashboard Setup (1-Time Action)

To ensure files can be written and read from Supabase:

1. Open your Supabase Dashboard: [https://supabase.com/dashboard/project/cywhymqevyoaciordvip](https://supabase.com/dashboard/project/cywhymqevyoaciordvip)
2. Go to **Storage** -> **New Bucket**.
3. Create a bucket named:
   - **Name**: `hospital-pdfs`
   - **Public Bucket**: **Turn ON (checked)** *(allows direct link viewing for lab reports & patient downloads)*
4. Click **Save**.

### (Optional) If you prefer Private Bucket + RLS:
Run this SQL in your Supabase **SQL Editor**:
```sql
-- Create public access policies for hospital-pdfs bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('hospital-pdfs', 'hospital-pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow upload
CREATE POLICY "Allow public uploads" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'hospital-pdfs');

-- Allow download / select
CREATE POLICY "Allow public reads" ON storage.objects
FOR SELECT USING (bucket_id = 'hospital-pdfs');

-- Allow update
CREATE POLICY "Allow public updates" ON storage.objects
FOR UPDATE USING (bucket_id = 'hospital-pdfs');
```

---

## 📂 4. Key Code Files Implemented

1. **`backend/src/files/supabase-storage.service.ts`**:
   - `uploadPdf(key, buffer, mimeType)`: Uploads PDF to Supabase Storage with local cache backup.
   - `downloadPdf(key, fallbackLocalFilename)`: Downloads buffer from Supabase Storage or fallback.
   - `getPublicUrl(key)`: Returns permanent Supabase public URL.
   - `getSignedUrl(key, expiresIn)`: Returns temporary secure signed download URL.
   - `verifyBucket()`: Verifies accessibility of the bucket.

2. **`backend/src/files/files.controller.ts`**:
   - `POST /files/upload`: Uploads any file directly to Supabase Storage under `uploads/`.
   - `GET /files/:filename`: Serves files with streaming directly from Supabase Storage.
   - `GET /files/storage/status`: Checks Supabase connection & bucket status.

3. **`backend/src/pharmacy/pharmacy.service.ts`**:
   - `generateAndStorePdf()`: Automatically uploads prescription invoices to `invoices/` in Supabase Storage.
   - `getInvoiceFileStream()`: Fetches invoices from Supabase Storage with on-the-fly regeneration if needed.

4. **`backend/src/doctor/doctor.service.ts`**:
   - `generateDischargePdf()`: Uploads discharge summaries to `discharges/` in Supabase Storage.
   - `getDischargePdfStream()`: Fetches discharge summaries from Supabase Storage.
   - `getOpdSlipPdfStream()`: Generates and archives OPD slips to `opd-slips/` in Supabase Storage.

5. **`backend/src/lab/lab.controller.ts`**:
   - `POST /lab/:id/upload-report`: Allows lab technicians to upload PDF test reports directly into Supabase Storage. Automatically links the PDF to the lab test record (`reportUrl`).

6. **`frontend/src/lib/supabase.ts`**:
   - Client-side Supabase client instance and helpers (`uploadFileToSupabase`, `getSupabasePublicUrl`).

7. **`frontend/src/app/dashboard/lab/page.tsx`**:
   - Added direct file uploader in the result modal: lab technicians can click **📁 Upload PDF** to upload the PDF report directly to Supabase and attach it to the test record with a live preview link.

---

## 🧪 5. Testing the Integration

### Check Supabase Storage Status
Start backend and run:
```bash
curl http://localhost:3001/files/storage/status
```
Returns:
```json
{
  "ready": true,
  "bucket": "hospital-pdfs",
  "verified": true
}
```

### Download / View PDFs
- **Prescription Invoices**: Pharmacists click **⬇️ PDF** on Prescriptions page -> streamed from Supabase.
- **Discharge Summaries**: Doctor/Nurse/Management click **📄 Download PDF** -> streamed from Supabase.
- **OPD Slips**: Doctor/Receptionist click **📄 OP PDF** -> streamed from Supabase.
- **Lab Test Reports**: Lab technicians upload PDF report -> saved to Supabase -> Doctor & Nurse view report via Supabase URL.
