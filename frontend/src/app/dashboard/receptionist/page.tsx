'use client';
import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/management/dashboard'),
      api.get('/receptionist/appointments/today'),
      api.get('/patients'),
    ]).then(([statsRes, apptRes, patientRes]) => {
      setStats(statsRes.data);
      setTodayAppts(apptRes.data || []);
      setRecentPatients(patientRes.data || []);
    }).catch(() => {
      setTodayAppts([]);
      setRecentPatients([]);
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
        <div className="flex gap-2">
          <Link href="/dashboard/receptionist/register" className="btn btn-primary btn-sm">
            + Register Patient
          </Link>
          <Link href="/dashboard/receptionist/opd-queue" className="btn btn-secondary btn-sm">
            🎟️ OPD Queue Tokens
          </Link>
        </div>
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
              {/* Today's Appointments & OPD Queue Tokens */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">📅 Today&apos;s OPD Appointments & Live Tokens ({todayAppts.length})</span>
                  <Link href="/dashboard/receptionist/opd-queue" className="btn btn-secondary btn-sm">View OPD Queue</Link>
                </div>
                <div className="table-container">
                  {todayAppts.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">📅</div>
                      <h3>No OPD appointments today</h3>
                      <p>Register a patient or schedule an appointment to generate a queue token</p>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Patient Info</th><th>Doctor</th><th>Department</th><th>Time</th><th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayAppts.map((a) => (
                          <tr key={a.id}>
                            <td>
                              <strong>{a.patientName}</strong>
                              <div style={{ fontSize: 11, color: '#0ea5e9', fontWeight: 600 }}>{a.patientId}</div>
                            </td>
                            <td>Dr. {a.doctorName}</td>
                            <td><span className="badge badge-info">{a.department}</span></td>
                            <td>{a.appointmentTime}</td>
                            <td><span className={statusBadge(a.status)}>{a.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Recently Registered Patients */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">🏥 Recently Registered Patients ({recentPatients.length})</span>
                  <Link href="/dashboard/receptionist/register" className="btn btn-primary btn-sm">+ New Patient</Link>
                </div>
                <div className="table-container">
                  {recentPatients.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">👤</div>
                      <h3>No registered patients</h3>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>OPD Token</th>
                          <th>Patient ID</th>
                          <th>Full Name</th>
                          <th>Phone</th>
                          <th>Gender</th>
                          <th>Department</th>
                          <th>Assigned Doctor</th>
                          <th>Registered Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPatients.slice(0, 10).map((p) => (
                          <tr key={p.id}>
                            <td>
                              <span style={{ fontWeight: 800, color: '#0ea5e9', background: 'rgba(14,165,233,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                {p.opdTokenNumber || 'N/A'}
                              </span>
                            </td>
                            <td><strong>{p.patientId}</strong></td>
                            <td>{p.firstName} {p.lastName}</td>
                            <td>{p.phone}</td>
                            <td style={{ textTransform: 'capitalize' }}>{p.gender}</td>
                            <td><span className="badge badge-secondary">{p.department || 'General'}</span></td>
                            <td>{p.assignedDoctorName || 'General Doctor'}</td>
                            <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
