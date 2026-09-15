# MediCore HMS - Complete Project Flow, Multi-Portal Architecture & Rate Limiting Guide

This document provides a comprehensive overview of the **MediCore Hospital Management System (HMS)** architecture, role-based workflows, real-time patient discharge synchronization, dedicated Laboratory Portal, and rate limiting testing strategies.

---

## 1. System Architecture Overview

MediCore HMS is built with a modern, decoupled architecture designed for high availability, real-time telemetry, and secure hospital administration.

```
+-----------------------------------------------------------------------------------+
|                                 FRONTEND (Next.js 14)                             |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
|  | Reception Portal |  |  Doctor Dashboard |  | Nurse Dashboard |  | Lab Portal | |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
|  | Pharmacy Portal  |  | Management Portal |  |  Admin Portal   |  | Patient    | |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
+------------------------------------------+----------------------------------------+
                                           | HTTP REST / WebSocket (Socket.io)
+------------------------------------------v----------------------------------------+
|                                BACKEND (NestJS + TypeORM)                         |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
|  | Auth & Users     |  | Patients Module   |  | Beds & Wards    |  | Lab Module | |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
|  | Pharmacy Module  |  | Doctor Module     |  | Notifications   |  | Throttler  | |
|  +------------------+  +-------------------+  +-----------------+  +------------+ |
+------------------------------------------+----------------------------------------+
                                           | Database & Storage
+------------------------------------------v----------------------------------------+
|                      PostgreSQL DB  |  Cloudflare R2 Storage                      |
+-----------------------------------------------------------------------------------+
```

- **Frontend**: Next.js 14 App Router with React, Glassmorphism CSS, Toast notifications, and Socket.io client hooks.
- **Backend**: NestJS framework with TypeScript, TypeORM, `@nestjs/throttler` (Rate Limiting), Socket.io WebSocket Gateway (`NotificationsGateway`), and JWT Authentication.
- **Database**: PostgreSQL storing Patients, Users, Wards, Beds, Admissions, Prescriptions, Lab Tests, and Notifications.
- **File Storage**: Cloudflare R2 / AWS S3 S3-compatible cloud storage for discharge summaries and lab test reports.

---

## 2. End-to-End Patient Lifecycle Flow

```
 1. OPD Registration & Queue Token
    [Receptionist Portal] -> Registers Patient & assigns OPD Token (TK-26-000001).
           │
           ▼
 2. Triage & Vital Signs Recording
    [Nurse Dashboard] -> Records Blood Pressure, Heart Rate, SpO2, Temperature.
           │
           ▼
 3. Doctor Consultation & Action Completion
    [Doctor Dashboard] -> Examines patient, records diagnosis, orders Lab Tests.
    -> Doctor clicks 'Complete Action & Generate Small OP PDF'.
    -> Patient marked COMPLETED & automatically removed from active waiting queue.
    -> Small OP PDF slip generated with 3-Month Token Validity dates.
    -> Records moved to Receptionist & Management 'Previous Records'.
           │
           ├─────────────────────────────────────────────┐
           ▼                                             ▼
 4A. Laboratory Testing                      4B. Pharmacy Dispensing
    [Lab Portal]                                [Pharmacist Dashboard]
    -> Samples collected & tested               -> Dispenses prescribed tablets
    -> Results & R2 report uploaded             -> Stock inventory auto-deducted
    -> Doctor & Nurse notified                  -> Billing auto-calculated
           │                                             │
           └──────────────────────┬──────────────────────┘
                                  ▼
 5. Inpatient Admission & Bed Allocation
    [Beds & Wards View] -> Patient allocated bed (e.g. BED-ICU-101) if required.
                                  │
                                  ▼
 6. Patient Discharge & System-Wide Synchronization
    [Doctor / Beds Module] -> Patient discharged.
    -> Patient status updated to 'DISCHARGED'.
    -> Bed freed & marked 'CLEANING'.
    -> Real-time WebSocket alert broadcasted to ALL portals (Receptionist, Nurse, Doctor, Pharmacist, Management, Lab).
```

---

## 3. Real-Time Patient Discharge Synchronization Across All Portals

When a patient is discharged (via Doctor Consultation, Bed Management, or Receptionist/Nurse actions):

1. **Database Status Update**:
   - `Patient.status` is set to `'discharged'`.
   - `Bed.status` transitions from `'occupied'` to `'cleaning'`.
   - `Admission.status` transitions to `'discharged'`.

2. **WebSocket Multi-Portal Broadcast**:
   - The backend `NotificationsService` broadcasts a live WebSocket notification to all active logged-in users across **ALL 6 ROLES**:
     - **Receptionist**: OPD Queue and bed allocation tables reflect patient discharge.
     - **Nurse**: Nursing care sheets, vitals monitor, and bed maps update instantly.
     - **Doctor**: Patient files and active consultation lists mark patient as discharged.
     - **Pharmacist**: Active medication dispensing orders flag discharged status.
     - **Management**: Financial summary, occupied bed counts, and discharge logs reflect instant changes.
     - **Lab Technician**: Pending and active lab test samples show a prominent `🚨 DISCHARGED PATIENT` alert badge.

---

## 4. Laboratory Portal (`/dashboard/lab_technician`)

The **Laboratory Portal** is a dedicated environment for Lab Technicians and Pathologists.

### Default Login Credentials:
- **Email**: `lab@hospital.com`
- **Password**: `demo123`
- **Role**: `lab_technician`
- **Portal URL**: `http://localhost:3000/dashboard/lab_technician` (also aliased at `/dashboard/lab`)

### Key Features:
1. **Real-time Diagnostic Metrics**: Displays total lab orders, pending samples, active testing in-progress, completed test reports, and urgent priority samples.
2. **Order Management**: Search by Patient ID, Patient Name, or Test Name across Pathology, Biochemistry, Microbiology, Radiology, and Hematology categories.
3. **New Test Request Modal**: Order tests directly with sample type selection (Blood, Urine, Swab, Tissue) and priority flagging (`NORMAL` vs `URGENT`).
4. **Result Recording & Report Upload**: Input detailed metric findings, reference ranges, and attach Cloudflare R2 / PDF report URLs.
5. **Patient Discharge Guard**: Displays explicit warnings if a test belongs to a patient who has been discharged.

---

## 5. API Rate Limiting & Testing Guide

### How Rate Limiting Works in MediCore HMS
MediCore HMS utilizes NestJS `@nestjs/throttler` configured globally in `app.module.ts`:

```typescript
ThrottlerModule.forRoot([
  {
    name: 'default',
    ttl: 60000, // Time-to-Live window: 60,000 milliseconds (1 minute)
    limit: 100, // Maximum allowed requests per IP within the TTL window
  },
])
```

- **ThrottlerGuard** is applied globally via `APP_GUARD`.
- Any IP address exceeding 100 HTTP requests within a 60-second window receives an **HTTP 429 Too Many Requests** response with JSON error details:
  ```json
  {
    "statusCode": 429,
    "message": "ThrottlerException: Too Many Requests"
  }
  ```

---

### Step-by-Step Instructions: How to Test Rate Limiting

#### Option A: PowerShell Script (Windows)
Open PowerShell and run the following loop command to send 110 requests rapidly to the backend API:

```powershell
$uri = "http://localhost:5000/patients"
for ($i = 1; $i -le 110; $i++) {
    try {
        $response = Invoke-RestMethod -Uri $uri -Method Get
        Write-Host "Request #$i - Status: 200 OK" -ForegroundColor Green
    } catch {
        Write-Host "Request #$i - Status: 429 Too Many Requests (Rate Limit Triggered!)" -ForegroundColor Red
        Write-Host $_.Exception.Message
    }
}
```

*Expected Result*: Requests 1 to 100 will succeed (HTTP 200), and requests 101 to 110 will fail with HTTP 429 Rate Limit Exceeded.

---

#### Option B: cURL Command (Terminal / Bash / Git Bash)

Run a bash loop in terminal:

```bash
for i in {1..110}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/patients)
  echo "Request #$i: HTTP Status $code"
  if [ "$code" -eq 429 ]; then
    echo "🚨 Rate Limiting successfully triggered at request #$i!"
  fi
done
```

---

#### Option C: Postman Runner
1. Create a GET request to `http://localhost:5000/patients`.
2. Open **Postman Collection Runner**.
3. Set iterations to `120` and delay to `0 ms`.
4. Click **Run Collection**.
5. Observe that after 100 requests, subsequent calls return **Status: 429 Too Many Requests**.

---

## 6. Default Demo System Accounts

| Role | Email | Password | Primary Portal Route |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@hospital.com` | `demo123` | `/dashboard/admin` |
| **Receptionist** | `reception@hospital.com` | `demo123` | `/dashboard/receptionist` |
| **Nurse** | `nurse@hospital.com` | `demo123` | `/dashboard/nurse` |
| **Doctor** | `doctor@hospital.com` | `demo123` | `/dashboard/doctor` |
| **Pharmacist** | `pharmacy@hospital.com` | `demo123` | `/dashboard/pharmacist` |
| **Management** | `manager@hospital.com` | `demo123` | `/dashboard/management` |
| **Lab Tech (NEW)** | `lab@hospital.com` | `demo123` | `/dashboard/lab` |

---

## 7. How to Run locally

### Backend Setup (NestJS):
```bash
cd backend
npm install
npm run build
npm run start:dev
```
*Backend runs on `http://localhost:5000` (or `PORT` specified in `.env`).*

### Frontend Setup (Next.js 14):
```bash
cd frontend
npm install
npm run dev
```
*Frontend runs on `http://localhost:3000`.*
