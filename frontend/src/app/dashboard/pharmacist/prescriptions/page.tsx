'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const emptyMed = { name: '', dosage: '', frequency: '', duration: '', quantity: 1, unitCost: 0, instructions: '' };
const FREQUENCIES = ['Once daily', 'Twice daily', 'Three times daily', 'Four times daily', 'Every 6 hours', 'Every 8 hours', 'As needed', 'Before meals', 'After meals'];
const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '1 month', '3 months', 'Ongoing'];

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDispenseModal, setShowDispenseModal] = useState<any>(null);
  const [selectedPrescription, setSelectedPrescription] = useState<any>(null);
  const [medicines, setMedicines] = useState([{ ...emptyMed }]);
  const [form, setForm] = useState({ patientId: '', patientName: '', doctorName: '', diagnosis: '', notes: '', discountAmount: 0, taxAmount: 0 });

  // Dispense Form State
  const [dispenseDiscount, setDispenseDiscount] = useState<number>(0);
  const [dispenseTax, setDispenseTax] = useState<number>(0);
  const [dispenseBillingStatus, setDispenseBillingStatus] = useState<string>('billed');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const loadPrescriptions = () => api.get('/pharmacy/prescriptions').then(r => setPrescriptions(r.data));
  const loadPatients = () => api.get('/patients').then(r => setPatients(r.data)).catch(() => []);

  useEffect(() => {
    loadPrescriptions();
    loadPatients();
  }, []);

  const setF = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const setMed = (i: number, k: string, v: any) => setMedicines(ms => ms.map((m, idx) => idx === i ? { ...m, [k]: v } : m));
  const addMed = () => setMedicines(ms => [...ms, { ...emptyMed }]);
  const removeMed = (i: number) => setMedicines(ms => ms.filter((_, idx) => idx !== i));

  // Subtotal & Total calculations
  const calculateFormSummary = () => {
    const subtotal = medicines.reduce((acc, m) => acc + (Number(m.quantity || 1) * Number(m.unitCost || 0)), 0);
    const disc = Number(form.discountAmount || 0);
    const tax = Number(form.taxAmount || 0);
    const total = Math.max(0, subtotal - disc + tax);
    return { subtotal, total };
  };

  const calculateDispenseSummary = () => {
    if (!showDispenseModal) return { subtotal: 0, total: 0 };
    const subtotal = showDispenseModal.subtotal || showDispenseModal.medicines?.reduce((acc: number, m: any) => acc + (Number(m.lineTotal || (m.quantity * m.unitCost) || 0)), 0) || 0;
    const disc = Number(dispenseDiscount || 0);
    const tax = Number(dispenseTax || 0);
    const total = Math.max(0, subtotal - disc + tax);
    return { subtotal, total };
  };

  const handleSelectPatient = (p: any) => {
    setForm(f => ({
      ...f,
      patientId: p.patientId || p.id,
      patientName: `${p.firstName} ${p.lastName}`,
    }));
    setPatientSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        discountAmount: Number(form.discountAmount || 0),
        taxAmount: Number(form.taxAmount || 0),
        medicines: medicines.map(m => ({
          ...m,
          quantity: Number(m.quantity || 1),
          unitCost: Number(m.unitCost || 0),
          lineTotal: Number(m.quantity || 1) * Number(m.unitCost || 0),
        })),
      };
      await api.post('/pharmacy/prescriptions', payload);
      toast.success('💊 Prescription created with invoice metadata!');
      setShowModal(false);
      setForm({ patientId: '', patientName: '', doctorName: '', diagnosis: '', notes: '', discountAmount: 0, taxAmount: 0 });
      setMedicines([{ ...emptyMed }]);
      loadPrescriptions();
    } catch (e: any) {
      toast.error(e.response?.data?.message?.[0] || e.response?.data?.message || 'Error creating prescription');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDispense = (rx: any) => {
    setShowDispenseModal(rx);
    setDispenseDiscount(Number(rx.discountAmount || 0));
    setDispenseTax(Number(rx.taxAmount || 0));
    setDispenseBillingStatus(rx.billingStatus === 'unbilled' ? 'billed' : rx.billingStatus || 'billed');
  };

  const handleDispenseSubmit = async () => {
    setLoading(true);
    try {
      await api.put(`/pharmacy/prescriptions/${showDispenseModal.id}/dispense`, {
        discountAmount: Number(dispenseDiscount),
        taxAmount: Number(dispenseTax),
        billingStatus: dispenseBillingStatus,
      });
      toast.success('✅ Prescription dispensed and invoice updated!');
      setShowDispenseModal(null);
      loadPrescriptions();
    } catch (e: any) {
      toast.error('Error dispensing prescription');
    } finally {
      setLoading(false);
    }
  };

  // Secure Backend PDF Download
  const handleDownloadPdf = async (rx: any) => {
    try {
      toast.loading('Downloading backend generated PDF...', { id: 'pdf-download' });
      const response = await api.get(`/pharmacy/prescriptions/${rx.id}/pdf`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${rx.prescriptionId}_Invoice.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('📄 Secure PDF Downloaded!', { id: 'pdf-download' });
    } catch (err) {
      toast.error('Failed to download PDF', { id: 'pdf-download' });
    }
  };

  // Print PDF in Browser Window
  const handlePrintPdf = async (rx: any) => {
    try {
      toast.loading('Preparing PDF for printing...', { id: 'pdf-print' });
      const response = await api.get(`/pharmacy/prescriptions/${rx.id}/pdf`, {
        responseType: 'blob',
      });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        toast.error('Please allow popups to open PDF');
      }
      toast.dismiss('pdf-print');
    } catch (err) {
      toast.error('Failed to open PDF for print', { id: 'pdf-print' });
    }
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { pending: 'badge-warning', processing: 'badge-info', dispensed: 'badge-success', cancelled: 'badge-danger' };
    return `badge ${m[s] || 'badge-gray'}`;
  };

  const filteredPrescriptions = prescriptions.filter(p => {
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchesSearch =
      p.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.prescriptionId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const matchingPatients = patientSearch.trim()
    ? patients.filter(p => `${p.firstName} ${p.lastName} ${p.patientId || ''}`.toLowerCase().includes(patientSearch.toLowerCase()))
    : [];

  const formSummary = calculateFormSummary();
  const dispenseSummary = calculateDispenseSummary();

  return (
    <DashboardLayout role="pharmacist">
      <div className="topbar">
        <div className="topbar-title">💊 Prescription & Billing Management</div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Create Prescription</button>
      </div>

      <div className="page-content">
        {/* Search & Filters */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: 260 }}>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search by Patient, Doctor, Rx ID, or Diagnosis..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
              {[
                { id: 'all', label: 'All Prescriptions' },
                { id: 'pending', label: '⏳ Pending' },
                { id: 'dispensed', label: '✅ Dispensed' },
              ].map(t => (
                <button
                  key={t.id}
                  className={`btn btn-sm ${filterStatus === t.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterStatus(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Prescription Table */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="card-title">📜 Prescriptions List ({filteredPrescriptions.length})</span>
            <button
              onClick={async () => {
                setRefreshing(true);
                try { await loadPrescriptions(); toast.success('Prescriptions refreshed!'); }
                catch { toast.error('Failed to refresh'); }
                finally { setRefreshing(false); }
              }}
              disabled={refreshing}
              title="Refresh prescriptions"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                backgroundColor: refreshing ? '#f1f5f9' : '#ffffff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: 600,
                cursor: refreshing ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '15px',
                  animation: refreshing ? 'spin 0.8s linear infinite' : 'none',
                }}
              >
                🔄
              </span>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>

          <div className="table-container">
            {filteredPrescriptions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💊</div>
                <h3>No prescriptions found</h3>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Rx / Invoice ID</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Medicines & Costing</th>
                    <th>Total Cost</th>
                    <th>Dispense Status</th>
                    <th>Billing Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPrescriptions.map(p => (
                    <tr key={p.id}>
                      <td>
                        <code style={{ color: 'var(--primary-light)', fontWeight: 600, fontSize: 13 }}>
                          {p.prescriptionId}
                        </code>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.invoiceNumber || 'INV-N/A'}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.patientName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {p.patientId}</div>
                      </td>
                      <td>Dr. {p.doctorName}</td>
                      <td>
                        <div className="flex gap-1" style={{ flexDirection: 'column' }}>
                          {p.medicines?.map((m: any, idx: number) => (
                            <div key={idx} style={{ fontSize: 12 }}>
                              <strong>💊 {m.name}</strong> ×{m.quantity} (₹{Number(m.unitCost || 0).toFixed(2)}/u) = <span style={{ fontWeight: 600, color: '#38bdf8' }}>₹{Number(m.lineTotal || (m.quantity * m.unitCost) || 0).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>
                          ₹{Number(p.totalCost || 0).toFixed(2)}
                        </div>
                        {Number(p.discountAmount) > 0 && <div style={{ fontSize: 11, color: '#ef4444' }}>Disc: -₹{p.discountAmount}</div>}
                      </td>
                      <td><span className={statusBadge(p.status)}>{p.status}</span></td>
                      <td>
                        <span className={`badge ${p.billingStatus === 'paid' ? 'badge-success' : p.billingStatus === 'billed' ? 'badge-info' : 'badge-warning'}`}>
                          {p.billingStatus || 'unbilled'}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-2 justify-end">
                          <button className="btn btn-secondary btn-sm" onClick={() => setSelectedPrescription(p)} title="View Invoice Sidebar & Details">
                            👁️ View
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={() => handleDownloadPdf(p)} title="Download Authenticated Backend PDF">
                            ⬇️ PDF
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => handlePrintPdf(p)} title="Print PDF">
                            🖨️ Print
                          </button>
                          {(p.status === 'pending' || p.status === 'processing') && (
                            <button className="btn btn-success btn-sm" onClick={() => handleOpenDispense(p)}>
                              ✅ Dispense & Bill
                            </button>
                          )}
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

      {/* View Prescription & Sidebar Invoice Modal */}
      {selectedPrescription && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedPrescription(null)}>
          <div className="modal" style={{ maxWidth: 880 }}>
            <div className="modal-header">
              <h3>📋 Prescription & Billing Invoice ({selectedPrescription.prescriptionId})</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setSelectedPrescription(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
              {/* Main Content */}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-surface)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                  <div>
                    <label className="form-label" style={{ fontSize: 11, margin: 0 }}>PATIENT</label>
                    <div style={{ fontWeight: 700 }}>{selectedPrescription.patientName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: {selectedPrescription.patientId}</div>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: 11, margin: 0 }}>DOCTOR</label>
                    <div style={{ fontWeight: 700 }}>{selectedPrescription.doctorName}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Diagnosis: {selectedPrescription.diagnosis || 'None'}</div>
                  </div>
                </div>

                <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--primary-light)' }}>💊 Prescribed Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {selectedPrescription.medicines?.map((m: any, i: number) => (
                    <div key={i} style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 6, border: '1px solid var(--border)', fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>💊 {m.name} ({m.dosage})</span>
                        <span>₹{Number(m.lineTotal || (m.quantity * m.unitCost) || 0).toFixed(2)}</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>
                        Qty: {m.quantity} × ₹{Number(m.unitCost || 0).toFixed(2)} | Freq: {m.frequency || 'N/A'} | Duration: {m.duration || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invoice Sidebar */}
              <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 700, borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 12 }}>
                    🧾 Billing Summary
                  </h4>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Subtotal:</span>
                    <span>₹{Number(selectedPrescription.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Discount:</span>
                    <span style={{ color: '#ef4444' }}>-₹{Number(selectedPrescription.discountAmount || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 10 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tax / Fee:</span>
                    <span>+₹{Number(selectedPrescription.taxAmount || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ borderTop: '2px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                    <span>Total Cost:</span>
                    <span style={{ color: '#38bdf8' }}>₹{Number(selectedPrescription.totalCost || 0).toFixed(2)}</span>
                  </div>

                  <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--border)', fontSize: 12 }}>
                    <div><strong>Billing Status:</strong> <span className={`badge ${selectedPrescription.billingStatus === 'paid' ? 'badge-success' : 'badge-info'}`}>{selectedPrescription.billingStatus}</span></div>
                    <div style={{ marginTop: 6 }}><strong>Dispense Status:</strong> <span className={statusBadge(selectedPrescription.status)}>{selectedPrescription.status}</span></div>
                    {selectedPrescription.invoicePdfHash && (
                      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-card)', padding: 6, borderRadius: 4 }}>
                        🔒 Hash Verified<br />
                        SHA-256 Metadata stored
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-2" style={{ flexDirection: 'column', marginTop: 16 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleDownloadPdf(selectedPrescription)}>
                    ⬇️ Authenticated PDF
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handlePrintPdf(selectedPrescription)}>
                    🖨️ Print Invoice
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Prescription Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 840 }}>
            <div className="modal-header">
              <h3>💊 Create New Prescription & Generate PDF Invoice</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {/* Patient Search */}
                <div className="form-group" style={{ marginBottom: 16, position: 'relative' }}>
                  <label className="form-label">🔍 Search Patient</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Search existing patients..."
                    value={patientSearch}
                    onChange={e => setPatientSearch(e.target.value)}
                  />
                  {matchingPatients.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, maxHeight: 150, overflowY: 'auto' }}>
                      {matchingPatients.map(p => (
                        <div key={p.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border)', fontSize: 13 }} onClick={() => handleSelectPatient(p)}>
                          <strong>{p.firstName} {p.lastName}</strong> ({p.patientId})
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-grid form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group"><label className="form-label">Patient Name *</label><input className="form-control" value={form.patientName} onChange={e => setF('patientName', e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Patient ID *</label><input className="form-control" value={form.patientId} onChange={e => setF('patientId', e.target.value)} required /></div>
                  <div className="form-group"><label className="form-label">Doctor Name *</label><input className="form-control" value={form.doctorName} onChange={e => setF('doctorName', e.target.value)} required /></div>
                </div>

                {/* Medicines List */}
                <div style={{ marginBottom: 16 }}>
                  <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ margin: 0 }}>Medicines, Unit Cost & Quantities *</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addMed}>+ Add Medicine</button>
                  </div>
                  {medicines.map((med, i) => {
                    const lineTot = Number(med.quantity || 1) * Number(med.unitCost || 0);
                    return (
                      <div key={i} className="card" style={{ marginBottom: 10, padding: 12 }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--primary-light)' }}>Item #{i + 1} - Total: ₹{lineTot.toFixed(2)}</span>
                          {medicines.length > 1 && <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => removeMed(i)}>✕</button>}
                        </div>
                        <div className="form-grid form-grid-4">
                          <div className="form-group"><label className="form-label">Name *</label><input className="form-control" placeholder="Paracetamol" value={med.name} onChange={e => setMed(i, 'name', e.target.value)} required /></div>
                          <div className="form-group"><label className="form-label">Dosage *</label><input className="form-control" placeholder="500mg" value={med.dosage} onChange={e => setMed(i, 'dosage', e.target.value)} required /></div>
                          <div className="form-group"><label className="form-label">Unit Cost (₹)</label><input type="number" step="0.01" min="0" className="form-control" value={med.unitCost} onChange={e => setMed(i, 'unitCost', parseFloat(e.target.value) || 0)} required /></div>
                          <div className="form-group"><label className="form-label">Quantity</label><input type="number" min="1" className="form-control" value={med.quantity} onChange={e => setMed(i, 'quantity', parseInt(e.target.value) || 1)} required /></div>
                        </div>
                        <div className="form-grid form-grid-3" style={{ marginTop: 8 }}>
                          <div className="form-group"><label className="form-label">Frequency</label><select className="form-control" value={med.frequency} onChange={e => setMed(i, 'frequency', e.target.value)}><option value="">Select</option>{FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select></div>
                          <div className="form-group"><label className="form-label">Duration</label><select className="form-control" value={med.duration} onChange={e => setMed(i, 'duration', e.target.value)}><option value="">Select</option>{DURATIONS.map(d => <option key={d}>{d}</option>)}</select></div>
                          <div className="form-group"><label className="form-label">Instructions</label><input className="form-control" placeholder="After food" value={med.instructions} onChange={e => setMed(i, 'instructions', e.target.value)} /></div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Calculation Sidebar Box in Form */}
                <div style={{ background: 'var(--bg-surface)', padding: 14, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 220px', gap: 16 }}>
                  <div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Diagnosis & Doctor Notes</label>
                      <input className="form-control" style={{ marginBottom: 8 }} placeholder="Diagnosis..." value={form.diagnosis} onChange={e => setF('diagnosis', e.target.value)} />
                      <textarea className="form-control" rows={2} placeholder="Notes..." value={form.notes} onChange={e => setF('notes', e.target.value)} />
                    </div>
                  </div>
                  <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 6, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Automatic Invoice Totals</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span>Subtotal:</span>
                      <span>₹{formSummary.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="form-group" style={{ marginBottom: 4 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Discount (₹)</label>
                      <input type="number" step="0.01" className="form-control form-control-sm" value={form.discountAmount} onChange={e => setF('discountAmount', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 6 }}>
                      <label className="form-label" style={{ fontSize: 10 }}>Tax / Charge (₹)</label>
                      <input type="number" step="0.01" className="form-control form-control-sm" value={form.taxAmount} onChange={e => setF('taxAmount', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6, fontWeight: 700, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total:</span>
                      <span style={{ color: '#38bdf8' }}>₹{formSummary.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Generating PDF & Saving...' : '💊 Create & Store PDF Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dispense Modal with Invoice Update */}
      {showDispenseModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>✅ Dispense & Finalize Billing</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowDispenseModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 12, color: 'var(--text-secondary)' }}>
                Dispensing <strong>{showDispenseModal.prescriptionId}</strong> for <strong>{showDispenseModal.patientName}</strong>
              </p>

              <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Calculated Subtotal:</span>
                  <strong>₹{dispenseSummary.subtotal.toFixed(2)}</strong>
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Discount Amount (₹)</label>
                  <input type="number" step="0.01" className="form-control" value={dispenseDiscount} onChange={e => setDispenseDiscount(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Tax / Additional Charges (₹)</label>
                  <input type="number" step="0.01" className="form-control" value={dispenseTax} onChange={e => setDispenseTax(parseFloat(e.target.value) || 0)} />
                </div>
                <div className="form-group" style={{ marginBottom: 8 }}>
                  <label className="form-label">Billing Status</label>
                  <select className="form-control" value={dispenseBillingStatus} onChange={e => setDispenseBillingStatus(e.target.value)}>
                    <option value="billed">Billed</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
                  <span>Final Total:</span>
                  <span style={{ color: '#38bdf8' }}>₹{dispenseSummary.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDispenseModal(null)}>Cancel</button>
              <button className="btn btn-success" onClick={handleDispenseSubmit} disabled={loading}>
                {loading ? '⏳...' : '✅ Confirm Dispense & Update PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
