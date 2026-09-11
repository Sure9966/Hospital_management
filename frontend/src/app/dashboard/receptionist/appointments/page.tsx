'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const DEPARTMENTS = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General', 'Emergency', 'Surgery', 'Oncology'];
const TIMES = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

const emptyForm = {
  patientId: '', patientName: '', doctorId: '', doctorName: '', department: '',
  appointmentDate: '', appointmentTime: '', reason: '', notes: '',
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [eligibleDoctors, setEligibleDoctors] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);

  const load = () => {
    api.get('/receptionist/appointments').then(r => setAppointments(r.data));
    api.get('/patients').then(r => setPatients(r.data || [])).catch(() => { });
  };
  useEffect(() => { load(); }, []);

  const handlePatientSelect = (selectedId: string) => {
    const p = patients.find(pat => pat.patientId === selectedId || pat.id === selectedId);
    if (p) {
      setForm(f => ({
        ...f,
        patientId: p.patientId,
        patientName: `${p.firstName} ${p.lastName}`,
        department: p.department || f.department,
        doctorId: p.assignedDoctorId || f.doctorId,
        doctorName: p.assignedDoctorName || f.doctorName,
      }));
    } else {
      set('patientId', selectedId);
    }
  };

  useEffect(() => {
    const url = form.department ? `/users/doctors?department=${encodeURIComponent(form.department)}` : '/users/doctors';
    api.get(url)
      .then(res => setEligibleDoctors(res.data || []))
      .catch(() => setEligibleDoctors([]));
  }, [form.department]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      if (editId) {
        await api.put(`/receptionist/appointments/${editId}`, form);
        toast.success('Appointment updated!');
      } else {
        await api.post('/receptionist/appointments', form);
        toast.success('Appointment scheduled! Staff notified.');
      }
      setShowModal(false); setForm({ ...emptyForm }); setEditId(null); load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  const handleEdit = (a: any) => {
    setForm({ patientId: a.patientId, patientName: a.patientName, doctorId: a.doctorId || '', doctorName: a.doctorName, department: a.department, appointmentDate: a.appointmentDate, appointmentTime: a.appointmentTime, reason: a.reason || '', notes: a.notes || '' });
    setEditId(a.id); setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/receptionist/appointments/${id}`); toast.success('Deleted'); setConfirmDeleteId(null); load();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.put(`/receptionist/appointments/${id}`, { status }); load();
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = { scheduled: 'badge-info', confirmed: 'badge-success', in_progress: 'badge-warning', completed: 'badge-gray', cancelled: 'badge-danger' };
    return `badge ${map[s] || 'badge-gray'}`;
  };

  return (
    <DashboardLayout role="receptionist">
      <div className="topbar">
        <div className="topbar-title">Appointments</div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...emptyForm }); setEditId(null); setShowModal(true); }}>
          + New Appointment
        </button>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="card-header">
            <span className="card-title">📅 All Appointments ({appointments.length})</span>
          </div>
          <div className="table-container">
            {appointments.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">📅</div><h3>No appointments yet</h3></div>
            ) : (
              <table>
                <thead>
                  <tr><th>Patient</th><th>Doctor</th><th>Department</th><th>Date</th><th>Time</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {appointments.map(a => (
                    <tr key={a.id}>
                      <td><strong>{a.patientName}</strong><br /><span className="text-muted text-xs">{a.patientId}</span></td>
                      <td>Dr. {a.doctorName}</td>
                      <td>{a.department}</td>
                      <td>{a.appointmentDate}</td>
                      <td>{a.appointmentTime}</td>
                      <td>
                        <select value={a.status} onChange={e => handleStatusChange(a.id, e.target.value)}
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', borderRadius: 8, padding: '4px 8px', fontSize: 12, cursor: 'pointer' }}>
                          {['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td>
                        <div className="flex gap-2">
                          <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(a)}>✏️</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteId(a.id)}>🗑️</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editId ? 'Edit Appointment' : 'Schedule Appointment'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid form-grid-2">
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Select Registered Patient (Auto-fills details)</label>
                    <select
                      className="form-control"
                      value={form.patientId}
                      onChange={e => handlePatientSelect(e.target.value)}
                    >
                      <option value="">-- Choose Existing Patient or Enter Details Below --</option>
                      {patients.map(p => (
                        <option key={p.patientId} value={p.patientId}>
                          {p.firstName} {p.lastName} ({p.patientId}) {p.department ? `• ${p.department}` : ''} {p.assignedDoctorName ? `• Dr. ${p.assignedDoctorName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient Name *</label>
                    <input className="form-control" placeholder="Full name" value={form.patientName} onChange={e => set('patientName', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient ID</label>
                    <input className="form-control" placeholder="NMH26000000" value={form.patientId} onChange={e => set('patientId', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department *</label>
                    <select
                      className="form-control"
                      value={form.department}
                      onChange={e => {
                        set('department', e.target.value);
                        setForm(f => ({ ...f, doctorId: '', doctorName: '' }));
                      }}
                      required
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Doctor Name * ({eligibleDoctors.length} eligible)</label>
                    <select
                      className="form-control"
                      value={form.doctorId}
                      onChange={e => {
                        const docId = e.target.value;
                        const doc = eligibleDoctors.find(d => d.id === docId);
                        setForm(f => ({
                          ...f,
                          doctorId: docId,
                          doctorName: doc ? `${doc.firstName} ${doc.lastName}` : (docId ? f.doctorName : ''),
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
                  <div className="form-group">
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-control" value={form.appointmentDate} onChange={e => set('appointmentDate', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Time *</label>
                    <select className="form-control" value={form.appointmentTime} onChange={e => set('appointmentTime', e.target.value)} required>
                      <option value="">Select Time</option>
                      {TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Reason for Visit</label>
                    <input className="form-control" placeholder="Brief reason" value={form.reason} onChange={e => set('reason', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Saving...' : (editId ? 'Update' : 'Schedule')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Appointment Confirmation Modal */}
      {confirmDeleteId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🗑️ Delete Appointment</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setConfirmDeleteId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14 }}>Are you sure you want to delete this appointment? This cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(confirmDeleteId)}>🗑️ Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
