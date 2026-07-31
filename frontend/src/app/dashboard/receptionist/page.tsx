'use client';
import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/management/dashboard'),
      api.get('/receptionist/appointments/today'),
    ]).then(([statsRes, apptRes]) => {
      setStats(statsRes.data);
      setTodayAppts(apptRes.data);
    }).finally(() => setLoading(false));
  }, []);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      scheduled: 'badge-info', confirmed: 'badge-success',
      in_progress: 'badge-warning', completed: 'badge-gray', cancelled: 'badge-danger',
    };
    return `badge ${map[s] || 'badge-gray'}`;
  };

  return (
    <DashboardLayout role="receptionist">
      <div className="topbar">
        <div className="topbar-title">
          Receptionist Dashboard <span style={{ marginLeft: 8 }}>/ Overview</span>
        </div>
        <Link href="/dashboard/receptionist/register" className="btn btn-primary btn-sm">
          + New Patient
        </Link>
        <Link href="/dashboard/receptionist/appointments" className="btn btn-secondary btn-sm">
          + Appointment
        </Link>
      </div>
      <div className="page-content">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <div className="loading-spinner" />
          </div>
        ) : (
          <>
            <div className="stats-grid">
              {[
                { icon: '🏥', label: 'Total Patients', value: stats?.totalPatients ?? 0, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
                { icon: '📅', label: 'Today\'s Appointments', value: stats?.todayAppointments ?? 0, color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
                { icon: '🛏️', label: 'Admitted', value: stats?.admittedPatients ?? 0, color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
                { icon: '📋', label: 'Total Appointments', value: stats?.totalAppointments ?? 0, color: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
              ].map((s) => (
                <div key={s.label} className="stat-card" style={{ '--gradient': s.gradient } as any}>
                  <div className="stat-icon" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header">
                <span className="card-title">📅 Today&apos;s Appointments</span>
                <Link href="/dashboard/receptionist/appointments" className="btn btn-secondary btn-sm">View All</Link>
              </div>
              <div className="table-container">
                {todayAppts.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📅</div>
                    <h3>No appointments today</h3>
                    <p>Schedule a new appointment to get started</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Patient</th><th>Doctor</th><th>Department</th><th>Time</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayAppts.map((a) => (
                        <tr key={a.id}>
                          <td><strong>{a.patientName}</strong></td>
                          <td>Dr. {a.doctorName}</td>
                          <td>{a.department}</td>
                          <td>{a.appointmentTime}</td>
                          <td><span className={statusBadge(a.status)}>{a.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
