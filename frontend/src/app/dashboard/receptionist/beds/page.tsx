'use client';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CenteredLoader from '@/components/CenteredLoader';
import api from '@/lib/api';
import toast from 'react-hot-toast';

enum BedStatus {
  VACANT = 'vacant',
  OCCUPIED = 'occupied',
  CLEANING = 'cleaning',
  MAINTENANCE = 'maintenance',
}

interface Ward {
  id: string;
  name: string;
  floor: string;
  description: string;
  beds: Bed[];
}

interface Bed {
  id: string;
  bedNumber: string;
  roomNumber: string;
  status: BedStatus;
  wardId: string;
  ward?: Ward;
  currentPatientId?: string;
  currentPatientName?: string;
  admissionDate?: string;
}

interface Admission {
  id: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  diagnosis: string;
  requestedWard: string;
  allocatedBedNumber?: string;
  status: 'pending' | 'admitted' | 'discharged' | 'cancelled';
  createdAt: string;
  notes?: string;
}

export default function ReceptionistBedManagement() {
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<'beds' | 'queue' | 'billing'>('queue');

  // Filters
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modals
  const [showAllocateModal, setShowAllocateModal] = useState<Admission | null>(null);
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [confirmDischargeBedId, setConfirmDischargeBedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Bed Allocation
  const [targetBedId, setTargetBedId] = useState('');

  // Billing / Payment state
  const [billingRecords, setBillingRecords] = useState<any[]>([]);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingForm, setBillingForm] = useState({
    patientId: '',
    patientName: '',
    consultationFee: 500,
    medicineAmount: 0,
    testAmount: 0,
    bedCharges: 0,
    paymentMethod: 'cash',
    notes: '',
  });

  // Admission Request Form
  const [admissionForm, setAdmissionForm] = useState({
    patientId: '',
    patientName: '',
    doctorName: '',
    diagnosis: '',
    requestedWard: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const [wardsRes, bedsRes, admRes] = await Promise.all([
        api.get('/beds/wards'),
        api.get('/beds'),
        api.get('/beds/admissions'),
      ]);
      setWards(wardsRes.data);
      setBeds(bedsRes.data);
      setAdmissions(admRes.data);
    } catch {
      toast.error('Failed to load bed management data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Load billing records from localStorage (demo)
    const stored = localStorage.getItem('billing_records');
    if (stored) setBillingRecords(JSON.parse(stored));
  }, [fetchData]);

  const handleStatusChange = async (bedId: string, newStatus: BedStatus) => {
    try {
      await api.put(`/beds/${bedId}/status`, { status: newStatus });
      toast.success(`Bed status updated to ${newStatus.toUpperCase()}`);
      fetchData();
    } catch {
      toast.error('Failed to update bed status');
    }
  };

  const handleDischarge = async (bedId: string) => {
    setActionLoading(true);
    try {
      await api.post(`/beds/${bedId}/discharge`, {});
      toast.success('✅ Patient discharged! Bed set for cleaning.');
      setConfirmDischargeBedId(null);
      fetchData();
    } catch {
      toast.error('Failed to discharge patient');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateAdmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!admissionForm.patientName || !admissionForm.patientId) {
      toast.error('Patient Name and ID are required');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/beds/admissions', admissionForm);
      toast.success('✅ Admission request submitted to queue');
      setShowAdmissionModal(false);
      setAdmissionForm({ patientId: '', patientName: '', doctorName: '', diagnosis: '', requestedWard: '', notes: '' });
      fetchData();
    } catch {
      toast.error('Failed to submit admission request');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAllocateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAllocateModal || !targetBedId) {
      toast.error('Please select a vacant bed');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/beds/allocate', {
        admissionId: showAllocateModal.id,
        bedId: targetBedId,
      });
      toast.success(`✅ Bed allocated for ${showAllocateModal.patientName}`);
      setShowAllocateModal(null);
      setTargetBedId('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bed allocation failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveBilling = (e: React.FormEvent) => {
    e.preventDefault();
    const total = Number(billingForm.consultationFee) + Number(billingForm.medicineAmount) + Number(billingForm.testAmount) + Number(billingForm.bedCharges);
    const record = {
      id: `BILL-${Date.now()}`,
      ...billingForm,
      totalAmount: total,
      createdAt: new Date().toISOString(),
      status: 'paid',
    };
    const updated = [record, ...billingRecords];
    setBillingRecords(updated);
    localStorage.setItem('billing_records', JSON.stringify(updated));
    toast.success(`💳 Payment of ₹${total.toLocaleString()} recorded successfully!`);
    setShowBillingModal(false);
    setBillingForm({ patientId: '', patientName: '', consultationFee: 500, medicineAmount: 0, testAmount: 0, bedCharges: 0, paymentMethod: 'cash', notes: '' });
  };

  // Filtered beds
  const filteredBeds = beds.filter((b) => {
    const matchesWard = selectedWard === 'all' || b.wardId === selectedWard;
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      b.bedNumber.toLowerCase().includes(q) ||
      b.roomNumber.toLowerCase().includes(q) ||
      (b.currentPatientName && b.currentPatientName.toLowerCase().includes(q));
    return matchesWard && matchesStatus && matchesSearch;
  });

  const totalBeds = beds.length;
  const vacantBeds = beds.filter((b) => b.status === BedStatus.VACANT).length;
  const occupiedBeds = beds.filter((b) => b.status === BedStatus.OCCUPIED).length;
  const cleaningBeds = beds.filter((b) => b.status === BedStatus.CLEANING).length;
  const pendingAdmissions = admissions.filter((a) => a.status === 'pending');
  // Doctor-recommended bed requests (notes contain "Doctor Bed Request")
  const doctorBedRequests = pendingAdmissions.filter((a) => a.notes && a.notes.includes('[Doctor Bed Request]'));

  const getStatusBadge = (status: BedStatus) => {
    switch (status) {
      case BedStatus.VACANT: return <span className="badge badge-success">🟢 VACANT</span>;
      case BedStatus.OCCUPIED: return <span className="badge badge-danger">🔴 OCCUPIED</span>;
      case BedStatus.CLEANING: return <span className="badge badge-warning">🧹 CLEANING</span>;
      case BedStatus.MAINTENANCE: return <span className="badge badge-gray">🛠️ MAINTENANCE</span>;
      default: return null;
    }
  };

  if (loading) {
    return <CenteredLoader message="Loading Bed Management..." subtext="Syncing ward capacity & room status" />;
  }

  const totalBillAmount = billingRecords.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);

  return (
    <DashboardLayout role="receptionist" title="Bed & Billing Management">
      {/* Header */}
      <div className="topbar">
        <div className="topbar-title">🛏️ Bed Management & Billing — Reception Desk</div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => { setActiveTab('billing'); setShowBillingModal(true); }}>
            💳 New Payment
          </button>
          <button className="btn btn-secondary" onClick={() => setShowAdmissionModal(true)}>
            📥 Admit Patient
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { id: 'queue', label: '⚠️ Admission Queue', badge: pendingAdmissions.length },
            { id: 'beds', label: '🛏️ Bed Status Grid' },
            { id: 'billing', label: '💳 Billing & Payments', badge: billingRecords.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 20, padding: '8px 18px', fontSize: 13, position: 'relative' }}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{ marginLeft: 6, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 11 }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Metrics */}
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', marginBottom: 20 }}>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #6366f1, #0ea5e9)' } as any}>
            <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)' }}>🛏️</div>
            <div className="stat-value">{totalBeds}</div>
            <div className="stat-label">Total Beds</div>
          </div>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #10b981, #14b8a6)' } as any}>
            <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>🟢</div>
            <div className="stat-value">{vacantBeds}</div>
            <div className="stat-label">Vacant Beds</div>
          </div>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #ef4444, #f43f5e)' } as any}>
            <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>🔴</div>
            <div className="stat-value">{occupiedBeds}</div>
            <div className="stat-label">Occupied</div>
          </div>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #8b5cf6, #ec4899)' } as any}>
            <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#c084fc' }}>⏳</div>
            <div className="stat-value">{pendingAdmissions.length}</div>
            <div className="stat-label">Pending Admissions</div>
          </div>
          <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #0ea5e9, #10b981)' } as any}>
            <div className="stat-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>💰</div>
            <div className="stat-value">₹{totalBillAmount.toLocaleString()}</div>
            <div className="stat-label">Total Collected</div>
          </div>
        </div>

        {/* ── TAB: Admission Queue ─────────────────────────────── */}
        {activeTab === 'queue' && (
          <>
            {/* Doctor Bed Recommendations */}
            {doctorBedRequests.length > 0 && (
              <div className="card" style={{ border: '1.5px solid #6366f1', background: 'rgba(99,102,241,0.04)', marginBottom: 20 }}>
                <div className="card-header" style={{ background: 'rgba(99,102,241,0.08)' }}>
                  <h3 className="card-title" style={{ color: '#818cf8', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🩺 Doctor Bed Recommendations ({doctorBedRequests.length})
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sent by attending doctors — requires your action</span>
                </div>
                <div className="card-body p-0">
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Patient</th>
                          <th>Patient ID</th>
                          <th>Recommending Doctor</th>
                          <th>Diagnosis</th>
                          <th>Requested Ward</th>
                          <th>Doctor Note</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {doctorBedRequests.map((adm) => (
                          <tr key={adm.id}>
                            <td className="font-semibold">{adm.patientName}</td>
                            <td><code>{adm.patientId}</code></td>
                            <td><span className="badge badge-info">Dr. {adm.doctorName}</span></td>
                            <td>{adm.diagnosis || '—'}</td>
                            <td><span className="badge badge-purple">{adm.requestedWard || 'General'}</span></td>
                            <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{adm.notes?.replace('[Doctor Bed Request]', '').trim() || '—'}</td>
                            <td>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => {
                                  setShowAllocateModal(adm);
                                  const vacant = beds.find((b) => b.status === BedStatus.VACANT);
                                  if (vacant) setTargetBedId(vacant.id);
                                }}
                              >
                                🛏️ Allocate Bed
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* All Pending Admissions */}
            <div className="card">
              <div className="card-header" style={{ background: 'rgba(245,158,11,0.05)' }}>
                <h3 className="card-title" style={{ color: '#fbbf24' }}>⚠️ Pending Admission Queue ({pendingAdmissions.length})</h3>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAdmissionModal(true)}>+ Manual Admission</button>
              </div>
              <div className="card-body p-0">
                {pendingAdmissions.length === 0 ? (
                  <div className="empty-state"><div className="empty-icon">✅</div><h3>No pending admissions</h3><p>Queue is clear</p></div>
                ) : (
                  <div className="table-container">
                    <table>
                      <thead>
                        <tr>
                          <th>Patient Name</th>
                          <th>Patient ID</th>
                          <th>Doctor</th>
                          <th>Diagnosis</th>
                          <th>Requested Ward</th>
                          <th>Source</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingAdmissions.map((adm) => (
                          <tr key={adm.id}>
                            <td className="font-semibold">{adm.patientName}</td>
                            <td><code>{adm.patientId}</code></td>
                            <td>{adm.doctorName || '—'}</td>
                            <td>{adm.diagnosis || '—'}</td>
                            <td><span className="badge badge-info">{adm.requestedWard || 'General'}</span></td>
                            <td>
                              {adm.notes?.includes('[Doctor Bed Request]')
                                ? <span className="badge badge-purple">🩺 Doctor</span>
                                : <span className="badge badge-gray">Manual</span>}
                            </td>
                            <td>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => {
                                  setShowAllocateModal(adm);
                                  const vacant = beds.find((b) => b.status === BedStatus.VACANT);
                                  if (vacant) setTargetBedId(vacant.id);
                                }}
                              >
                                🛏️ Allocate Bed
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── TAB: Bed Status Grid ──────────────────────────────── */}
        {activeTab === 'beds' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">🛏️ Hospital Bed Grid ({filteredBeds.length})</h3>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="🔍 Search bed / patient..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 180 }}
                />
                <select className="form-control form-control-sm" style={{ width: 150 }} value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
                  <option value="all">All Wards</option>
                  {wards.map((w) => (<option key={w.id} value={w.id}>{w.name}</option>))}
                </select>
                <select className="form-control form-control-sm" style={{ width: 140 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">All Statuses</option>
                  <option value={BedStatus.VACANT}>Vacant ({vacantBeds})</option>
                  <option value={BedStatus.OCCUPIED}>Occupied ({occupiedBeds})</option>
                  <option value={BedStatus.CLEANING}>Cleaning ({cleaningBeds})</option>
                  <option value={BedStatus.MAINTENANCE}>Maintenance</option>
                </select>
              </div>
            </div>
            <div className="card-body">
              {filteredBeds.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🛏️</div><h3>No beds match filter</h3></div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
                  {filteredBeds.map((bed) => {
                    const isOccupied = bed.status === BedStatus.OCCUPIED;
                    const isVacant = bed.status === BedStatus.VACANT;
                    const isCleaning = bed.status === BedStatus.CLEANING;
                    return (
                      <div
                        key={bed.id}
                        style={{
                          padding: 16,
                          borderRadius: 14,
                          background: isOccupied ? 'rgba(239,68,68,0.06)' : isVacant ? 'rgba(16,185,129,0.06)' : isCleaning ? 'rgba(245,158,11,0.06)' : 'var(--bg-surface)',
                          border: `1.5px solid ${isOccupied ? '#ef4444' : isVacant ? '#10b981' : isCleaning ? '#f59e0b' : 'var(--border)'}`,
                          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 800 }}>{bed.bedNumber}</span>
                            {getStatusBadge(bed.status)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                            🏢 {bed.ward?.name || 'General Ward'} • {bed.roomNumber}
                          </div>
                          {isOccupied ? (
                            <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ADMITTED PATIENT</div>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{bed.currentPatientName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: <code>{bed.currentPatientId}</code></div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>
                              {isVacant ? 'Ready for patient assignment' : isCleaning ? 'Cleaning in progress' : 'Under maintenance'}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                          {isOccupied && (
                            <button className="btn btn-danger btn-sm w-full" onClick={() => setConfirmDischargeBedId(bed.id)}>
                              🚪 Discharge
                            </button>
                          )}
                          {isCleaning && (
                            <button className="btn btn-success btn-sm w-full" onClick={() => handleStatusChange(bed.id, BedStatus.VACANT)}>
                              ✓ Mark Cleaned
                            </button>
                          )}
                          {isVacant && (
                            <button className="btn btn-secondary btn-sm w-full" onClick={() => handleStatusChange(bed.id, BedStatus.CLEANING)}>
                              🧹 Mark for Cleaning
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: Billing & Payments ───────────────────────────── */}
        {activeTab === 'billing' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">💳 Patient Billing & Payment Records</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowBillingModal(true)}>+ New Payment</button>
            </div>
            <div className="card-body p-0">
              {billingRecords.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💳</div>
                  <h3>No billing records yet</h3>
                  <p>Click "New Payment" to record a patient payment</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Bill ID</th>
                        <th>Patient</th>
                        <th>Consultation</th>
                        <th>Medicines</th>
                        <th>Tests</th>
                        <th>Bed Charges</th>
                        <th>Total</th>
                        <th>Payment</th>
                        <th>Date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingRecords.map((b) => (
                        <tr key={b.id}>
                          <td><code style={{ fontSize: 11 }}>{b.id}</code></td>
                          <td><strong>{b.patientName}</strong><br /><span className="text-muted text-xs">{b.patientId}</span></td>
                          <td>₹{Number(b.consultationFee).toLocaleString()}</td>
                          <td>₹{Number(b.medicineAmount).toLocaleString()}</td>
                          <td>₹{Number(b.testAmount).toLocaleString()}</td>
                          <td>₹{Number(b.bedCharges).toLocaleString()}</td>
                          <td><strong style={{ color: '#10b981' }}>₹{Number(b.totalAmount).toLocaleString()}</strong></td>
                          <td><span className="badge badge-info">{b.paymentMethod}</span></td>
                          <td style={{ fontSize: 11 }}>{new Date(b.createdAt).toLocaleDateString()}</td>
                          <td><span className="badge badge-success">{b.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'right', fontWeight: 700, padding: '12px 16px' }}>Total Collected:</td>
                        <td colSpan={4} style={{ fontWeight: 800, color: '#10b981', fontSize: 16, padding: '12px 16px' }}>₹{totalBillAmount.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: Admit Patient ──────────────────── */}
      {showAdmissionModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3>📥 Request Patient Admission</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowAdmissionModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAdmission}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label className="form-label">Patient Name *</label>
                  <input type="text" className="form-control" placeholder="e.g. Amanda Clark" value={admissionForm.patientName} onChange={(e) => setAdmissionForm({ ...admissionForm, patientName: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Patient ID (MRN) *</label>
                  <input type="text" className="form-control" placeholder="e.g. NMH26000000" value={admissionForm.patientId} onChange={(e) => setAdmissionForm({ ...admissionForm, patientId: e.target.value })} required />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Attending Doctor</label>
                    <input type="text" className="form-control" placeholder="Dr. Name" value={admissionForm.doctorName} onChange={(e) => setAdmissionForm({ ...admissionForm, doctorName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Requested Ward</label>
                    <select className="form-control" value={admissionForm.requestedWard} onChange={(e) => setAdmissionForm({ ...admissionForm, requestedWard: e.target.value })}>
                      <option value="">-- Select Ward --</option>
                      {wards.map((w) => (<option key={w.id} value={w.name}>{w.name}</option>))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ready / Available Bed Number (Optional)</label>
                  <select
                    className="form-control"
                    value={targetBedId}
                    onChange={(e) => {
                      setTargetBedId(e.target.value);
                      const selectedBed = beds.find(b => b.id === e.target.value);
                      if (selectedBed) {
                        setAdmissionForm(prev => ({
                          ...prev,
                          requestedWard: selectedBed.ward?.name || prev.requestedWard,
                          notes: prev.notes ? `${prev.notes} [Preferred Bed: ${selectedBed.bedNumber}]` : `[Preferred Bed: ${selectedBed.bedNumber}]`
                        }));
                      }
                    }}
                  >
                    <option value="">-- Select Ready Bed (Vacant) --</option>
                    {beds.filter((b) => b.status === BedStatus.VACANT).map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bedNumber} ({b.ward?.name || 'Ward'} - {b.roomNumber}) — READY
                      </option>
                    ))}
                  </select>
                  <span style={{ fontSize: 11, color: '#10b981', marginTop: 4, display: 'block' }}>
                    🟢 Reflecting {beds.filter((b) => b.status === BedStatus.VACANT).length} real-time ready beds available for direct allocation.
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Diagnosis</label>
                  <input type="text" className="form-control" placeholder="e.g. Cardiac Arrhythmia" value={admissionForm.diagnosis} onChange={(e) => setAdmissionForm({ ...admissionForm, diagnosis: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdmissionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>{actionLoading ? 'Submitting...' : 'Submit Request'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Allocate Bed ───────────────────── */}
      {showAllocateModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>🛏️ Allocate Bed — {showAllocateModal.patientName}</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowAllocateModal(null)}>✕</button>
            </div>
            <form onSubmit={handleAllocateBed}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label className="form-label">Patient Details</label>
                  <div style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, fontSize: 13 }}>
                    <div><strong>{showAllocateModal.patientName}</strong> ({showAllocateModal.patientId})</div>
                    <div>Diagnosis: {showAllocateModal.diagnosis || 'N/A'}</div>
                    <div>Requested Ward: {showAllocateModal.requestedWard || 'General'}</div>
                    {showAllocateModal.doctorName && (
                      <div style={{ marginTop: 4, color: 'var(--primary-light)', fontWeight: 600 }}>Recommended by: Dr. {showAllocateModal.doctorName}</div>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Select Vacant Bed *</label>
                  <select className="form-control" value={targetBedId} onChange={(e) => setTargetBedId(e.target.value)} required>
                    <option value="">-- Choose Vacant Bed --</option>
                    {beds.filter((b) => b.status === BedStatus.VACANT).map((b) => (
                      <option key={b.id} value={b.id}>{b.bedNumber} ({b.ward?.name} — {b.roomNumber})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAllocateModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={actionLoading}>{actionLoading ? 'Allocating...' : '✓ Confirm Bed Allocation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Billing / Payment Entry ───────── */}
      {showBillingModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h3>💳 Record Patient Payment</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowBillingModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveBilling}>
              <div className="modal-body">
                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Patient Name *</label>
                    <input className="form-control" placeholder="John Doe" value={billingForm.patientName} onChange={(e) => setBillingForm({ ...billingForm, patientName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient ID</label>
                    <input className="form-control" placeholder="NMH26000000" value={billingForm.patientId} onChange={(e) => setBillingForm({ ...billingForm, patientId: e.target.value })} />
                  </div>
                </div>

                <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: 16, border: '1px solid var(--border)', marginBottom: 14 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--primary-light)' }}>💰 Bill Breakdown</h4>
                  <div className="form-grid form-grid-2">
                    <div className="form-group">
                      <label className="form-label">Consultation Fee (₹)</label>
                      <input type="number" className="form-control" value={billingForm.consultationFee} onChange={(e) => setBillingForm({ ...billingForm, consultationFee: Number(e.target.value) })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Medicine Charges (₹)</label>
                      <input type="number" className="form-control" value={billingForm.medicineAmount} onChange={(e) => setBillingForm({ ...billingForm, medicineAmount: Number(e.target.value) })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Test / Lab Charges (₹)</label>
                      <input type="number" className="form-control" value={billingForm.testAmount} onChange={(e) => setBillingForm({ ...billingForm, testAmount: Number(e.target.value) })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bed / Room Charges (₹)</label>
                      <input type="number" className="form-control" value={billingForm.bedCharges} onChange={(e) => setBillingForm({ ...billingForm, bedCharges: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700 }}>Total Amount:</span>
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#10b981' }}>
                      ₹{(Number(billingForm.consultationFee) + Number(billingForm.medicineAmount) + Number(billingForm.testAmount) + Number(billingForm.bedCharges)).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Payment Method</label>
                    <select className="form-control" value={billingForm.paymentMethod} onChange={(e) => setBillingForm({ ...billingForm, paymentMethod: e.target.value })}>
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI / QR</option>
                      <option value="insurance">Insurance</option>
                      <option value="netbanking">Net Banking</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="form-control" placeholder="Any remarks..." value={billingForm.notes} onChange={(e) => setBillingForm({ ...billingForm, notes: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBillingModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">💳 Confirm & Record Payment</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: Discharge Confirmation ────────── */}
      {confirmDischargeBedId && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🚪 Confirm Patient Discharge</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setConfirmDischargeBedId(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 8 }}>Are you sure you want to discharge this patient?</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>The bed will be moved to <strong>Cleaning</strong> status after discharge.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDischargeBedId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDischarge(confirmDischargeBedId)} disabled={actionLoading}>
                {actionLoading ? 'Discharging...' : '✓ Confirm Discharge'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
