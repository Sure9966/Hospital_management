'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';

import { getUser, setAuth, getToken } from '@/lib/auth';

export default function ManagementDashboard() {
  const searchParams = useSearchParams();
  const [stats, setStats] = useState<any>({});
  const [staff, setStaff] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [dischargeSummaries, setDischargeSummaries] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '', targetRole: '' });
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'staff' | 'patients' | 'discharges' | 'opd_records' | 'broadcast'>('overview');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'all' | 'nurses_doctors' | 'nurse' | 'doctor'>('all');
  const [updatingDutyId, setUpdatingDutyId] = useState<string | null>(null);

  const handleDutyTypeChange = async (userId: string, dutyType: string) => {
    setUpdatingDutyId(userId);
    try {
      await api.put(`/users/${userId}`, { dutyType });
      setStaff(prev => prev.map(u => u.id === userId ? { ...u, dutyType } : u));
      const activeUser = getUser();
      if (activeUser && activeUser.id === userId) {
        setAuth(getToken() || '', { ...activeUser, dutyType });
      }
      toast.success(`✅ Duty type updated to "${dutyType}"`);
    } catch {
      toast.error('Failed to update duty type');
    } finally {
      setUpdatingDutyId(null);
    }
  };

  const loadData = () => {
    api.get('/management/dashboard').then(r => setStats(r.data));
    api.get('/users').then(r => setStaff(r.data));
    api.get('/patients').then(r => setPatients(r.data));
    api.get('/management/discharges').then(r => setDischargeSummaries(r.data)).catch(() => { });
    api.get('/doctor/consultations').then(r => setConsultations(r.data)).catch(() => { });
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'staff' || tabParam === 'patients' || tabParam === 'discharges' || tabParam === 'opd_records' || tabParam === 'broadcast') {
      setTab(tabParam as any);
    } else {
      setTab('overview');
    }
  }, [searchParams]);

  const downloadOpdSlipPdf = async (patientId: string, consultationId?: string) => {
    try {
      toast.loading('Downloading small OP PDF slip...', { id: 'mgmt-op-pdf' });
      const urlPath = consultationId
        ? `/doctor/opd-slip/${patientId}/consultation/${consultationId}/pdf`
        : `/doctor/opd-slip/${patientId}/pdf`;
      const response = await api.get(urlPath, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${patientId}_opd_slip.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('✅ Small OP PDF Slip downloaded successfully', { id: 'mgmt-op-pdf' });
    } catch {
      toast.error('Failed to download OP PDF slip', { id: 'mgmt-op-pdf' });
    }
  };

  const handleRenewToken = async (patientId: string) => {
    try {
      toast.loading('Renewing OP Token...', { id: 'mgmt-renew-token' });
      await api.post(`/patients/${patientId}/renew-op`);
      toast.success('🔄 OP Token renewed for 3 months!', { id: 'mgmt-renew-token' });
      api.get('/patients').then(r => setPatients(r.data));
    } catch {
      toast.error('Failed to renew OP Token', { id: 'mgmt-renew-token' });
    }
  };

  const downloadDischargePdf = async (dischargeId: string, patientId: string) => {
    try {
      toast.loading('Downloading discharge PDF...', { id: 'management-pdf-download' });
      const response = await api.get(`/management/discharges/${dischargeId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${patientId}_discharge.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('✅ Discharge PDF downloaded successfully', { id: 'management-pdf-download' });
    } catch (error) {
      toast.error('Failed to download discharge PDF', { id: 'management-pdf-download' });
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/management/broadcast', broadcastForm);
      toast.success('📢 Broadcast sent to all staff!');
      setBroadcastForm({ title: '', message: '', targetRole: '' });
    } catch { toast.error('Failed to send'); }
    finally { setLoading(false); }
  };

  const roleColors: Record<string, string> = {
    admin: '#6366f1', receptionist: '#0ea5e9', nurse: '#10b981', doctor: '#f472b6',
    pharmacist: '#f59e0b', management: '#ef4444', patient: '#8b5cf6', lab_technician: '#14b8a6',
  };

  const statusColors: Record<string, string> = {
    registered: 'badge-info', admitted: 'badge-success',
    under_treatment: 'badge-warning', discharged: 'badge-gray',
  };

  const filteredDischarges = dischargeSummaries.filter(d =>
    (d.patientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.patientId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.diagnosis || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout role="management">
      <div className="topbar">
        <div className="topbar-title">Hospital Management</div>
        <div className="flex gap-2">
          <button className="btn btn-secondary btn-sm" onClick={() => loadData()}>
            🔄 Refresh Records
          </button>
          {(['overview', 'staff', 'patients', 'discharges', 'opd_records', 'broadcast'] as const).map(t => (
            <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
              {t === 'overview' ? '📊 Overview' : t === 'staff' ? '👥 Staff' : t === 'patients' ? '🏥 Patients' : t === 'discharges' ? '📋 Discharges' : t === 'opd_records' ? '📜 Previous OPD Records' : '📢 Broadcast'}
            </button>
          ))}
        </div>
      </div>
      <div className="page-content">
        {tab === 'overview' && (
          <>
            <div className="stats-grid">
              {[
                { icon: '🏥', label: 'Total Patients', value: stats.totalPatients ?? 0, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
                { icon: '👥', label: 'Total Staff', value: stats.totalUsers ?? 0, color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
                { icon: '📅', label: 'Total Appointments', value: stats.totalAppointments ?? 0, color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
                { icon: '💊', label: 'Pending Rx', value: stats.pendingPrescriptions ?? 0, color: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
                { icon: '🛏️', label: 'Admitted', value: stats.admittedPatients ?? 0, color: '#8b5cf6', gradient: 'linear-gradient(135deg,#8b5cf6,#a78bfa)' },
                { icon: '🚨', label: 'Critical Vitals', value: stats.criticalVitals ?? 0, color: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
                { icon: '📅', label: "Today's Appointments", value: stats.todayAppointments ?? 0, color: '#06b6d4', gradient: 'linear-gradient(135deg,#06b6d4,#22d3ee)' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ '--gradient': s.gradient } as any}>
                  <div className="stat-icon" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header"><span className="card-title">👥 Staff by Role</span></div>
                <div className="card-body">
                  {Object.entries(
                    staff.reduce((acc: any, u: any) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {})
                  ).map(([role, count]: any) => (
                    <div key={role} className="flex items-center gap-3" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: roleColors[role] || '#666', flexShrink: 0 }} />
                      <span style={{ flex: 1, textTransform: 'capitalize', fontSize: 14 }}>{role}</span>
                      <span style={{ fontWeight: 700, color: roleColors[role] || '#666' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-header"><span className="card-title">🏥 Patient Status</span></div>
                <div className="card-body">
                  {['registered', 'admitted', 'under_treatment', 'discharged'].map(status => {
                    const count = patients.filter(p => p.status === status).length;
                    return (
                      <div key={status} className="flex items-center gap-3" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <span className={`badge ${statusColors[status]}`}>{status.replace('_', ' ')}</span>
                        <span style={{ fontWeight: 700, marginLeft: 'auto' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {tab === 'staff' && (
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">👥 Staff Directory</span>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Filter Role:</span>
                <button
                  className={`btn btn-sm ${staffRoleFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStaffRoleFilter('all')}
                >
                  All Staff ({staff.length})
                </button>
                <button
                  className={`btn btn-sm ${staffRoleFilter === 'nurses_doctors' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStaffRoleFilter('nurses_doctors')}
                >
                  🩺 Nurses & Doctors Only ({staff.filter(u => ['nurse', 'doctor'].includes((u.role || '').toLowerCase())).length})
                </button>
                <button
                  className={`btn btn-sm ${staffRoleFilter === 'doctor' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStaffRoleFilter('doctor')}
                >
                  👨‍⚕️ Doctors ({staff.filter(u => (u.role || '').toLowerCase() === 'doctor').length})
                </button>
                <button
                  className={`btn btn-sm ${staffRoleFilter === 'nurse' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setStaffRoleFilter('nurse')}
                >
                  👩‍⚕️ Nurses ({staff.filter(u => (u.role || '').toLowerCase() === 'nurse').length})
                </button>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Duty Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staff
                    .filter(u => {
                      const r = (u.role || '').toLowerCase();
                      if (staffRoleFilter === 'nurses_doctors') return r === 'nurse' || r === 'doctor';
                      if (staffRoleFilter === 'nurse') return r === 'nurse';
                      if (staffRoleFilter === 'doctor') return r === 'doctor';
                      return true;
                    })
                    .map(u => {
                      const role = (u.role || '').toLowerCase();
                      const isNurse = role === 'nurse';
                      const isDoctor = role === 'doctor';
                      const currentDuty = (u.dutyType || (isNurse ? 'OP' : isDoctor ? 'Normal' : '')).toUpperCase();

                      return (
                        <tr key={u.id}>
                          <td><strong>{u.firstName} {u.lastName}</strong></td>
                          <td>{u.email}</td>
                          <td>
                            <span className="badge" style={{ background: `${roleColors[u.role] || '#6366f1'}22`, color: roleColors[u.role] || '#6366f1', border: `1px solid ${roleColors[u.role] || '#6366f1'}44` }}>
                              {u.role}
                            </span>
                          </td>
                          <td>{u.department || '—'}</td>
                          <td>
                            {isNurse ? (
                              <select
                                className="form-control form-control-sm"
                                style={{
                                  width: 125,
                                  fontSize: 12,
                                  padding: '3px 8px',
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  borderColor: currentDuty === 'IP' ? '#10b981' : '#0ea5e9',
                                  background: currentDuty === 'IP' ? 'rgba(16,185,129,0.1)' : 'rgba(14,165,233,0.1)',
                                  color: currentDuty === 'IP' ? '#10b981' : '#0ea5e9',
                                }}
                                value={currentDuty === 'IP' ? 'IP' : 'OP'}
                                disabled={updatingDutyId === u.id}
                                onChange={e => handleDutyTypeChange(u.id, e.target.value)}
                              >
                                <option value="OP">🏥 OP (Outpatient)</option>
                                <option value="IP">🛏️ IP (Inpatient)</option>
                              </select>
                            ) : isDoctor ? (
                              <select
                                className="form-control form-control-sm"
                                style={{
                                  width: 135,
                                  fontSize: 12,
                                  padding: '3px 8px',
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  borderColor: (currentDuty === 'EMERGENCY' || currentDuty === 'EMERGENCY DUTY') ? '#ef4444' : '#6366f1',
                                  background: (currentDuty === 'EMERGENCY' || currentDuty === 'EMERGENCY DUTY') ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                                  color: (currentDuty === 'EMERGENCY' || currentDuty === 'EMERGENCY DUTY') ? '#ef4444' : '#6366f1',
                                }}
                                value={(currentDuty === 'EMERGENCY' || currentDuty === 'EMERGENCY DUTY') ? 'Emergency' : 'Normal'}
                                disabled={updatingDutyId === u.id}
                                onChange={e => handleDutyTypeChange(u.id, e.target.value)}
                              >
                                <option value="Normal">👨‍⚕️ Normal</option>
                                <option value="Emergency">🚨 Emergency</option>
                              </select>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                            )}
                          </td>
                          <td><span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>{u.isActive ? 'Active' : 'Inactive'}</span></td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'patients' && (
          <div className="card">
            <div className="card-header"><span className="card-title">🏥 All Patients ({patients.length})</span></div>
            <div className="table-container">
              <table>
                <thead><tr><th>Patient ID</th><th>Name</th><th>Type / Emergency Status</th><th>Gender</th><th>Blood Group</th><th>Ward</th><th>Status</th></tr></thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id}>
                      <td><code style={{ color: 'var(--primary-light)', fontSize: 12 }}>{p.patientId}</code></td>
                      <td><strong>{p.firstName} {p.lastName}</strong></td>
                      <td>
                        {p.isEmergency ? (
                          <span className={`badge ${p.isBasicRegistrationComplete ? 'badge-warning' : 'badge-danger'}`}>
                            🚨 Emergency ({p.isBasicRegistrationComplete ? 'Complete' : 'Basic Pending'})
                          </span>
                        ) : (
                          <span className="badge badge-success">Standard</span>
                        )}
                      </td>
                      <td>{p.gender}</td>
                      <td>{p.bloodGroup || '—'}</td>
                      <td>{p.ward || '—'}</td>
                      <td><span className={`badge ${statusColors[p.status] || 'badge-gray'}`}>{p.status?.replace('_', ' ')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'discharges' && (
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">📋 Patient Discharge Summaries & PDF Documents ({filteredDischarges.length})</span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="🔍 Search patient name, ID, or diagnosis..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 260 }}
              />
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Hospital Management view for discharged patients and official backend-generated discharge PDFs.
              </p>
              {filteredDischarges.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>No discharge summaries found</h3>
                  <p>Discharged patient records will appear here when generated.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient ID</th>
                        <th>Patient Name</th>
                        <th>Admission No</th>
                        <th>Discharge Date</th>
                        <th>Condition</th>
                        <th>Diagnosis</th>
                        <th>Summary / PDF Content</th>
                        <th>Discharge PDF Action</th>
                        <th>Date Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDischarges.map(d => (
                        <tr key={d.id}>
                          <td><code style={{ color: 'var(--primary-light)', fontSize: 12 }}>{d.patientId}</code></td>
                          <td><strong>{d.patientName}</strong></td>
                          <td><code>{d.admissionNumber || 'N/A'}</code></td>
                          <td>{d.dischargeDate}</td>
                          <td><span className="badge badge-success">{d.conditionAtDischarge || 'Stable'}</span></td>
                          <td>{d.diagnosis || 'N/A'}</td>
                          <td style={{ maxWidth: 260, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <div style={{ maxHeight: 60, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                              {d.dischargeSummary || 'No summary text attached.'}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => downloadDischargePdf(d.id, d.patientId)}
                            >
                              📄 Download PDF
                            </button>
                          </td>
                          <td style={{ fontSize: 11 }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'opd_records' && (
          <div className="card">
            <div className="card-header flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">📜 Completed OPD Records & 3-Month Token Validity ({patients.length})</span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="🔍 Search patient, doctor, diagnosis..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 260 }}
              />
            </div>
            <div className="table-container">
              {patients.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📜</div>
                  <h3>No OPD records found</h3>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Patient ID & Name</th>
                      <th>OPD Token No</th>
                      <th>OP Token 3-Month Validity</th>
                      <th>Attending Doctor & Dept</th>
                      <th>Diagnosis / Action</th>
                      <th>PDF & Renewal Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patients
                      .filter(p =>
                        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        p.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (p.opdTokenNumber && p.opdTokenNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (p.diagnosis && p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()))
                      )
                      .map(p => {
                        const issuedAt = p.opdTokenIssuedAt ? new Date(p.opdTokenIssuedAt) : new Date(p.createdAt || Date.now());
                        const expiresAt = p.opdTokenExpiresAt
                          ? new Date(p.opdTokenExpiresAt)
                          : new Date(issuedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
                        const isTokenValid = new Date() <= expiresAt;
                        const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

                        return (
                          <tr key={p.id}>
                            <td>
                              <strong>{p.firstName} {p.lastName}</strong>
                              <br /><code style={{ color: 'var(--primary-light)', fontSize: 11 }}>{p.patientId}</code>
                            </td>
                            <td>
                              <span className="badge badge-info">{p.opdTokenNumber || 'N/A'}</span>
                            </td>
                            <td>
                              {isTokenValid ? (
                                <div>
                                  <span className="badge badge-success" style={{ fontSize: 11 }}>🟢 Valid ({daysRemaining} days left)</span>
                                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>Exp: {expiresAt.toISOString().split('T')[0]}</div>
                                </div>
                              ) : (
                                <div>
                                  <span className="badge badge-danger" style={{ fontSize: 11 }}>🔴 Expired (Renewal Required)</span>
                                  <div style={{ fontSize: 10, color: '#ef4444', marginTop: 2 }}>Expired: {expiresAt.toISOString().split('T')[0]}</div>
                                </div>
                              )}
                            </td>
                            <td>
                              <div>{p.assignedDoctorName || p.admittedBy || 'Doctor'}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.department || 'General'}</div>
                            </td>
                            <td>{p.diagnosis || 'General OPD Visit Completed'}</td>
                            <td>
                              <div className="flex gap-2">
                                <button className="btn btn-secondary btn-sm" onClick={() => downloadOpdSlipPdf(p.patientId)}>
                                  📄 OP PDF
                                </button>
                                {!isTokenValid && (
                                  <button className="btn btn-sm" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={() => handleRenewToken(p.patientId)}>
                                    🔄 Renew
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === 'broadcast' && (
          <div className="card" style={{ maxWidth: 600 }}>
            <div className="card-header"><span className="card-title">📢 Broadcast Notification</span></div>
            <form onSubmit={handleBroadcast}>
              <div className="card-body">
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Title *</label>
                  <input className="form-control" placeholder="Important Notice" value={broadcastForm.title} onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))} required />
                </div>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Message *</label>
                  <textarea className="form-control" rows={4} placeholder="Enter your broadcast message..." value={broadcastForm.message} onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))} required />
                </div>
                <div className="form-group" style={{ marginBottom: 20 }}>
                  <label className="form-label">Target Role (leave blank for all)</label>
                  <select className="form-control" value={broadcastForm.targetRole} onChange={e => setBroadcastForm(f => ({ ...f, targetRole: e.target.value }))}>
                    <option value="">All Staff</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="nurse">Nurse</option>
                    <option value="pharmacist">Pharmacist</option>
                    <option value="management">Management</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ height: 44 }}>
                  {loading ? '⏳ Sending...' : '📢 Send Broadcast'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
