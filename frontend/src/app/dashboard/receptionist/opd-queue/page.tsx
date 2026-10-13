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
  const [filterStatus, setFilterStatus] = useState('waiting');
  const [loading, setLoading] = useState(true);

  // Quick appointment modal state
  const [showQuickApptModal, setShowQuickApptModal] = useState(false);
  const [quickForm, setQuickForm] = useState({
    patientId: '', patientName: '', doctorId: '', doctorName: '', department: 'General',
    appointmentDate: new Date().toISOString().split('T')[0], appointmentTime: '09:00', reason: 'OPD Walk-in Consult'
  });
  const [eligibleDoctors, setEligibleDoctors] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const loadData = () => {
    setLoading(true);
    api.get('/receptionist/opd-queue')
      .then(r => setOpdData(r.data))
      .catch(() => toast.error('Failed to load OPD queue data'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();

    api.get('/users/doctors')
      .then(res => setDoctors(res.data || []))
      .catch(() => {
        setDoctors([]);
        toast.error('Failed to load doctors');
      });
  }, []);

  const handleRenewToken = async (patientId: string) => {
    try {
      toast.loading('Renewing OP Token...', { id: 'renew-token' });
      await api.post(`/patients/${patientId}/renew-op`);
      toast.success('🔄 OP Token renewed for 3 months!', { id: 'renew-token' });
      loadData();
    } catch {
      toast.error('Failed to renew OP Token', { id: 'renew-token' });
    }
  };

  const downloadOpdSlip = async (patientId: string) => {
    try {
      toast.loading('Downloading small OP PDF slip...', { id: 'reception-op-pdf' });
      const response = await api.get(`/doctor/opd-slip/${patientId}/pdf`, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', `${patientId}_opd_slip.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('✅ Small OP PDF Slip downloaded successfully', { id: 'reception-op-pdf' });
    } catch {
      toast.error('Failed to download OP PDF slip', { id: 'reception-op-pdf' });
    }
  };

  useEffect(() => {
    const url = quickForm.department ? `/users/doctors?department=${encodeURIComponent(quickForm.department)}` : '/users/doctors';
    api.get(url)
      .then(res => setEligibleDoctors(res.data || []))
      .catch(() => setEligibleDoctors([]));
  }, [quickForm.department]);

  // Send In modal state
  const [showSendInModal, setShowSendInModal] = useState(false);
  const [sendInItem, setSendInItem] = useState<any>(null);
  const [sendInDoctorId, setSendInDoctorId] = useState('');
  const [sendInDoctorName, setSendInDoctorName] = useState('');
  const [sendInNotes, setSendInNotes] = useState('');
  const [sendingIn, setSendingIn] = useState(false);

  const openSendInModal = (item: any) => {
    let initialDocId = item.doctorId || '';
    let initialDocName = item.doctorName || '';

    if (!initialDocId && doctors.length > 0 && initialDocName) {
      const match = doctors.find((d: any) =>
        `${d.firstName} ${d.lastName}`.toLowerCase().includes(initialDocName.replace(/^Dr\.\s*/i, '').toLowerCase()) ||
        (d.lastName && initialDocName.toLowerCase().includes(d.lastName.toLowerCase()))
      );
      if (match) {
        initialDocId = match.id;
        initialDocName = `${match.firstName} ${match.lastName}`;
      }
    }

    if (!initialDocId && doctors.length > 0) {
      // Default to first doctor matching department, or first available doctor
      const deptMatch = doctors.find((d: any) => d.department === item.department);
      const chosen = deptMatch || doctors[0];
      initialDocId = chosen.id;
      initialDocName = `${chosen.firstName} ${chosen.lastName}`;
    }

    setSendInItem(item);
    setSendInDoctorId(initialDocId);
    setSendInDoctorName(initialDocName);
    setSendInNotes(item.notes || 'OPD Consultation');
    setShowSendInModal(true);
  };

  const handleConfirmSendIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendInItem) return;
    setSendingIn(true);

    try {
      const selectedDoc = doctors.find((d: any) => d.id === sendInDoctorId);
      const docName = selectedDoc ? `${selectedDoc.firstName} ${selectedDoc.lastName}` : sendInDoctorName || 'Doctor';
      const docId = sendInDoctorId || selectedDoc?.id;

      const isPatientVirtual =
        (typeof sendInItem === 'object' && (sendInItem.isPatientEntry || String(sendInItem.id).startsWith('p-'))) ||
        (typeof sendInItem === 'string' && sendInItem.startsWith('p-'));

      if (isPatientVirtual) {
        await api.post('/receptionist/appointments', {
          patientId: sendInItem.patientId,
          patientName: sendInItem.patientName,
          doctorId: docId,
          doctorName: docName,
          department: sendInItem.department,
          appointmentDate: sendInItem.appointmentDate || new Date().toISOString().split('T')[0],
          appointmentTime: sendInItem.appointmentTime || '09:00',
          status: 'in_progress',
          reason: 'OPD Queue Token',
          notes: sendInNotes,
        });
      } else {
        const apptId = typeof sendInItem === 'string' ? sendInItem : sendInItem?.id;
        if (apptId) {
          await api.put(`/receptionist/appointments/${apptId}`, {
            status: 'in_progress',
            doctorId: docId,
            doctorName: docName,
            notes: sendInNotes,
          });
        }
      }

      toast.success(`🚪 Sent ${sendInItem.patientName} to Dr. ${docName}'s Consultation Room!`);
      setShowSendInModal(false);
      setSendInItem(null);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send in patient to doctor');
    } finally {
      setSendingIn(false);
    }
  };

  const handleStatusChange = async (itemOrId: any, status: string) => {
    try {
      const isPatientVirtual =
        (typeof itemOrId === 'object' && (itemOrId.isPatientEntry || String(itemOrId.id).startsWith('p-'))) ||
        (typeof itemOrId === 'string' && itemOrId.startsWith('p-'));

      const targetItem = typeof itemOrId === 'object' ? itemOrId : combinedQueue.find((q: any) => q.id === itemOrId);
      const patientName = targetItem?.patientName || 'Patient';
      let doctorName = targetItem?.doctorName ? targetItem.doctorName.replace(/^Dr\.\s*/i, '') : 'Doctor';
      let doctorId = targetItem?.doctorId;

      if (!doctorId && doctors.length > 0 && doctorName) {
        const match = doctors.find((d: any) =>
          `${d.firstName} ${d.lastName}`.toLowerCase().includes(doctorName.toLowerCase()) ||
          (d.lastName && doctorName.toLowerCase().includes(d.lastName.toLowerCase()))
        );
        if (match) {
          doctorId = match.id;
          doctorName = `${match.firstName} ${match.lastName}`;
        }
      }

      if (isPatientVirtual) {
        if (targetItem) {
          await api.post('/receptionist/appointments', {
            patientId: targetItem.patientId,
            patientName: targetItem.patientName,
            doctorId: doctorId || undefined,
            doctorName: doctorName,
            department: targetItem.department,
            appointmentDate: targetItem.appointmentDate || new Date().toISOString().split('T')[0],
            appointmentTime: targetItem.appointmentTime || '09:00',
            status: status,
            reason: 'OPD Queue Token',
            notes: targetItem.notes,
          });
        }
      } else {
        const apptId = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id;
        if (apptId) {
          await api.put(`/receptionist/appointments/${apptId}`, {
            status,
            doctorId: doctorId || undefined,
            doctorName: doctorName,
          });
        }
      }

      if (status === 'in_progress') {
        toast.success(`🚪 Sent ${patientName} to Dr. ${doctorName}'s Consultation Room!`);
      } else {
        toast.success(`Queue status updated to ${status.replace('_', ' ')}!`);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update status');
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

  // Combine explicit appointments and registered patients into full OPD Queue list
  const combinedQueue: any[] = [...(opdData.appointments || [])];
  const existingPatientIds = new Set(combinedQueue.map((a: any) => a.patientId));

  (opdData.recentRegisteredPatients || []).forEach((p: any) => {
    if (!existingPatientIds.has(p.patientId) && !existingPatientIds.has(p.id)) {
      combinedQueue.push({
        id: `p-${p.id}`,
        patientId: p.patientId,
        patientName: `${p.firstName} ${p.lastName}`,
        doctorId: p.assignedDoctorId || null,
        doctorName: p.assignedDoctorName ? p.assignedDoctorName.replace(/^Dr\.\s*/i, '') : 'General Doctor',
        department: p.department || 'General',
        appointmentDate: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        appointmentTime: p.createdAt ? new Date(p.createdAt).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) : '09:00',
        status: p.status || 'scheduled',
        notes: `OPD Queue Token: ${p.opdTokenNumber || 'TK-REG'}`,
        isPatientEntry: true,
      });
    }
  });

  // Filtered Queue Items
  const filteredAppointments = combinedQueue.filter((a: any) => {
    const pName = (a.patientName || '').toLowerCase();
    const dName = (a.doctorName || '').toLowerCase();
    const pId = (a.patientId || '').toLowerCase();
    const q = searchQuery.toLowerCase();

    const matchesSearch = pName.includes(q) || dName.includes(q) || pId.includes(q);
    const matchesDept = filterDepartment === 'all' || a.department === filterDepartment;

    let matchesStatus = true;
    if (filterStatus === 'waiting') {
      matchesStatus = a.status === 'scheduled' || a.status === 'confirmed' || a.status === 'registered' || !a.status;
    } else if (filterStatus !== 'all') {
      matchesStatus = a.status === filterStatus;
    }

    return matchesSearch && matchesDept && matchesStatus;
  });

  const doctorsList = doctors.map((doctor: any) => {
    const doctorName = `${doctor.firstName} ${doctor.lastName}`;

    const doctorAppointments = combinedQueue.filter(
      (a: any) =>
        a.doctorId === doctor.id ||
        (a.doctorName && a.doctorName.toLowerCase().includes(doctor.lastName.toLowerCase())) ||
        a.doctorName === doctorName
    );

    return {
      id: doctor.id,
      doctorName,
      department: doctor.department || 'General',

      total: doctorAppointments.length,

      waiting: doctorAppointments.filter(
        (a: any) =>
          a.status === 'scheduled' ||
          a.status === 'confirmed' ||
          a.status === 'registered'
      ).length,

      inProgress: doctorAppointments.filter(
        (a: any) => a.status === 'in_progress'
      ).length,

      completed: doctorAppointments.filter(
        (a: any) => a.status === 'completed'
      ).length,
    };
  });

  return (
    <DashboardLayout role="receptionist">
      <div className="topbar">
        <div className="topbar-title">🎟️ OPD Live Queue & Doctor Token Management</div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={() => loadData()}>
            🔄 Refresh Records
          </button>
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
                      <option value="waiting">⏳ Waiting Queue Only</option>
                      <option value="in_progress">🚪 In Doctor Room</option>
                      <option value="completed">✅ Completed</option>
                      <option value="cancelled">❌ Cancelled</option>
                      <option value="all">📋 All Statuses</option>
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
                          <th>Patient Info & OPD Token</th>
                          <th>OP Token Validity (3 Months)</th>
                          <th>Doctor & Dept</th>
                          <th>Queue Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAppointments.map((a: any) => {
                          const createdDate = a.createdAt ? new Date(a.createdAt) : new Date();
                          const issuedAt = a.opdTokenIssuedAt ? new Date(a.opdTokenIssuedAt) : createdDate;
                          const expiresAt = a.opdTokenExpiresAt
                            ? new Date(a.opdTokenExpiresAt)
                            : new Date(issuedAt.getTime() + 90 * 24 * 60 * 60 * 1000);

                          const isTokenValid = new Date() <= expiresAt;
                          const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

                          return (
                            <tr key={a.id}>
                              <td><strong style={{ color: 'var(--primary-light)' }}>{a.appointmentTime}</strong></td>
                              <td>
                                <div style={{ fontWeight: 700 }}>{a.patientName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {a.patientId}</div>
                                {a.notes && <div style={{ fontSize: 10, color: '#0ea5e9' }}>{a.notes}</div>}
                              </td>
                              <td>
                                {isTokenValid ? (
                                  <div>
                                    <span className="badge badge-success" style={{ fontSize: 11 }}>
                                      🟢 Valid ({daysRemaining} days left)
                                    </span>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                                      Exp: {expiresAt.toISOString().split('T')[0]}
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <span className="badge badge-danger" style={{ fontSize: 11 }}>
                                      🔴 Expired (Renewal Required)
                                    </span>
                                    <button
                                      className="btn btn-sm"
                                      style={{ padding: '2px 6px', fontSize: 10, marginTop: 4, background: '#ef4444', color: '#fff', border: 'none' }}
                                      onClick={() => handleRenewToken(a.patientId)}
                                    >
                                      🔄 Renew Token
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div>Dr. {a.doctorName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.department}</div>
                              </td>
                              <td>
                                <select
                                  value={a.status}
                                  onChange={e => handleStatusChange(a, e.target.value)}
                                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}
                                >
                                  {['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td>
                                <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                                  {a.status === 'in_progress' ? (
                                    <span className="badge badge-warning" style={{ padding: '4px 8px', fontSize: 11 }}>
                                      🚪 In Room
                                    </span>
                                  ) : a.status === 'completed' ? (
                                    <span className="badge badge-gray" style={{ padding: '4px 8px', fontSize: 11 }}>
                                      ✅ Completed
                                    </span>
                                  ) : (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      style={{ padding: '3px 8px', fontSize: 11 }}
                                      onClick={() => openSendInModal(a)}
                                      title="Send patient to Doctor's Consultation Room"
                                    >
                                      🚪 Send In
                                    </button>
                                  )}

                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ padding: '3px 8px', fontSize: 11 }}
                                    onClick={() => downloadOpdSlip(a.patientId)}
                                    title="Download Small OP PDF Slip"
                                  >
                                    📄 OP PDF
                                  </button>

                                  {!isTokenValid && (
                                    <button
                                      className="btn btn-sm"
                                      style={{ padding: '3px 8px', fontSize: 11, background: '#ef4444', color: '#fff', border: 'none' }}
                                      onClick={() => handleRenewToken(a.patientId)}
                                    >
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

            </div>
          </>
        )}
      </div>

      {/* Send In Modal to transfer patient to Doctor Room */}
      {showSendInModal && sendInItem && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowSendInModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>🚪 Send Patient to Consultation Room</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowSendInModal(false)}>✕</button>
            </div>
            <form onSubmit={handleConfirmSendIn}>
              <div className="modal-body">
                <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, marginBottom: 16, border: '1px solid var(--border)' }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--primary-light)' }}>
                    {sendInItem.patientName}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Patient ID: <strong>{sendInItem.patientId}</strong> • Dept: <strong>{sendInItem.department}</strong>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Assigned Doctor *</label>
                  <select
                    className="form-control"
                    value={sendInDoctorId}
                    onChange={e => {
                      const docId = e.target.value;
                      setSendInDoctorId(docId);
                      const d = doctors.find((doc: any) => doc.id === docId);
                      if (d) setSendInDoctorName(`${d.firstName} ${d.lastName}`);
                    }}
                    required
                  >
                    <option value="">-- Select Attending Doctor --</option>
                    {doctors.map((d: any) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.firstName} {d.lastName} ({d.department || 'General'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 16 }}>
                  <label className="form-label">Consultation Notes / Reason</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Reason or token notes..."
                    value={sendInNotes}
                    onChange={e => setSendInNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSendInModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={sendingIn}>
                  {sendingIn ? 'Sending In...' : '🚪 Send In to Doctor Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    <label className="form-label">Department *</label>
                    <select
                      className="form-control"
                      value={quickForm.department}
                      onChange={e => setQuickForm(f => ({ ...f, department: e.target.value, doctorId: '', doctorName: '' }))}
                    >
                      {['General', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'Surgery', 'Oncology'].map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Doctor Name * ({eligibleDoctors.length} eligible)</label>
                    <select
                      className="form-control"
                      value={quickForm.doctorId}
                      onChange={e => {
                        const docId = e.target.value;
                        const doc = eligibleDoctors.find(d => d.id === docId);
                        setQuickForm(f => ({
                          ...f,
                          doctorId: docId,
                          doctorName: doc ? `${doc.firstName} ${doc.lastName}` : '',
                        }));
                      }}
                      required
                    >
                      <option value="">Select Doctor</option>
                      {eligibleDoctors.map(d => (
                        <option key={d.id} value={d.id}>
                          Dr. {d.firstName} {d.lastName} ({d.department})
                        </option>
                      ))}
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
