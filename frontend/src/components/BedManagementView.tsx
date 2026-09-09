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
}

export default function BedManagementView({
  role = 'admin',
}: {
  role?: string;
}) {
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Modals & Forms
  const [showAddBedModal, setShowAddBedModal] = useState(false);
  const [showAddWardModal, setShowAddWardModal] = useState(false);
  const [showAllocateModal, setShowAllocateModal] = useState<Admission | null>(null);
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Discharge confirmation state
  const [confirmDischargeBedId, setConfirmDischargeBedId] = useState<string | null>(null);

  // New Bed Form
  const [bedForm, setBedForm] = useState({
    bedNumber: '',
    roomNumber: '',
    wardId: '',
  });

  // New Ward Form
  const [wardForm, setWardForm] = useState({
    name: '',
    floor: '',
    description: '',
  });

  // New Admission Request Form
  const [admissionForm, setAdmissionForm] = useState({
    patientId: '',
    patientName: '',
    doctorName: '',
    diagnosis: '',
    requestedWard: '',
    notes: '',
  });

  // Selected Bed for Allocation
  const [targetBedId, setTargetBedId] = useState('');

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
    } catch (err) {
      toast.error('Failed to load hospital bed allocation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handlers
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
    try {
      await api.post(`/beds/${bedId}/discharge`, {});
      toast.success('Patient discharged! Bed is now set for cleaning.');
      setConfirmDischargeBedId(null);
      fetchData();
    } catch {
      toast.error('Failed to discharge patient');
    }
  };

  const handleCreateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedForm.bedNumber || !bedForm.roomNumber || !bedForm.wardId) {
      toast.error('Please fill in all bed details');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/beds', bedForm);
      toast.success(`Bed ${bedForm.bedNumber} added successfully`);
      setShowAddBedModal(false);
      setBedForm({ bedNumber: '', roomNumber: '', wardId: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create bed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateWard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wardForm.name || !wardForm.floor) {
      toast.error('Ward name and floor are required');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/beds/wards', wardForm);
      toast.success(`Ward "${wardForm.name}" created!`);
      setShowAddWardModal(false);
      setWardForm({ name: '', floor: '', description: '' });
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create ward');
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
      toast.success('Admission request submitted to queue');
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
      toast.error('Please select a vacant bed for allocation');
      return;
    }
    setActionLoading(true);
    try {
      await api.post('/beds/allocate', {
        admissionId: showAllocateModal.id,
        bedId: targetBedId,
      });
      toast.success(`Bed allocated for patient ${showAllocateModal.patientName}`);
      setShowAllocateModal(null);
      setTargetBedId('');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Bed allocation failed');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered beds logic
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

  // Metrics
  const totalBeds = beds.length;
  const vacantBeds = beds.filter((b) => b.status === BedStatus.VACANT).length;
  const occupiedBeds = beds.filter((b) => b.status === BedStatus.OCCUPIED).length;
  const cleaningBeds = beds.filter((b) => b.status === BedStatus.CLEANING).length;
  const pendingAdmissions = admissions.filter((a) => a.status === 'pending');

  const getStatusBadge = (status: BedStatus) => {
    switch (status) {
      case BedStatus.VACANT:
        return <span className="badge badge-success">🟢 VACANT</span>;
      case BedStatus.OCCUPIED:
        return <span className="badge badge-danger">🔴 OCCUPIED</span>;
      case BedStatus.CLEANING:
        return <span className="badge badge-warning">🧹 CLEANING</span>;
      case BedStatus.MAINTENANCE:
        return <span className="badge badge-gray">🛠️ MAINTENANCE</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return <CenteredLoader message="Loading Hospital Bed Grid..." subtext="Syncing real-time ward capacity & room status" />;
  }

  return (
    <DashboardLayout role={role} title="Hospital Bed & Ward Management">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>🏥 Hospital Bed & Ward Management System</h2>
          <p>Real-time occupancy tracking, bed allocations, room status, and admission queue management.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowAdmissionModal(true)}>
            📥 New Admission Request
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddBedModal(true)}>
            🛏️ Add Bed
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddWardModal(true)}>
            🏢 Add Ward
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #6366f1, #0ea5e9)' } as any}>
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)' }}>🛏️</div>
          <div className="stat-value">{totalBeds}</div>
          <div className="stat-label">Total Hospital Beds</div>
          <div className="stat-change" style={{ color: 'var(--text-muted)' }}>Across {wards.length} Wards</div>
        </div>

        <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #10b981, #14b8a6)' } as any}>
          <div className="stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>🟢</div>
          <div className="stat-value">{vacantBeds}</div>
          <div className="stat-label">Vacant Beds Available</div>
          <div className="stat-change up">Ready for Allocation</div>
        </div>

        <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #ef4444, #f43f5e)' } as any}>
          <div className="stat-icon" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>🔴</div>
          <div className="stat-value">{occupiedBeds}</div>
          <div className="stat-label">Occupied Beds</div>
          <div className="stat-change" style={{ color: '#f87171' }}>
            {totalBeds > 0 ? `${Math.round((occupiedBeds / totalBeds) * 100)}% Occupancy Rate` : '0%'}
          </div>
        </div>

        <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #f59e0b, #fbbf24)' } as any}>
          <div className="stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24' }}>🧹</div>
          <div className="stat-value">{cleaningBeds}</div>
          <div className="stat-label">Beds in Cleaning/Sanitizing</div>
          <div className="stat-change" style={{ color: '#fbbf24' }}>Sanitation in progress</div>
        </div>

        <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #8b5cf6, #ec4899)' } as any}>
          <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#c084fc' }}>⏳</div>
          <div className="stat-value">{pendingAdmissions.length}</div>
          <div className="stat-label">Pending Admissions</div>
          <div className="stat-change" style={{ color: pendingAdmissions.length > 0 ? '#f87171' : '#34d399' }}>
            {pendingAdmissions.length > 0 ? 'Awaiting Allocation' : 'Queue Empty'}
          </div>
        </div>
      </div>

      {/* Pending Admission Allocation Queue */}
      {pendingAdmissions.length > 0 && (
        <div className="card mb-4" style={{ border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.03)' }}>
          <div className="card-header" style={{ background: 'rgba(245,158,11,0.08)' }}>
            <h3 className="card-title" style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 8 }}>
              ⚠️ Pending Admission Requests Queue ({pendingAdmissions.length})
            </h3>
          </div>
          <div className="card-body p-0">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Patient ID</th>
                    <th>Doctor</th>
                    <th>Diagnosis</th>
                    <th>Requested Ward</th>
                    <th>Actions</th>
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
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => {
                            setShowAllocateModal(adm);
                            const vacant = beds.find((b) => b.status === BedStatus.VACANT);
                            if (vacant) setTargetBedId(vacant.id);
                          }}
                        >
                          🛏️ Allocate Vacant Bed
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

      {/* Search & Filter Bar */}
      <div className="action-bar mb-4">
        <div className="search-bar" style={{ flex: 1, maxWidth: 380 }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search bed, room number or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 170 }} value={selectedWard} onChange={(e) => setSelectedWard(e.target.value)}>
            <option value="all">All Wards ({wards.length})</option>
            {wards.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>

          <select className="form-control" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Statuses</option>
            <option value={BedStatus.VACANT}>Vacant ({vacantBeds})</option>
            <option value={BedStatus.OCCUPIED}>Occupied ({occupiedBeds})</option>
            <option value={BedStatus.CLEANING}>Cleaning ({cleaningBeds})</option>
            <option value={BedStatus.MAINTENANCE}>Maintenance</option>
          </select>
        </div>
      </div>

      {/* Hospital Bed Grid Visualizer */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">🛏️ Hospital Bed Status Grid ({filteredBeds.length})</h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Real-time visual floor grid</span>
        </div>
        <div className="card-body">
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
                    background: isOccupied
                      ? 'rgba(239,68,68,0.06)'
                      : isVacant
                        ? 'rgba(16,185,129,0.06)'
                        : isCleaning
                          ? 'rgba(245,158,11,0.06)'
                          : 'var(--bg-surface)',
                    border: `1.5px solid ${isOccupied
                        ? '#ef4444'
                        : isVacant
                          ? '#10b981'
                          : isCleaning
                            ? '#f59e0b'
                            : 'var(--border)'
                      }`,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
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
                        {isVacant ? 'Ready for patient assignment' : isCleaning ? 'Cleaning staff notified' : 'Under maintenance'}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    {isOccupied && (
                      <button className="btn btn-danger btn-sm w-full" onClick={() => setConfirmDischargeBedId(bed.id)}>
                        🚪 Discharge Patient
                      </button>
                    )}
                    {isCleaning && (
                      <button className="btn btn-success btn-sm w-full" onClick={() => handleStatusChange(bed.id, BedStatus.VACANT)}>
                        ✓ Mark Cleaned & Vacant
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
        </div>
      </div>

      {/* Modal: New Admission Request */}
      {showAdmissionModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>📥 Request Patient Admission</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowAdmissionModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateAdmission}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label className="form-label">Patient Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Amanda Clark"
                    value={admissionForm.patientName}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, patientName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Patient ID (MRN) *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. PAT-2024-0102"
                    value={admissionForm.patientId}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, patientId: e.target.value })}
                    required
                  />
                </div>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Attending Doctor</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Dr. Name"
                      value={admissionForm.doctorName}
                      onChange={(e) => setAdmissionForm({ ...admissionForm, doctorName: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Requested Ward</label>
                    <select
                      className="form-control"
                      value={admissionForm.requestedWard}
                      onChange={(e) => setAdmissionForm({ ...admissionForm, requestedWard: e.target.value })}
                    >
                      <option value="">-- Select Ward --</option>
                      {wards.map((w) => (
                        <option key={w.id} value={w.name}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Ready Bed Number (Optional)</label>
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
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Cardiac Arrythmia"
                    value={admissionForm.diagnosis}
                    onChange={(e) => setAdmissionForm({ ...admissionForm, diagnosis: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAdmissionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bed Allocation */}
      {showAllocateModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>🛏️ Allocate Bed for {showAllocateModal.patientName}</h3>
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
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Select Vacant Bed</label>
                  <select
                    className="form-control"
                    value={targetBedId}
                    onChange={(e) => setTargetBedId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Vacant Bed --</option>
                    {beds
                      .filter((b) => b.status === BedStatus.VACANT)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bedNumber} ({b.ward?.name} — {b.roomNumber})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAllocateModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-success" disabled={actionLoading}>
                  {actionLoading ? 'Allocating...' : '✓ Confirm Bed Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Bed */}
      {showAddBedModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🛏️ Add New Bed</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowAddBedModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateBed}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label className="form-label">Bed Number / Code *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. BED-ICU-105"
                    value={bedForm.bedNumber}
                    onChange={(e) => setBedForm({ ...bedForm, bedNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Room Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Room 102"
                    value={bedForm.roomNumber}
                    onChange={(e) => setBedForm({ ...bedForm, roomNumber: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign Ward *</label>
                  <select
                    className="form-control"
                    value={bedForm.wardId}
                    onChange={(e) => setBedForm({ ...bedForm, wardId: e.target.value })}
                    required
                  >
                    <option value="">-- Select Ward --</option>
                    {wards.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddBedModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Add Bed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add New Ward */}
      {showAddWardModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🏢 Add New Hospital Ward</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowAddWardModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateWard}>
              <div className="modal-body form-grid">
                <div className="form-group">
                  <label className="form-label">Ward Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Pediatric Care Unit"
                    value={wardForm.name}
                    onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Floor / Building Location *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 3rd Floor Wing B"
                    value={wardForm.floor}
                    onChange={(e) => setWardForm({ ...wardForm, floor: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Ward purpose and capacity notes"
                    value={wardForm.description}
                    onChange={(e) => setWardForm({ ...wardForm, description: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddWardModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Create Ward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Discharge Confirmation Modal */}
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
