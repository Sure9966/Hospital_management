'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function OpdQueuePage() {
  const [opdData, setOpdData] = useState<any>({ appointments: [], recentRegisteredPatients: [] });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  // Quick appointment modal state
  const [showQuickApptModal, setShowQuickApptModal] = useState(false);
  const [quickForm, setQuickForm] = useState({
    patientId: '', patientName: '', doctorName: '', department: 'General',
    appointmentDate: new Date().toISOString().split('T')[0], appointmentTime: '09:00', reason: 'OPD Walk-in Consult'
  });

  const loadData = () => {
    setLoading(true);
    api.get('/receptionist/opd-queue')
      .then(r => setOpdData(r.data))
      .catch(() => toast.error('Failed to load OPD queue data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.put(`/receptionist/appointments/${id}`, { status });
      toast.success('Queue status updated!');
      loadData();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const handleQuickApptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/receptionist/appointments', quickForm);
      toast.success('⚡ Walk-in OPD appointment added to queue!');
      setShowQuickApptModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error adding walk-in appointment');
    }
  };

  const openQuickAppt = (patient?: any) => {
    if (patient) {
      setQuickForm(f => ({
        ...f,
        patientId: patient.patientId,
        patientName: `${patient.firstName} ${patient.lastName}`,
      }));
    }
    setShowQuickApptModal(true);
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      scheduled: 'badge-info', confirmed: 'badge-success',
      in_progress: 'badge-warning', completed: 'badge-gray', cancelled: 'badge-danger',
    };
    return `badge ${map[s] || 'badge-gray'}`;
  };

  // Filtered Appointments
  const filteredAppointments = (opdData.appointments || []).filter((a: any) => {
    const matchesSearch =
      a.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.patientId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = filterDepartment === 'all' || a.department === filterDepartment;
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchesSearch && matchesDept && matchesStatus;
  });

  // Doctor Appointment Overview Cards grouping
  const doctorOverview = (opdData.appointments || []).reduce((acc: any, a: any) => {
    const doc = a.doctorName || 'Unassigned';
    if (!acc[doc]) {
      acc[doc] = { doctorName: doc, department: a.department, total: 0, waiting: 0, inProgress: 0, completed: 0 };
    }
    acc[doc].total += 1;
    if (a.status === 'scheduled' || a.status === 'confirmed') acc[doc].waiting += 1;
    if (a.status === 'in_progress') acc[doc].inProgress += 1;
    if (a.status === 'completed') acc[doc].completed += 1;
    return acc;
  }, {});

  const doctorsList = Object.values(doctorOverview);

  return (
    <DashboardLayout role="receptionist">
      <div className="topbar">
        <div className="topbar-title">🎟️ OPD Live Queue & Doctor Token Management</div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => openQuickAppt()}>⚡ Quick Walk-in Entry</button>
          <Link href="/dashboard/receptionist/register" className="btn btn-secondary">+ Register Patient</Link>
        </div>
      </div>

      <div className="page-content">
        {loading ? (
          <div className="flex items-center justify-center" style={{ height: 300 }}>
            <div className="loading-spinner" />
          </div>
        ) : (
          <>
            {/* Doctor Appointment Overview Cards */}
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                🩺 Doctor Appointment & OPD Room Overview Cards
              </h3>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))' }}>
                {doctorsList.length === 0 ? (
                  <div className="card" style={{ padding: 16 }}>No active doctor queues today.</div>
                ) : (
                  doctorsList.map((doc: any) => (
                    <div key={doc.doctorName} className="stat-card" style={{ borderLeft: '4px solid #0ea5e9', padding: 16 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>Dr. {doc.doctorName}</span>
                        <span className="badge badge-info">{doc.department}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center', fontSize: 12, marginTop: 12 }}>
                        <div style={{ background: 'rgba(245,158,11,0.1)', padding: 8, borderRadius: 8, color: '#f59e0b' }}>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{doc.waiting}</div>
                          <div>Waiting</div>
                        </div>
                        <div style={{ background: 'rgba(14,165,233,0.1)', padding: 8, borderRadius: 8, color: '#0ea5e9' }}>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{doc.inProgress}</div>
                          <div>In Room</div>
                        </div>
                        <div style={{ background: 'rgba(16,185,129,0.1)', padding: 8, borderRadius: 8, color: '#10b981' }}>
                          <div style={{ fontWeight: 800, fontSize: 16 }}>{doc.completed}</div>
                          <div>Done</div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Registration & OPD Queue Split Layout */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
              {/* Main OPD Queue Table */}
              <div className="card">
                <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                  <span className="card-title">📋 Live OPD Queue ({filteredAppointments.length})</span>
                  {/* Search & Filters */}
                  <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="🔍 Search Patient / Doctor..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      style={{ width: 200 }}
                    />
                    <select
                      className="form-control form-control-sm"
                      value={filterDepartment}
                      onChange={e => setFilterDepartment(e.target.value)}
                    >
                      <option value="all">All Departments</option>
                      {['General', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                      className="form-control form-control-sm"
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      {['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div className="table-container">
                  {filteredAppointments.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon">🎟️</div>
                      <h3>No OPD appointments match filters</h3>
                    </div>
                  ) : (
                    <table>
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Patient Info</th>
                          <th>Doctor & Dept</th>
                          <th>Queue Status</th>
                          <th>Quick Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAppointments.map((a: any) => (
                          <tr key={a.id}>
                            <td><strong style={{ color: 'var(--primary-light)' }}>{a.appointmentTime}</strong></td>
                            <td>
                              <div style={{ fontWeight: 700 }}>{a.patientName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {a.patientId}</div>
                            </td>
                            <td>
                              <div>Dr. {a.doctorName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.department}</div>
                            </td>
                            <td>
                              <select
                                value={a.status}
                                onChange={e => handleStatusChange(a.id, e.target.value)}
                                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                              >
                                {['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                            <td>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleStatusChange(a.id, 'in_progress')} title="Send to Doctor Room">
                                🚪 Send In
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Sidebar: Quick Entry for Registered Patients */}
              <div className="card">
                <div className="card-header">
                  <span className="card-title">⚡ Quick Walk-in Entry</span>
                </div>
                <div className="card-body">
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Click any recent patient to instantly book an OPD consultation slot.
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(opdData.recentRegisteredPatients || []).slice(0, 8).map((p: any) => (
                      <div
                        key={p.id}
                        style={{
                          background: 'var(--bg-surface)',
                          padding: 10,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: 12
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700 }}>{p.firstName} {p.lastName}</div>
                          <div style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 600 }}>{p.opdTokenNumber || p.patientId}</div>
                        </div>
                        <button className="btn btn-primary btn-sm" onClick={() => openQuickAppt(p)}>
                          + Book OPD
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Walk-in Appointment Modal */}
      {showQuickApptModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowQuickApptModal(false)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>⚡ Quick OPD Appointment Entry</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowQuickApptModal(false)}>✕</button>
            </div>
            <form onSubmit={handleQuickApptSubmit}>
              <div className="modal-body">
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Patient Name *</label>
                  <input className="form-control" value={quickForm.patientName} onChange={e => setQuickForm(f => ({ ...f, patientName: e.target.value }))} required />
                </div>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Patient ID</label>
                  <input className="form-control" value={quickForm.patientId} onChange={e => setQuickForm(f => ({ ...f, patientId: e.target.value }))} />
                </div>
                <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Doctor Name *</label>
                    <input className="form-control" placeholder="Dr. Smith" value={quickForm.doctorName} onChange={e => setQuickForm(f => ({ ...f, doctorName: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select className="form-control" value={quickForm.department} onChange={e => setQuickForm(f => ({ ...f, department: e.target.value }))}>
                      {['General', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics'].map(d => <option key={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Time Slot</label>
                    <input type="time" className="form-control" value={quickForm.appointmentTime} onChange={e => setQuickForm(f => ({ ...f, appointmentTime: e.target.value }))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reason</label>
                    <input className="form-control" value={quickForm.reason} onChange={e => setQuickForm(f => ({ ...f, reason: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowQuickApptModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">⚡ Add to OPD Queue</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
