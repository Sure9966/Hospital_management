'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const emptyMed = { name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' };
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 6 hours', 'Every 8 hours', 'As needed', 'Before meals', 'After meals'];
const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '3 months', 'Ongoing'];

export default function PharmacistDashboard() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState<any>(null);
  const [medicines, setMedicines] = useState([{ ...emptyMed }]);
  const [form, setForm] = useState({ patientId: '', patientName: '', doctorName: '', diagnosis: '', notes: '' });
  const [totalCost, setTotalCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'all' | 'pending'>('pending');

  const load = () => api.get('/pharmacy/prescriptions').then(r => setPrescriptions(r.data));
  useEffect(() => { load(); }, []);

  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setMed = (i: number, k: string, v: string | number) => setMedicines(ms => ms.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const addMed = () => setMedicines(ms => [...ms, { ...emptyMed }]);
  const removeMed = (i: number) => setMedicines(ms => ms.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      await api.post('/pharmacy/prescriptions', { ...form, medicines });
      toast.success('💊 Prescription created! Pharmacist notified.');
      setShowModal(false); setForm({ patientId: '', patientName: '', doctorName: '', diagnosis: '', notes: '' });
      setMedicines([{ ...emptyMed }]); load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  const handleDispense = async () => {
    setLoading(true);
    try {
      await api.put(`/pharmacy/prescriptions/${showDispenseModal.id}/dispense`, { totalCost: parseFloat(totalCost) || 0 });
      toast.success('✅ Prescription dispensed!'); setShowDispenseModal(null); setTotalCost(''); load();
    } catch (e: any) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { pending: 'badge-warning', processing: 'badge-info', dispensed: 'badge-success', cancelled: 'badge-danger' };
    return `badge ${m[s] || 'badge-gray'}`;
  };

  const shown = tab === 'pending' ? prescriptions.filter(p => p.status === 'pending' || p.status === 'processing') : prescriptions;

  return (
    <DashboardLayout role="pharmacist">
      <div className="topbar">
        <div className="topbar-title">Pharmacy Dashboard</div>
        <div className="flex gap-2">
          <a href="/dashboard/pharmacist/prescriptions" className="btn btn-secondary">📜 All Prescriptions</a>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Prescription</button>
        </div>
      </div>
      <div className="page-content">
        <div className="stats-grid">
          {[
            { icon: '💊', label: 'Total Prescriptions', value: prescriptions.length, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
            { icon: '⏳', label: 'Pending', value: prescriptions.filter(p => p.status === 'pending').length, color: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
            { icon: '✅', label: 'Dispensed', value: prescriptions.filter(p => p.status === 'dispensed').length, color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
            { icon: '🔄', label: 'Processing', value: prescriptions.filter(p => p.status === 'processing').length, color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--gradient': s.gradient } as any}>
              <div className="stat-icon" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">💊 Prescriptions</span>
            <div className="flex gap-2">
              {(['pending','all'] as const).map(t => (
                <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
                  {t === 'pending' ? 'Pending' : 'All'}
                </button>
              ))}
            </div>
          </div>
          <div className="table-container">
            {shown.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">💊</div><h3>No prescriptions found</h3></div>
            ) : (
              <table>
                <thead><tr><th>Rx ID</th><th>Patient</th><th>Doctor</th><th>Medicines</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {shown.map(p => (
                    <tr key={p.id}>
                      <td><code style={{ color: 'var(--primary-light)', fontSize: 12 }}>{p.prescriptionId}</code></td>
                      <td><strong>{p.patientName}</strong></td>
                      <td>Dr. {p.doctorName}</td>
                      <td>
                        <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                          {p.medicines?.slice(0,2).map((m: any, i: number) => <span key={i} className="medicine-tag">💊 {m.name}</span>)}
                          {p.medicines?.length > 2 && <span className="badge badge-gray">+{p.medicines.length - 2}</span>}
                        </div>
                      </td>
                      <td><span className={statusBadge(p.status)}>{p.status}</span></td>
                      <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                      <td>
                        {(p.status === 'pending' || p.status === 'processing') && (
                          <button className="btn btn-success btn-sm" onClick={() => setShowDispenseModal(p)}>
                            ✅ Dispense
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* New Prescription Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <h3>💊 New Prescription</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid form-grid-2" style={{ marginBottom: 16 }}>
                  <div className="form-group"><label className="form-label">Patient Name *</label><input className="form-control" value={form.patientName} onChange={e => setF('patientName', e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Patient ID</label><input className="form-control" value={form.patientId} onChange={e => setF('patientId', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Doctor Name *</label><input className="form-control" value={form.doctorName} onChange={e => setF('doctorName', e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Diagnosis</label><input className="form-control" value={form.diagnosis} onChange={e => setF('diagnosis', e.target.value)} /></div>
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ margin: 0 }}>Medicines *</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addMed}>+ Add Medicine</button>
                  </div>
                  {medicines.map((med, i) => (
                    <div key={i} className="card" style={{ marginBottom: 12, padding: 14 }}>
                      <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-light)' }}>Medicine #{i + 1}</span>
                        {medicines.length > 1 && <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeMed(i)}>✕</button>}
                      </div>
                      <div className="form-grid form-grid-3">
                        <div className="form-group"><label className="form-label">Name *</label><input className="form-control" placeholder="Paracetamol" value={med.name} onChange={e => setMed(i, 'name', e.target.value)} required /></div>
                        <div className="form-group"><label className="form-label">Dosage *</label><input className="form-control" placeholder="500mg" value={med.dosage} onChange={e => setMed(i, 'dosage', e.target.value)} required /></div>
                        <div className="form-group"><label className="form-label">Quantity</label><input type="number" className="form-control" min={1} value={med.quantity} onChange={e => setMed(i, 'quantity', parseInt(e.target.value))} /></div>
                        <div className="form-group"><label className="form-label">Frequency</label><select className="form-control" value={med.frequency} onChange={e => setMed(i, 'frequency', e.target.value)}><option value="">Select</option>{FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select></div>
                        <div className="form-group"><label className="form-label">Duration</label><select className="form-control" value={med.duration} onChange={e => setMed(i, 'duration', e.target.value)}><option value="">Select</option>{DURATIONS.map(d => <option key={d}>{d}</option>)}</select></div>
                        <div className="form-group"><label className="form-label">Instructions</label><input className="form-control" placeholder="Take with food" value={med.instructions} onChange={e => setMed(i, 'instructions', e.target.value)} /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={e => setF('notes', e.target.value)} /></div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? '⏳ Creating...' : '💊 Create Prescription'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispense Modal */}
      {showDispenseModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>✅ Dispense Prescription</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowDispenseModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
                Dispensing <strong>{showDispenseModal.prescriptionId}</strong> for <strong>{showDispenseModal.patientName}</strong>
              </p>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: 12, marginBottom: 16 }}>
                {showDispenseModal.medicines?.map((m: any, i: number) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <span>💊 {m.name} {m.dosage}</span>
                    <span className="text-muted">×{m.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Total Cost ($)</label>
                <input type="number" className="form-control" placeholder="0.00" value={totalCost} onChange={e => setTotalCost(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDispenseModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleDispense} disabled={loading}>{loading ? '⏳...' : '✅ Confirm Dispense'}</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
