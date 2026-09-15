# 🏥 MediCore HMS — API Endpoints & Testing Guide

> **Base API URL**: `http://localhost:3001/api`  
> **WebSocket URL**: `ws://localhost:3001`  
> **Authentication Header**: `Authorization: Bearer <JWT_ACCESS_TOKEN>`

---

## 🔑 1. Authentication Module (`/api/auth`)

### 1.1 Login User
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/auth/login`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
```json
{
  "email": "admin@hospital.com",
  "password": "demo"
}
```
- **Demo Credentials Available**:
  - **Admin**: `admin@hospital.com` / `demo`
  - **Doctor**: `doctor@hospital.com` / `demo`
  - **Receptionist**: `reception@hospital.com` / `demo`
  - **Nurse**: `nurse@hospital.com` / `demo`
  - **Pharmacist**: `pharmacy@hospital.com` / `demo`
  - **Lab Technician**: `lab@hospital.com` / `demo`
- **Expected Response (`200 OK`)**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "user": {
    "id": "usr-admin-01",
    "email": "admin@hospital.com",
    "firstName": "System",
    "lastName": "Administrator",
    "role": "admin",
    "department": "IT Operations"
  }
}
```

### 1.2 Register User
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/auth/register`
- **Request Body**:
```json
{
  "email": "newdoctor@hospital.com",
  "password": "password123",
  "firstName": "David",
  "lastName": "Miller",
  "role": "doctor",
  "department": "Cardiology",
  "phone": "+1987654321"
}
```

---

## 👥 2. User Management Module (`/api/users`)
*Requires `Authorization: Bearer <JWT_TOKEN>`*

### 2.1 Get All Staff Users
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/users`

### 2.2 Get Doctors by Department
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/users/doctors?department=Neurology`

### 2.3 Create New Employee/Staff User
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/users/employee`
- **Request Body**:
```json
{
  "email": "nurse.sarah@hospital.com",
  "password": "password123",
  "firstName": "Sarah",
  "lastName": "Connor",
  "role": "nurse",
  "department": "ICU",
  "phone": "+1555019283"
}
```

### 2.4 Approve User Access
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/users/:id/approve`

### 2.5 Reset Staff Password
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/users/:id/reset-password`
- **Request Body**:
```json
{
  "newPassword": "newSecurePassword123"
}
```

### 2.6 Delete User
- **Method**: `DELETE`
- **URL**: `http://localhost:3001/api/users/:id`

---

## 🏥 3. Patient Medical Records (`/api/patients`)

### 3.1 Register New Patient
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/patients`
- **Request Body**:
```json
{
  "firstName": "Robert",
  "lastName": "Vance",
  "dateOfBirth": "1985-06-15",
  "gender": "Male",
  "phone": "+14155552671",
  "email": "robert.vance@example.com",
  "address": "742 Evergreen Terrace, Springfield",
  "bloodGroup": "O+",
  "emergencyContact": "+14155559999",
  "medicalHistoryNotes": "Mild hypertension"
}
```

### 3.2 List All Patients
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/patients`

### 3.3 Search Patients
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/patients/search?q=Robert`

### 3.4 Check If Phone Exists
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/patients/check-phone?phone=+14155552671`

### 3.5 Get Patient Details
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/patients/:id`

---

## 📋 4. Receptionist & OPD Appointments (`/api/receptionist`)

### 4.1 Create Appointment & OPD Token
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/receptionist/appointments`
- **Request Body**:
```json
{
  "patientId": "NMH26000001",
  "patientName": "Robert Vance",
  "doctorName": "Dr. Sarah Jenkins",
  "department": "Neurology",
  "appointmentDate": "2026-09-15T10:00:00.000Z",
  "notes": "Severe headache and dizziness"
}
```

### 4.2 Get Today's OPD Appointments
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/receptionist/appointments/today`

### 4.3 Get Real-Time OPD Token Queue
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/receptionist/opd-queue`

---

## 🩺 5. Doctor Portal & Consultations (`/api/doctor`)

### 5.1 Create Clinical Consultation & Diagnosis
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/doctor/consultations`
- **Request Body**:
```json
{
  "patientId": "NMH26000001",
  "patientName": "Robert Vance",
  "diagnosis": "Migraine with Aura",
  "symptoms": "Throbbing headache, light sensitivity",
  "clinicalNotes": "Advised MRI brain scan and bed rest",
  "prescribedMedicines": "Sumatriptan 50mg, Paracetamol 500mg"
}
```

### 5.2 Get Doctor's Assigned Appointments
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/doctor/appointments/my`

### 5.3 Get Patient Full Electronic Health Record (EHR)
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/doctor/patient/:patientId/ehr`

### 5.4 Discharge Patient & Generate Summary PDF
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/doctor/patient/:patientId/discharge`
- **Request Body**:
```json
{
  "dischargeReason": "Recovered / Stable",
  "dischargeSummary": "Patient symptoms resolved under observation",
  "followUpDate": "2026-09-22"
}
```

### 5.5 Download Discharge Summary PDF
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/doctor/discharges/:dischargeId/pdf`

### 5.6 Download Small OP PDF Slip & Token Document
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/doctor/opd-slip/:patientId/pdf`
- **Description**: Generates and downloads a small OP PDF slip containing patient details, token number, doctor name, diagnosis, clinical notes, and 3-month token validity dates.

---

## 💉 6. Nurse Portal & Vitals Tracking (`/api/nurse`)

### 6.1 Record Patient Vitals
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/nurse/vitals`
- **Request Body**:
```json
{
  "patientId": "NMH26000001",
  "patientName": "Robert Vance",
  "temperature": "98.6°F",
  "bloodPressure": "120/80 mmHg",
  "heartRate": "72 bpm",
  "oxygenSaturation": "99%",
  "respiratoryRate": "16 bpm",
  "weight": "75 kg",
  "height": "178 cm",
  "triagePriority": "Routine",
  "notes": "Patient calm and comfortable"
}
```

### 6.2 Get Vitals for Patient
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/nurse/vitals/patient/:patientId`

### 6.3 Get Patient Nursing Medical History
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/nurse/patient/:patientId/history`

---

## 💊 7. Pharmacy & Inventory Management (`/api/pharmacy`)

### 7.1 Create Prescription Request
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/pharmacy/prescriptions`
- **Request Body**:
```json
{
  "patientId": "NMH26000001",
  "patientName": "Robert Vance",
  "doctorName": "Dr. Sarah Jenkins",
  "items": [
    { "medicineName": "Paracetamol 500mg", "dosage": "1-0-1", "durationDays": 5, "quantity": 10, "unitPrice": 2.50 },
    { "medicineName": "Amoxicillin 500mg", "dosage": "1-1-1", "durationDays": 7, "quantity": 21, "unitPrice": 5.00 }
  ]
}
```

### 7.2 List Pending Prescriptions
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/pharmacy/prescriptions/pending`

### 7.3 Dispense Prescription & Invoice
- **Method**: `PUT`
- **URL**: `http://localhost:3001/api/pharmacy/prescriptions/:id/dispense`
- **Request Body**:
```json
{
  "notes": "Dispensed full 7-day course"
}
```

### 7.4 Download Pharmacy Invoice PDF
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/pharmacy/prescriptions/:id/pdf`

### 7.5 Medicine Inventory (Tablets)
- **Get All Tablets**: `GET http://localhost:3001/api/pharmacy/tablets`
- **Add New Tablet**: `POST http://localhost:3001/api/pharmacy/tablets`
```json
{
  "name": "Ibuprofen 400mg",
  "category": "Analgesic",
  "stockCount": 500,
  "unitPrice": 1.50,
  "manufacturer": "PharmaCorp",
  "batchNumber": "BATCH-2026-09"
}
```

---

## 🧪 8. Laboratory & Diagnostics (`/api/lab`)

### 8.1 Create Lab Order Request
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/lab`
- **Request Body**:
```json
{
  "patientId": "NMH26000001",
  "patientName": "Robert Vance",
  "testName": "Complete Blood Count (CBC)",
  "category": "Pathology",
  "sampleType": "Blood",
  "priority": "URGENT",
  "notes": "Fasting sample collected"
}
```

### 8.2 List Lab Tests (with Filters)
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/lab?status=PENDING` (Options: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `URGENT`)

### 8.3 Update Lab Status
- **Method**: `PUT`
- **URL**: `http://localhost:3001/api/lab/:id/status`
- **Request Body**:
```json
{
  "status": "IN_PROGRESS"
}
```

### 8.4 Record Lab Results & File URL
- **Method**: `PUT`
- **URL**: `http://localhost:3001/api/lab/:id/results`
- **Request Body**:
```json
{
  "resultSummary": "Hemoglobin: 14.2 g/dL (Normal), WBC: 7,500/uL",
  "reportUrl": "https://r2.medicore-hms.com/reports/sample_cbc.pdf",
  "testValues": "{\"Hemoglobin\": \"14.2 g/dL\", \"Platelets\": \"250,000/uL\"}"
}
```

---

## 🛏️ 9. Bed & Ward Management (`/api/beds`)

### 9.1 Get Wards
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/beds/wards`

### 9.2 Get Beds Availability
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/beds`

### 9.3 Create Bed Admission Request
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/beds/admissions`
- **Request Body**:
```json
{
  "patientId": "NMH26000001",
  "patientName": "Robert Vance",
  "wardType": "ICU",
  "reasonForAdmission": "Post-op monitoring"
}
```

### 9.4 Allocate Bed to Patient
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/beds/allocate`
- **Request Body**:
```json
{
  "admissionId": "adm-001",
  "bedId": "bed-icu-01"
}
```

---

## 📊 10. Management & Analytics (`/api/management`)

### 10.1 Get Management Dashboard Overview Metrics
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/management/dashboard`

### 10.2 Broadcast Announcement Notification
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/management/broadcast`
- **Request Body**:
```json
{
  "title": "Hospital Staff Meeting",
  "message": "All clinical staff meeting at 4:00 PM in Main Conference Room",
  "targetRole": "doctor"
}
```

---

## 🔔 11. Notifications System (`/api/notifications`)

### 11.1 Get Notifications for Logged-In User
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/notifications`

### 11.2 Mark All Notifications Read
- **Method**: `PATCH`
- **URL**: `http://localhost:3001/api/notifications/read-all`

### 11.3 System Monitoring Metrics
- **Method**: `GET`
- **URL**: `http://localhost:3001/api/notifications/monitoring/metrics`

---

## 📁 12. File Storage Upload (`/api/files`)

### 12.1 Upload Report / Attachment File
- **Method**: `POST`
- **URL**: `http://localhost:3001/api/files/upload`
- **Headers**: `Content-Type: multipart/form-data`
- **Body Form Data**: `file` (Binary File)
