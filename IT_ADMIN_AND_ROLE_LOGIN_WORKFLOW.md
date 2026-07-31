# MediCore HMS — Comprehensive Architecture, Database Schema & Project Structure

## 🏥 Project Overview & Architecture
MediCore Hospital Management System is a full-stack Enterprise Solution built with:
- **Frontend**: Next.js 14, React 18, TypeScript, TailwindCSS/Vanilla CSS custom theme engine, Socket.IO Client.
- **Backend**: NestJS, TypeORM, PostgreSQL, Socket.IO Server, JWT Auth, Bcrypt security.
- **Access Control & Routing**: Role-based redirection engine linking user emails directly to allocated dashboard routes.

---

## 📁 Repository Directory & Project Structure

```
c:\Users\user\Documents\nextjs\
├── backend/                              # NestJS Backend API Service
│   ├── src/
│   │   ├── main.ts                       # Entry point (Port 3001)
│   │   ├── app.module.ts                 # Core App Module with TypeORM & Config
│   │   ├── auth/                         # JWT Authentication & Employee Validation
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.module.ts
│   │   │   └── jwt-auth.guard.ts
│   │   ├── users/                        # Employee & User Management Module
│   │   │   ├── user.entity.ts            # User DB Entity (Role, Permissions, Status)
│   │   │   ├── users.controller.ts
│   │   │   ├── users.service.ts
│   │   │   └── users.module.ts
│   │   ├── beds/                         # Hospital Bed & Ward Management Module
│   │   │   ├── bed.entity.ts             # Ward, Bed, and Admission TypeORM Entities
│   │   │   ├── beds.controller.ts        # Bed Allocation, Status & Ward Endpoints
│   │   │   ├── beds.service.ts           # Business logic & Seeding
│   │   │   └── beds.module.ts
│   │   ├── patients/                     # Patient EHR Database Module
│   │   │   ├── patient.entity.ts
│   │   │   ├── patients.controller.ts
│   │   │   ├── patients.service.ts
│   │   │   └── patients.module.ts
│   │   ├── receptionist/                 # Appointment Scheduling & Triage
│   │   │   ├── appointment.entity.ts
│   │   │   ├── receptionist.controller.ts
│   │   │   ├── receptionist.service.ts
│   │   │   └── receptionist.module.ts
│   │   ├── nurse/                        # Clinical Vitals & Inpatient Care
│   │   │   ├── vital.entity.ts
│   │   │   ├── nurse.controller.ts
│   │   │   ├── nurse.service.ts
│   │   │   └── nurse.module.ts
│   │   ├── pharmacy/                     # Prescription Dispensing & Inventory
│   │   │   ├── prescription.entity.ts
│   │   │   ├── pharmacy.controller.ts
│   │   │   ├── pharmacy.service.ts
│   │   │   └── pharmacy.module.ts
│   │   ├── management/                   # Executive Stats & Staff Broadcasting
│   │   │   ├── management.controller.ts
│   │   │   ├── management.service.ts
│   │   │   └── management.module.ts
│   │   ├── notifications/                # Real-Time Socket.IO Alert Gateway
│   │   │   ├── notification.entity.ts
│   │   │   ├── notifications.gateway.ts
│   │   │   ├── notifications.service.ts
│   │   │   └── notifications.module.ts
│   │   └── files/                        # Medical Record Document Uploads
│   │       ├── files.controller.ts
│   │       └── files.service.ts
│   └── package.json
│
├── frontend/                             # Next.js Frontend Web Application
│   ├── src/
│   │   ├── app/                          # Next.js App Router Structure
│   │   │   ├── layout.tsx                # Root HTML & Metadata
│   │   │   ├── page.tsx                  # Root Session & Role Redirector
│   │   │   ├── globals.css               # Dynamic HSL Color Theme Engine & Styles
│   │   │   ├── login/                    # Email/Password Role-Based Sign In
│   │   │   │   └── page.tsx
│   │   │   └── dashboard/
│   │   │       ├── admin/                # IT Admin Control Hub
│   │   │       │   ├── page.tsx          # Employee Creation, Form Validation, Role Engine
│   │   │       │   ├── users/            # Full User Directory & Reset Controls
│   │   │       │   ├── beds/             # Bed & Ward Management Grid System
│   │   │       │   └── patients/         # System-Wide EHR Patient Database
│   │   │       ├── receptionist/         # Patient Registration & Appointments
│   │   │       ├── nurse/                # Clinical Vitals Recording & Bed Overview
│   │   │       ├── pharmacist/           # Prescription Processing & Fulfillment
│   │   │       ├── management/           # Executive Stats & Staff Announcements
│   │   │       └── patient/              # Patient EHR Portal & History
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx       # Sidebar, Topbar & Theme Selector Layout
│   │   │   ├── Sidebar.tsx               # Dynamic Role Navigation Menu
│   │   │   ├── CenteredLoader.tsx        # Hospital Pulse Ring Centered Loader
│   │   │   └── ThemeSelector.tsx         # Branding Theme Switcher Component
│   │   └── lib/
│   │       ├── api.ts                    # Axios Interceptors with Auth Bearer Token
│   │       ├── auth.ts                   # Token Storage (Cookie + LocalStorage)
│   │       ├── theme.ts                  # Dynamic HSL Branding Token Switcher
│   │       └── useSocket.ts              # Real-Time Socket.IO Hook
│   └── package.json
└── IT_ADMIN_AND_ROLE_LOGIN_WORKFLOW.md   # Documentation Reference
```

---

## 🛢️ PostgreSQL Database Table Schemas

All entities are auto-synchronized with PostgreSQL (`database: hospital_db`).

### 1. `users` Table (Employee Authentication & Access Control)
| Column | Data Type | Key / Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | Primary Key | Unique user identifier |
| `email` | VARCHAR | UNIQUE, NOT NULL | Login ID used for role redirection |
| `password` | VARCHAR | NOT NULL | Bcrypt hashed credentials |
| `firstName` | VARCHAR | NOT NULL | Employee first name |
| `lastName` | VARCHAR | NOT NULL | Employee last name |
| `role` | ENUM | NOT NULL | `admin`, `receptionist`, `nurse`, `pharmacist`, `management`, `patient` |
| `department`| VARCHAR | Nullable | Assigned hospital department |
| `phone` | VARCHAR | Nullable | Contact number |
| `isActive` | BOOLEAN | DEFAULT true | Enables/disables system access |
| `isApproved`| BOOLEAN | DEFAULT true | Admin approval flag for sign-ups |
| `permissions`| TEXT[] | Nullable | Granular feature permissions array |
| `createdAt` | TIMESTAMP| DEFAULT NOW() | Account creation date |

### 2. `wards` Table (Hospital Ward Management)
| Column | Data Type | Key / Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | Primary Key | Ward ID |
| `name` | VARCHAR | UNIQUE, NOT NULL | e.g. `ICU (Intensive Care)`, `General Male Ward` |
| `floor` | VARCHAR | Nullable | e.g. `2nd Floor - Wing A` |
| `description`| VARCHAR | Nullable | Ward capacity & specialty |
| `isActive` | BOOLEAN | DEFAULT true | Active status |

### 3. `beds` Table (Bed Allocation & Status Tracking)
| Column | Data Type | Key / Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | Primary Key | Bed ID |
| `bedNumber` | VARCHAR | UNIQUE, NOT NULL | e.g. `BED-ICU-101`, `BED-GEN-204` |
| `roomNumber`| VARCHAR | NOT NULL | e.g. `Room 101`, `Room 204` |
| `status` | ENUM | DEFAULT 'vacant' | `vacant`, `occupied`, `cleaning`, `maintenance` |
| `wardId` | UUID | Foreign Key → `wards.id` | Associated ward |
| `currentPatientId` | VARCHAR | Nullable | Currently admitted patient ID |
| `currentPatientName` | VARCHAR | Nullable | Admitted patient full name |
| `admissionDate` | VARCHAR | Nullable | ISO timestamp of bed assignment |

### 4. `admissions` Table (Patient Pending Admissions Queue)
| Column | Data Type | Key / Constraints | Description |
|:---|:---|:---|:---|
| `id` | UUID | Primary Key | Admission request ID |
| `patientId` | VARCHAR | NOT NULL | Patient MRN number |
| `patientName` | VARCHAR | NOT NULL | Patient name |
| `doctorName` | VARCHAR | Nullable | Requesting physician |
| `diagnosis` | VARCHAR | Nullable | Admitting condition |
| `requestedWard`| VARCHAR | Nullable | Target ward requirement |
| `allocatedBedNumber` | VARCHAR | Nullable | Assigned bed number |
| `status` | ENUM | DEFAULT 'pending' | `pending`, `admitted`, `discharged`, `cancelled` |
| `admittedAt`| TIMESTAMP| Nullable | Timestamp when bed assigned |
| `dischargedAt`| TIMESTAMP| Nullable | Discharge timestamp |

### 5. Additional Auxiliary Tables
- `patients` — Electronic Health Records, MRN tracking, blood group, emergency contacts.
- `appointments` — Scheduling, doctor assignment, status (`scheduled`, `completed`).
- `vitals` — Temperature, blood pressure, heart rate, oxygen saturation, pain scale.
- `prescriptions` — Doctor prescriptions with JSON medicine array, dosage, and cost.
- `notifications` — System notifications & real-time Socket.IO broadcasts.

---

## 🔑 Pre-Configured IT Admin & Employee Logins

| Employee Email | Password | Role | Redirect Target |
|:---|:---|:---|:---|
| `admin@hospital.com` | `demo123` | **IT Admin** | `/dashboard/admin` |
| `reception@hospital.com` | `demo123` | **Receptionist** | `/dashboard/receptionist` |
| `nurse@hospital.com` | `nurse` / `demo123` | **Nurse** | `/dashboard/nurse` |
| `pharmacy@hospital.com` | `demo123` | **Pharmacist** | `/dashboard/pharmacist` |
| `manager@hospital.com` | `demo123` | **Management** | `/dashboard/management` |
