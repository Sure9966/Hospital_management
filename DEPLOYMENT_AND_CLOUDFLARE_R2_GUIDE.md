# 🌐 Full Deployment Guide (Render + Vercel) & Cloudflare R2 PDF Interlinking Guide

This guide provides step-by-step instructions for deploying the **MediCore Hospital Management System** to production using **Render** (Backend + Database) and **Vercel** (Frontend), as well as explaining how to generate and interlink **Cloudflare R2 PDF files** inside `.md` documentation files and frontend applications.

---

## 📑 Table of Contents
1. [Backend & PostgreSQL Deployment on Render](#1-backend--postgresql-deployment-on-render)
2. [Frontend Deployment on Vercel](#2-frontend-deployment-on-vercel)
3. [Cloudflare R2 Storage & PDF Link Interlinking Guide](#3-cloudflare-r2-storage--pdf-link-interlinking-guide)
4. [Pharmacy Store Tablets Feature Overview](#4-pharmacy-store-tablets-feature-overview)

---

## 1. Backend & PostgreSQL Deployment on Render

### Step 1: Render Database Setup
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Create a new **PostgreSQL Database** instance:
   * **Name**: `medicore-hms-db`
   * **Database**: `hospital_management_2rij`
   * **User**: `hospital_management_2rij_user`
   * **Region**: Choose nearest region (e.g. Oregon/Singapore).
3. Copy the **External Database URL**:
   ```env
   DATABASE_URL=postgresql://hospital_management_2rij_user:yRep7k93ywzvp9ta3Fpl1Bt6gKrkc4zq@dpg-daidu5jm8hqs73cf8fq0-a.oregon-postgres.render.com/hospital_management_2rij
   ```

### Step 2: Create Render Web Service (NestJS Backend)
1. In Render Dashboard, click **New +** -> **Web Service**.
2. Connect your Git repository.
3. Configure settings:
   * **Name**: `medicore-backend-api`
   * **Root Directory**: `backend`
   * **Environment**: `Node`
   * **Build Command**: `npm install && npm run build`
   * **Start Command**: `npm run start:prod`
4. Add **Environment Variables** in Render:

| Key | Example Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_URL` | `postgresql://hospital_management_2rij_user:...@...render.com/hospital_db` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | `your_super_secret_production_jwt_key_2026` |
| `JWT_EXPIRES_IN` | `7d` |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `R2_ACCOUNT_ID` | `<your_cloudflare_account_id>` |
| `R2_ACCESS_KEY_ID` | `<your_r2_access_key>` |
| `R2_SECRET_ACCESS_KEY` | `<your_r2_secret_key>` |
| `R2_BUCKET_NAME` | `medicore-hospital-pdfs` |
| `R2_PUBLIC_URL` | `https://pub-xxxxxx.r2.dev` |

5. Click **Deploy Web Service**. Render will build and deploy the NestJS API at `https://medicore-backend-api.onrender.com`.

---

## 2. Frontend Deployment on Vercel

### Step 1: Push Project to GitHub
Ensure all latest code is committed and pushed to your GitHub repository:
```bash
git add .
git commit -m "Add tablet store inventory feature and deployment guides"
git push origin main
```

### Step 2: Import Repository in Vercel
1. Log in to [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New...** -> **Project**.
3. Select your GitHub repository.

### Step 3: Configure Project Settings
* **Framework Preset**: Next.js
* **Root Directory**: Select `frontend`
* **Build Command**: `npm run build`
* **Output Directory**: `.next`

### Step 4: Add Environment Variables in Vercel
Under **Environment Variables**, add:

| Key | Value |
| :--- | :--- |
| `NEXT_PUBLIC_API_URL` | `https://medicore-backend-api.onrender.com` |

4. Click **Deploy**. Vercel will build the frontend and provide your live application link (e.g., `https://medicore-hms.vercel.app`).

---

## 3. Cloudflare R2 Storage & PDF Link Interlinking Guide

### What is Cloudflare R2?
Cloudflare R2 is an S3-compatible object storage with **$0 egress fees**, ideal for serving PDF invoices, prescriptions, and medical records to clients.

---

### How to Interlink Cloudflare R2 PDF Links in `.md` Markdown Files

When storing PDFs in Cloudflare R2, files are assigned a public URL structure:
```text
https://<PUBLIC_R2_SUBDOMAIN>.r2.dev/<folder>/<filename>.pdf
```
Example: `https://pub-medicore.r2.dev/prescriptions/RX-1001_Invoice.pdf`

#### Method A: Standard Markdown Link
Use clean GitHub-style Markdown syntax to interlink R2 PDF links inside `.md` documentation files:
```markdown
[📥 Download Prescription PDF (RX-1001)](https://pub-medicore.r2.dev/prescriptions/RX-1001_Invoice.pdf)
```
*Output*: [📥 Download Prescription PDF (RX-1001)](https://pub-medicore.r2.dev/prescriptions/RX-1001_Invoice.pdf)

#### Method B: Badge / Button Interlink
Create visually appealing PDF download buttons in `.md` files using Shields badges:
```markdown
[![Download PDF Invoice](https://img.shields.io/badge/PDF-Download%20Invoice-blue?style=for-the-badge&logo=adobeacrobatreader)](https://pub-medicore.r2.dev/prescriptions/RX-1001_Invoice.pdf)
```

#### Method C: HTML Embed inside Markdown
To display an interactive PDF viewer directly inside markdown-rendered pages or GitHub documentation:
```html
<iframe 
  src="https://pub-medicore.r2.dev/prescriptions/RX-1001_Invoice.pdf" 
  width="100%" 
  height="500px" 
  style="border: 1px solid #ccc; border-radius: 8px;">
</iframe>
```

---

### How to Open & Preview R2 PDF Links in Next.js Frontend

In Next.js component (`frontend/src/app/dashboard/pharmacist/page.tsx`):

```tsx
// 1. Direct Public Cloudflare R2 Link
const handleOpenR2Pdf = (r2PublicUrl: string) => {
  window.open(r2PublicUrl, '_blank');
};

// 2. Presigned Authenticated Download Link from NestJS API
const handleDownloadPrescription = async (prescriptionId: string) => {
  try {
    const res = await api.get(`/pharmacy/prescriptions/${prescriptionId}/pdf`);
    // Opens generated PDF directly in browser
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (err) {
    toast.error('Unable to fetch PDF invoice');
  }
};
```

---

## 4. Pharmacy Store Tablets Feature Overview

The Pharmacy portal now includes a dedicated tab: **💊 Available Store Tablets**.

### Features:
1. **One-by-One Tablet Entry**: Add tablets individually with:
   - **Name**: (e.g., Paracetamol, Amoxicillin, Ibuprofen)
   - **Power / Dosage**: (e.g., 500mg, 200mg, 10mg, 650mg)
   - **Price**: Unit cost per tablet (₹ / $)
   - **MFG Date**: Manufacturing Date
   - **Expiry Date**: Expiration Date (with auto-warning for expired tablets)
   - **Stock Quantity**: Number of units available in stock
   - **Category & Manufacturer**: e.g., Analgesic, Antibiotic, Antacid
2. **Instant Search & Filter**: Search tablets by name, power rating, or category.
3. **KPI Analytics Cards**:
   - Total Tablet Varieties
   - Total Available Units
   - Low Stock Alert (<100 units)
   - Category Breakdown
4. **Full Edit & Delete Controls**: Update stock count or remove discontinued tablets.
