'use client';
import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import Link from 'next/link';

export default function ReceptionistDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [todayAppts, setTodayAppts] = useState<any[]>([]);
  const [recentPatients, setRecentPatients] = useState<any[]>([]);
  const [pendingEmergency, setPendingEmergency] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/management/dashboard'),
      api.get('/receptionist/appointments/today'),
      api.get('/patients'),
      api.get('/patients/emergency/pending'),
    ]).then(([statsRes, apptRes, patientRes, emergencyRes]) => {
      setStats(statsRes.data);
      setTodayAppts(apptRes.data || []);
      setRecentPatients(patientRes.data || []);
      setPendingEmergency(emergencyRes.data || []);
    }).catch(() => {
      setTodayAppts([]);
      setRecentPatients([]);
      setPendingEmergency([]);
    }).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
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
          <button className="btn btn-secondary btn-sm" onClick={() => loadData()}>
            🔄 Refresh Records
          </button>
          <Link href="/dashboard/receptionist/register?mode=emergency" className="btn btn-primary btn-sm" style={{ background: '#ef4444', borderColor: '#dc2626' }}>
            🚨 Emergency Quick Intake
          </Link>
          <Link href="/dashboard/receptionist/register" className="btn btn-primary btn-sm">
            + Patient Registration
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
                { icon: '🚨', label: 'Pending Emergency Reg.', value: pendingEmergency.length, color: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
                { icon: '🏥', label: 'Total Patients', value: stats?.totalPatients ?? 0, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
                { icon: '📅', label: 'Today\'s Appointments', value: stats?.todayAppointments ?? 0, color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
                { icon: '🛏️', label: 'Admitted Patients', value: stats?.admittedPatients ?? 0, color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
              ].map((s) => (
                <div key={s.label} className="stat-card" style={{ '--gradient': s.gradient } as any}>
                  <div className="stat-icon" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
              {/* Emergency Patients Pending Registration */}
              {pendingEmergency.length > 0 && (
                <div className="card" style={{ borderLeft: '4px solid #ef4444' }}>
                  <div className="card-header" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                    <span className="card-title" style={{ color: '#ef4444' }}>
                      🚨 Pending Emergency Registrations ({pendingEmergency.length})
                    </span>
                    <Link href="/dashboard/receptionist/register?mode=complete" className="btn btn-secondary btn-sm">
                      View All Pending
                    </Link>
                  </div>
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Token</th>
                          <th>Patient ID</th>
                          <th>Patient Name</th>
                          <th>Severity</th>
                          <th>Condition</th>
                          <th>Assigned Doctor</th>
                          <th>Admitted</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingEmergency.map((p) => (
                          <tr key={p.id}>
                            <td>
                              <span style={{ fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                {p.opdTokenNumber || 'EMG-TK'}
                              </span>
                            </td>
                            <td><strong>{p.patientId}</strong></td>
                            <td>{p.firstName} {p.lastName}</td>
                            <td>
                              <span className={`badge ${p.emergencySeverity === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                                {p.emergencySeverity || 'critical'}
                              </span>
                            </td>
                            <td>{p.diagnosis || 'Emergency Care'}</td>
                            <td>Dr. {p.assignedDoctorName || 'Emergency Doctor'}</td>
                            <td>{new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                            <td>
                              <Link
                                href={`/dashboard/receptionist/register?mode=complete&id=${p.id}`}
                                className="btn btn-primary btn-sm"
                              >
                                📝 Complete Reg.
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
                  <div className="flex gap-2">
                    <Link href="/dashboard/receptionist/register?mode=emergency" className="btn btn-secondary btn-sm" style={{ color: '#ef4444' }}>
                      🚨 Emergency Intake
                    </Link>
                    <Link href="/dashboard/receptionist/register" className="btn btn-primary btn-sm">+ New Patient</Link>
                  </div>
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
                          <th>Type</th>
                          <th>Department</th>
                          <th>Assigned Doctor</th>
                          <th>Registered Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentPatients.slice(0, 10).map((p) => (
                          <tr key={p.id}>
                            <td>
                              <span style={{ fontWeight: 800, color: p.isEmergency ? '#ef4444' : '#0ea5e9', background: p.isEmergency ? 'rgba(239,68,68,0.1)' : 'rgba(14,165,233,0.1)', padding: '2px 8px', borderRadius: 6 }}>
                                {p.opdTokenNumber || 'N/A'}
                              </span>
                            </td>
                            <td><strong>{p.patientId}</strong></td>
                            <td>{p.firstName} {p.lastName}</td>
                            <td>{p.phone || 'N/A'}</td>
                            <td>
                              {p.isEmergency ? (
                                <span className={`badge ${p.isBasicRegistrationComplete ? 'badge-warning' : 'badge-danger'}`}>
                                  🚨 {p.isBasicRegistrationComplete ? 'Emergency (Complete)' : 'Emergency (Pending)'}
                                </span>
                              ) : (
                                <span className="badge badge-success">Standard</span>
                              )}
                            </td>
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
