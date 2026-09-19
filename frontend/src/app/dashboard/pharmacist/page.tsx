'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const emptyMed = { name: '', dosage: '', frequency: '', duration: '', quantity: 1, instructions: '' };
const emptyTablet = { name: '', power: '', price: '', mfgDate: '', expiryDate: '', stockQuantity: '', category: '', manufacturer: '' };
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 6 hours', 'Every 8 hours', 'As needed', 'Before meals', 'After meals'];
const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '3 months', 'Ongoing'];

export default function PharmacistDashboard() {
  const [mainTab, setMainTab] = useState<'prescriptions' | 'tablets'>('prescriptions');
  
  // Prescriptions State
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState<any>(null);
  const [medicines, setMedicines] = useState([{ ...emptyMed }]);
  const [form, setForm] = useState({ patientId: '', patientName: '', doctorName: '', diagnosis: '', notes: '' });
  const [totalCost, setTotalCost] = useState('');
  const [tab, setTab] = useState<'all' | 'pending'>('pending');

  // Tablets Inventory State
  const [tablets, setTablets] = useState<any[]>([]);
  const [tabletSearch, setTabletSearch] = useState('');
  const [showTabletModal, setShowTabletModal] = useState(false);
  const [editingTablet, setEditingTablet] = useState<any>(null);
  const [tabletForm, setTabletForm] = useState({ ...emptyTablet });

  const [loading, setLoading] = useState(false);

  const loadPrescriptions = () => api.get('/pharmacy/prescriptions').then(r => setPrescriptions(r.data)).catch(() => []);
  const loadTablets = () => api.get('/pharmacy/tablets').then(r => setTablets(r.data)).catch(() => []);

  useEffect(() => {
    loadPrescriptions();
    loadTablets();
  }, []);

  // Prescription Form Handlers
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const setMed = (i: number, k: string, v: string | number) => setMedicines(ms => ms.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const addMed = () => setMedicines(ms => [...ms, { ...emptyMed }]);
  const removeMed = (i: number) => setMedicines(ms => ms.filter((_, idx) => idx !== i));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await api.post('/pharmacy/prescriptions', { ...form, medicines });
      toast.success('💊 Prescription created! Pharmacist notified.');
      setShowModal(false); setForm({ patientId: '', patientName: '', doctorName: '', diagnosis: '', notes: '' });
      setMedicines([{ ...emptyMed }]); loadPrescriptions();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error'); }
    finally { setLoading(false); }
  };

  const handleDispense = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await api.put(`/pharmacy/prescriptions/${showDispenseModal.id}/dispense`, { totalCost: parseFloat(totalCost) || 0 });
      toast.success('✅ Prescription dispensed!'); setShowDispenseModal(null); setTotalCost(''); loadPrescriptions();
    } catch (e: any) { toast.error('Error'); }
    finally { setLoading(false); }
  };

  // Tablet Form Handlers
  const setTF = (k: string, v: string) => setTabletForm(tf => ({ ...tf, [k]: v }));

  const openAddTabletModal = () => {
    setEditingTablet(null);
    setTabletForm({ ...emptyTablet });
    setShowTabletModal(true);
  };

  const openEditTabletModal = (tablet: any) => {
    setEditingTablet(tablet);
    setTabletForm({
      name: tablet.name || '',
      power: tablet.power || '',
      price: tablet.price?.toString() || '',
      mfgDate: tablet.mfgDate || '',
      expiryDate: tablet.expiryDate || '',
      stockQuantity: tablet.stockQuantity?.toString() || '',
      category: tablet.category || '',
      manufacturer: tablet.manufacturer || '',
    });
    setShowTabletModal(true);
  };

  const handleSaveTablet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      const payload = {
        name: tabletForm.name,
        power: tabletForm.power,
        price: parseFloat(tabletForm.price) || 0,
        mfgDate: tabletForm.mfgDate,
        expiryDate: tabletForm.expiryDate,
        stockQuantity: parseInt(tabletForm.stockQuantity) || 0,
        category: tabletForm.category || 'General',
        manufacturer: tabletForm.manufacturer || 'Standard',
      };

      if (editingTablet) {
        await api.put(`/pharmacy/tablets/${editingTablet.id}`, payload);
        toast.success(`💊 Tablet "${tabletForm.name}" updated successfully!`);
      } else {
        await api.post('/pharmacy/tablets', payload);
        toast.success(`💊 New Tablet "${tabletForm.name} (${tabletForm.power})" added to store!`);
      }
      setShowTabletModal(false);
      loadTablets();
    } catch (err: any) {
      toast.error(err.response?.data?.message?.[0] || err.response?.data?.message || 'Failed to save tablet');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTablet = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name} from store stock?`)) return;
    try {
      await api.delete(`/pharmacy/tablets/${id}`);
      toast.success(`Deleted ${name} from inventory.`);
      loadTablets();
    } catch (err: any) {
      toast.error('Failed to delete tablet');
    }
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { pending: 'badge-warning', processing: 'badge-info', dispensed: 'badge-success', cancelled: 'badge-danger' };
    return `badge ${m[s] || 'badge-gray'}`;
  };

  const shownPrescriptions = tab === 'pending'
    ? prescriptions.filter(p => {
        const s = (p.status || '').toLowerCase();
        return s === 'pending' || s === 'processing';
      })
    : prescriptions;

  const filteredTablets = tablets.filter(t => {
    const q = tabletSearch.toLowerCase();
    return (
      t.name?.toLowerCase().includes(q) ||
      t.power?.toLowerCase().includes(q) ||
      t.category?.toLowerCase().includes(q) ||
      t.manufacturer?.toLowerCase().includes(q)
    );
  });

  const totalStockCount = tablets.reduce((acc, t) => acc + Number(t.stockQuantity || 0), 0);
  const lowStockCount = tablets.filter(t => Number(t.stockQuantity || 0) < 100).length;

  return (
    <DashboardLayout role="pharmacist">
      <div className="topbar">
        <div className="topbar-title">Pharmacy Portal</div>
        <div className="flex gap-2" style={{ alignItems: 'center' }}>
          <div className="flex gap-1" style={{ background: 'var(--bg-surface)', padding: 4, borderRadius: 8, border: '1px solid var(--border)' }}>
            <button
              className={`btn btn-sm ${mainTab === 'prescriptions' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMainTab('prescriptions')}
            >
              📜 Prescriptions
            </button>
            <button
              className={`btn btn-sm ${mainTab === 'tablets' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setMainTab('tablets')}
            >
              💊 Store Tablets ({tablets.length})
            </button>
          </div>

          {mainTab === 'prescriptions' ? (
            <>
              <a href="/dashboard/pharmacist/prescriptions" className="btn btn-secondary">📜 All Prescriptions</a>
              <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ New Prescription</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={openAddTabletModal}>
              + Add Tablet to Store
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        {/* VIEW TAB 1: PRESCRIPTIONS */}
        {mainTab === 'prescriptions' && (
          <>
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
                <span className="card-title">💊 Prescriptions Queue</span>
                <div className="flex gap-2">
                  {(['pending', 'all'] as const).map(t => (
                    <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
                      {t === 'pending' ? 'Pending' : 'All'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="table-container">
                {shownPrescriptions.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">💊</div><h3>No prescriptions found</h3></div>
                ) : (
                  <table>
                    <thead><tr><th>Rx ID</th><th>Patient</th><th>Doctor</th><th>Medicines</th><th>Status</th><th>Date</th><th>Action</th></tr></thead>
                    <tbody>
                      {shownPrescriptions.map(p => (
                        <tr key={p.id}>
                          <td><code style={{ color: 'var(--primary-light)', fontSize: 12 }}>{p.prescriptionId}</code></td>
                          <td><strong>{p.patientName}</strong></td>
                          <td>{p.doctorName}</td>
                          <td>
                            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                              {p.medicines?.slice(0, 2).map((m: any, i: number) => <span key={i} className="medicine-tag">💊 {m.name}</span>)}
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
          </>
        )}

        {/* VIEW TAB 2: STORE TABLETS INVENTORY */}
        {mainTab === 'tablets' && (
          <>
            <div className="stats-grid">
              {[
                { icon: '💊', label: 'Tablet Varieties', value: tablets.length, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
                { icon: '📦', label: 'Total Store Units', value: totalStockCount.toLocaleString(), color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
                { icon: '⚠️', label: 'Low Stock Alert (<100)', value: lowStockCount, color: lowStockCount > 0 ? '#ef4444' : '#10b981', gradient: lowStockCount > 0 ? 'linear-gradient(135deg,#ef4444,#f87171)' : 'linear-gradient(135deg,#10b981,#34d399)' },
                { icon: '🏬', label: 'Categories', value: Array.from(new Set(tablets.map(t => t.category || 'General'))).length, color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
              ].map(s => (
                <div key={s.label} className="stat-card" style={{ '--gradient': s.gradient } as any}>
                  <div className="stat-icon" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
                  <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 260 }}>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="🔍 Search tablets by name, power (500mg, 200mg), category..."
                    value={tabletSearch}
                    onChange={e => setTabletSearch(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" onClick={openAddTabletModal}>
                  + Add Tablet
                </button>
              </div>

              <div className="table-container">
                {filteredTablets.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">💊</div>
                    <h3>No tablets found in store stock</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                      Click "+ Add Tablet" to add medicines one by one with name, price, power (500mg, 200mg), MFG date, and expiry date.
                    </p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Tablet Name</th>
                        <th>Power / Dosage</th>
                        <th>Price (per unit)</th>
                        <th>MFG Date</th>
                        <th>Expiry Date</th>
                        <th>Stock Level</th>
                        <th>Category</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTablets.map(t => {
                        const isLow = Number(t.stockQuantity || 0) < 100;
                        const expDate = t.expiryDate ? new Date(t.expiryDate) : null;
                        const isExpired = expDate ? expDate < new Date() : false;

                        return (
                          <tr key={t.id}>
                            <td>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>💊 {t.name}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.manufacturer || 'Standard'}</div>
                            </td>
                            <td>
                              <span className="badge badge-info" style={{ fontWeight: 600, fontSize: 12 }}>
                                ⚡ {t.power}
                              </span>
                            </td>
                            <td>
                              <strong style={{ color: '#10b981', fontSize: 14 }}>
                                ₹{Number(t.price || 0).toFixed(2)}
                              </strong>
                            </td>
                            <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              {t.mfgDate || 'N/A'}
                            </td>
                            <td>
                              {t.expiryDate ? (
                                <span className={`badge ${isExpired ? 'badge-danger' : 'badge-gray'}`}>
                                  📅 {t.expiryDate} {isExpired && '(EXPIRED)'}
                                </span>
                              ) : (
                                <span className="text-muted">N/A</span>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`} style={{ fontWeight: 600 }}>
                                📦 {t.stockQuantity} units
                              </span>
                            </td>
                            <td>
                              <span className="badge badge-gray" style={{ fontSize: 11 }}>
                                {t.category || 'General'}
                              </span>
                            </td>
                            <td>
                              <div className="flex gap-2">
                                <button className="btn btn-secondary btn-sm" onClick={() => openEditTabletModal(t)} title="Edit Tablet">
                                  ✏️ Edit
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteTablet(t.id, `${t.name} (${t.power})`)} title="Delete Tablet">
                                  🗑️ Delete
                                </button>
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
          </>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT TABLET IN STORE */}
      {showTabletModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowTabletModal(false)}>
          <div className="modal" style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3>💊 {editingTablet ? 'Edit Store Tablet' : 'Add Tablet to Store Inventory'}</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowTabletModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveTablet}>
              <div className="modal-body">
                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Tablet Name *</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Paracetamol, Amoxicillin"
                      value={tabletForm.name}
                      onChange={e => setTF('name', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Power / Strength (Dosage) *</label>
                    <input
                      className="form-control"
                      placeholder="e.g. 500mg, 200mg, 10mg"
                      value={tabletForm.power}
                      onChange={e => setTF('power', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Price per Tablet (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      className="form-control"
                      placeholder="e.g. 15.00"
                      value={tabletForm.price}
                      onChange={e => setTF('price', e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Stock Quantity (Units) *</label>
                    <input
                      type="number"
                      min="0"
                      className="form-control"
                      placeholder="e.g. 500"
                      value={tabletForm.stockQuantity}
                      onChange={e => setTF('stockQuantity', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Manufacturing (MFG) Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={tabletForm.mfgDate}
                      onChange={e => setTF('mfgDate', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Expiry Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={tabletForm.expiryDate}
                      onChange={e => setTF('expiryDate', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Analgesic, Antibiotic, Antacid"
                      value={tabletForm.category}
                      onChange={e => setTF('category', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Manufacturer / Brand</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Cipla, Sun Pharma, Abbott"
                      value={tabletForm.manufacturer}
                      onChange={e => setTF('manufacturer', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowTabletModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Saving...' : editingTablet ? '✏️ Save Tablet Changes' : '➕ Add Tablet to Store'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW PRESCRIPTION */}
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

      {/* MODAL 3: DISPENSE */}
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
