# 🏥 Hospital Management System (MediCore HMS)
## Database Setup, Route Mapping, and Default Credentials Guide

---

## 1. 🐘 PostgreSQL & pgAdmin 4 Database Setup

### Database Configuration Details
* **Host**: `localhost`
* **Port**: `5432`
* **Username**: `postgres`
* **Password**: `postgres` (or your local PostgreSQL user password)
* **Database Name**: `hospital_db`

---

### Step-by-Step pgAdmin 4 Setup Instructions

1. **Open pgAdmin 4** on your system and log in with your master password.
2. **Connect to PostgreSQL Server**:
   - In the left sidebar, expand **Servers** -> **PostgreSQL 15/16** (or your installed version).
   - Enter your `postgres` superuser password when prompted.
3. **Create the Database**:
   - Right-click **Databases** -> **Create** -> **Database...**
   - **Database name**: Type `hospital_db`
   - **Owner**: Select `postgres`
   - Click **Save**.
4. **Alternative via SQL Query Tool**:
   - Open **Query Tool** on pgAdmin and execute:
   ```sql
   CREATE DATABASE hospital_db;
   ```
5. **Backend Configuration (`backend/.env`)**:
   Ensure your `backend/.env` file contains the matching database settings:
   ```env
   PORT=3001
   DB_HOST=localhost
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=postgres
   DB_NAME=hospital_db
   JWT_SECRET=hospital_super_secret_jwt_key_2024
   JWT_EXPIRES_IN=7d
   UPLOAD_DIR=./uploads
   FRONTEND_URL=http://localhost:3000
   ```
   > **Note**: NestJS TypeORM is configured with `synchronize: true` in `app.module.ts`. When you start the backend (`npm run start:dev`), TypeORM will automatically create all tables (`users`, `patients`, `appointments`, `vitals`, `prescriptions`, `notifications`) inside `hospital_db`.

---

## 2. 🩺 Nurse Clinical Dashboard & Medical History System

### Nurse Features Implemented:
1. **Clinical Vitals Check & Triage Note Intake**:
   - Intake form for vitals (`temperature`, `bloodPressure`, `heartRate`, `oxygenSaturation`, `respiratoryRate`, `bloodSugar`, `weight`, `height`, `pain scale`).
   - Dedicated `triageNotes` observation box and `triagePriority` level (`Routine`, `High`, `Urgent`, `Emergency`).
2. **Patient Medical History Profile Drawer**:
   - Dynamic popup modal showing full patient demographics, historical vitals logs, and test report summaries.
3. **Test Reports Overview**:
   - Interactive table for lab and radiology test report results (`CBC`, `CMP`, `Chest X-Ray`, `ECG`).
4. **Responsive Phone/Tablet Tab Bar**:
   - Scrollable tab switcher (`💗 Vitals Overview`, `📝 Triage & Priority Notes`, `🏥 Patient Medical History`, `🧪 Test Reports Overview`).
5. **Status Badges & Auto-Alerts**:
   - Automatic calculation of vital status (`normal`, `warning`, `critical`).
   - Triggering emergency notification alerts to management and receptionists when critical vitals are saved.

---

## 3. 🚦 Main Frontend Route File & Routing System

### Main Root Route File Location
The entry point and root router of the Next.js frontend is located at:
📁 **`frontend/src/app/page.tsx`**

```tsx
// File: frontend/src/app/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    const user = getUser();
    if (token && user) {
      router.push(`/dashboard/${user.role}`);
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="loading-spinner" />
    </div>
  );
}
```

### How the Frontend Routing Works
* **Next.js App Router Structure**: File-system based routing inside `frontend/src/app/`.
* **Authentication Guard & Auto Redirection**:
  - Visiting `/` checks local storage for JWT token and user session (`getToken()`, `getUser()`).
  - If authenticated: Redirects to role-based dashboard `/dashboard/[role]`.
  - If unauthenticated: Redirects to `/login`.

---

### 🗺️ Full Frontend Web Routes Directory

| URL Path | File Location | Description & Access |
| :--- | :--- | :--- |
| `/` | `src/app/page.tsx` | Main Entry Root (redirects to Login or Role Dashboard) |
| `/login` | `src/app/login/page.tsx` | Login Page with Quick Demo Buttons & Credentials |
| `/dashboard/nurse` | `src/app/dashboard/nurse/page.tsx` | Enhanced Nurse Clinical Dashboard, Triage Notes, Medical History |
| `/dashboard/receptionist` | `src/app/dashboard/receptionist/page.tsx` | Receptionist Home Dashboard (Stats & Recent Activity) |
| `/dashboard/receptionist/register` | `src/app/dashboard/receptionist/register/page.tsx` | Patient Registration & Automatic OPD Token Generation |
| `/dashboard/receptionist/opd-queue` | `src/app/dashboard/receptionist/opd-queue/page.tsx` | Live OPD Queue, Doctor Cards, Quick Walk-in Entry |
| `/dashboard/pharmacist` | `src/app/dashboard/pharmacist/page.tsx` | Pharmacy Dashboard (Prescription Dispensing & Billing) |
| `/dashboard/management` | `src/app/dashboard/management/page.tsx` | Management Dashboard (Analytics, Revenue & User Admin) |

---

### ⚡ Complete Backend API Endpoints (`http://localhost:3001/api`)

| Category | HTTP Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Nurse** | `POST` | `/api/nurse/vitals` | Record patient vitals, triage notes & priority |
| **Nurse** | `GET` | `/api/nurse/vitals` | Fetch all recorded vitals with status badges |
| **Nurse** | `GET` | `/api/nurse/patient/:id/history` | Retrieve full patient medical history & lab reports |
| **Patients** | `POST` | `/api/patients` | Register new patient & generate `opdTokenNumber` |
| **Pharmacy** | `POST` | `/api/pharmacy/prescriptions` | Create prescription & generate PDF invoice |
| **Pharmacy** | `GET` | `/api/pharmacy/prescriptions/:id/pdf` | Authenticated PDF file download & print stream |

---

## 4. 🔑 Default Database Logins & Demo Accounts

All demo accounts share the standard password:
👉 **Password:** `demo123`

| Role | Email Address | Password | Privileges & Dashboard Access |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@hospital.com` | `demo123` | Full System Access & User Management |
| **Receptionist** | `reception@hospital.com` | `demo123` | Patient Registration, OPD Tokens, Appointments |
| **Nurse** | `nurse@hospital.com` | `demo123` | Clinical Vitals, Triage Notes, Medical History |
| **Pharmacist** | `pharmacy@hospital.com` | `demo123` | Prescriptions, Medicine Dispensing |
| **Management** | `manager@hospital.com` | `demo123` | Analytics, Revenue Reports, Staff Monitoring |

---

## 🚀 How to Run Full Stack Application

### 1. Start Backend
```bash
cd backend
npm run start:dev
```
* Backend runs at: `http://localhost:3001`
* API base URL: `http://localhost:3001/api`

### 2. Start Frontend
```bash
cd frontend
npm run dev
```
* Frontend runs at: `http://localhost:3000`
