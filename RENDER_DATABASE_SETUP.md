# 🚀 Render PostgreSQL Database Integration Guide (MediCore HMS)

This guide provides complete instructions for connecting the **MediCore Hospital Management System backend (NestJS + TypeORM)** to your **Render PostgreSQL Database**.

---

## 📌 Render Database Summary

* **Render Dashboard URL**: [https://dashboard.render.com/d/dpg-daidu5jm8hqs73cf8fq0-a](https://dashboard.render.com/d/dpg-daidu5jm8hqs73cf8fq0-a)
* **Database Service ID**: `dpg-daidu5jm8hqs73cf8fq0-a`
* **Supported Connection Modes**:
  1. **Option 1: Full `DATABASE_URL`** (Recommended)
  2. **Option 2: Environment Variables (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL`)**

---

## 🛠️ Connection Credentials Overview

* **Internal Hostname**: `dpg-daidu5jm8hqs73cf8fq0-a`
* **External Hostname**: `dpg-daidu5jm8hqs73cf8fq0-a.oregon-postgres.render.com`
* **Port**: `5432`
* **Database Name**: `hospital_management_2rij`
* **Username**: `hospital_management_2rij_user`
* **Password**: `yRep7k93ywzvp9ta3Fpl1Bt6gKrkc4zq`
* **Internal Database URL**: `postgresql://hospital_management_2rij_user:yRep7k93ywzvp9ta3Fpl1Bt6gKrkc4zq@dpg-daidu5jm8hqs73cf8fq0-a/hospital_management_2rij`
* **External Database URL**: `postgresql://hospital_management_2rij_user:yRep7k93ywzvp9ta3Fpl1Bt6gKrkc4zq@dpg-daidu5jm8hqs73cf8fq0-a.oregon-postgres.render.com/hospital_management_2rij`

---

## ⚙️ Configured `backend/.env`

Your `backend/.env` file is configured with your exact Render credentials:

```env
PORT=3001

# Render Connection String
DATABASE_URL=postgresql://hospital_management_2rij_user:yRep7k93ywzvp9ta3Fpl1Bt6gKrkc4zq@dpg-daidu5jm8hqs73cf8fq0-a.oregon-postgres.render.com/hospital_management_2rij

# Individual connection parameters fallback
DB_HOST=dpg-daidu5jm8hqs73cf8fq0-a.oregon-postgres.render.com
DB_PORT=5432
DB_USERNAME=hospital_management_2rij_user
DB_PASSWORD=yRep7k93ywzvp9ta3Fpl1Bt6gKrkc4zq
DB_NAME=hospital_management_2rij
DB_SSL=true

JWT_SECRET=hospital_super_secret_jwt_key_2024
JWT_EXPIRES_IN=7d
UPLOAD_DIR=./uploads
FRONTEND_URL=http://localhost:3000
```

> ⚠️ **Note on SSL**: Render PostgreSQL requires SSL connections when accessed externally. The backend code in [`app.module.ts`](file:///c:/Users/user/Documents/nextjs/backend/src/app.module.ts) is already updated to automatically enable SSL (`rejectUnauthorized: false`) when `DATABASE_URL` or `DB_SSL=true` is used.

---

## 🧪 Step 3: Test and Synchronize Database

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Start the development server:
   ```bash
   npm run start:dev
   ```

3. TypeORM will connect to Render PostgreSQL and automatically generate all table schemas:
   * `users`
   * `patients`
   * `vitals`
   * `consultation_notes`
   * `prescriptions`
   * `beds`
   * `notifications`

---

## 🔑 Default Login Credentials

Once the backend starts, default seed data will allow logging into the system using the pre-configured accounts:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Admin** | `admin@hospital.com` | `demo123` |
| **Receptionist** | `reception@hospital.com` | `demo123` |
| **Nurse** | `nurse@hospital.com` | `demo123` |
| **Doctor** | `doctor@hospital.com` | `demo123` |
| **Pharmacist** | `pharmacy@hospital.com` | `demo123` |
| **Management** | `manager@hospital.com` | `demo123` |

---

## 🔧 Troubleshooting

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `no pg_hba.conf entry for host` / `SSL required` | Render requires SSL connection | Ensure `DB_SSL=true` or `DATABASE_URL` is set in `backend/.env`. |
| `ENOTFOUND dpg-daidu5jm8hqs73cf8fq0-a` | Using internal URL from outside Render | Ensure you append `.[region]-postgres.render.com` (External URL) when testing locally. |
| `ETIMEDOUT` / Connection hangs | Firewall or network restrictions | Verify internet connectivity and confirm Render database status is "Available" on dashboard. |
