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
  bedType?: string; // 'ICU', 'General Ward', 'VIP', 'Normal'
  subType?: string; // 'General Ward A', 'General Ward B', etc.
  treatmentFeatures?: string;
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
  const [selectedBedTypeFilter, setSelectedBedTypeFilter] = useState<string>('all');
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

  // New Bed Form State
  const [bedForm, setBedForm] = useState({
    bedType: 'ICU', // 'ICU' | 'General Ward' | 'VIP' | 'Normal'
    generalWardType: 'General Ward A', // 'General Ward A' | 'General Ward B'
    vipType: 'Executive Suite', // 'Executive Suite' | 'VIP Deluxe'
    normalType: 'Standard Single', // 'Standard Single' | 'Standard Twin Sharing'
    roomNumber: 'Room 101',
    bedNumber: 'BED-ICU-101',
    wardId: '',
    treatmentFeatures: 'Oxygen Line, Cardiac Monitor',
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
      setWards(wardsRes.data || []);
      setBeds(bedsRes.data || []);
      setAdmissions(admRes.data || []);
      
      if ((wardsRes.data || []).length > 0 && !bedForm.wardId) {
        setBedForm(prev => ({ ...prev, wardId: wardsRes.data[0].id }));
      }
    } catch {
      toast.error('Failed to load hospital bed allocation data');
    } finally {
      setLoading(false);
    }
  }, [bedForm.wardId]);

  useEffect(() => {
    fetchData();
    const handleEvent = () => fetchData();
    window.addEventListener('hospital-data-refresh', handleEvent);
    window.addEventListener('focus', handleEvent);
    return () => {
      window.removeEventListener('hospital-data-refresh', handleEvent);
      window.removeEventListener('focus', handleEvent);
    };
  }, [fetchData]);

  // Auto-generate suggested bed number code when Bed Type, Sub-type, or Room Number changes
  const updateBedCodeSuggestion = (type: string, genWard: string, room: string) => {
    const roomClean = room.replace(/[^0-9]/g, '') || '101';
    let prefix = 'BED-ICU';
    if (type === 'General Ward') {
      prefix = genWard === 'General Ward B' ? 'BED-GWB' : 'BED-GWA';
    } else if (type === 'VIP') {
      prefix = 'BED-VIP';
    } else if (type === 'Normal') {
      prefix = 'BED-NRM';
    }
    return `${prefix}-${roomClean}`;
  };

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

  const handleDeleteBed = async (id: string, bedNumber: string) => {
    if (!confirm(`Are you sure you want to delete bed ${bedNumber}?`)) return;
    try {
      await api.delete(`/beds/${id}`);
      toast.success(`Bed ${bedNumber} deleted`);
      fetchData();
    } catch {
      toast.error('Failed to delete bed');
    }
  };

  const handlePurgeAllBeds = async () => {
    if (!confirm('Are you sure you want to clear all existing beds? This will clear all default beds so you can add fresh beds using the + Add Bed button.')) return;
    try {
      await api.delete('/beds/purge-all');
      toast.success('All default beds cleared! Click + Add Bed to create your beds.');
      fetchData();
    } catch {
      toast.error('Failed to clear beds');
    }
  };

  const handleCreateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedForm.bedNumber || !bedForm.roomNumber) {
      toast.error('Please enter room number and bed code');
      return;
    }

    setActionLoading(true);

    // Resolve subType label
    let subType = bedForm.bedType;
    if (bedForm.bedType === 'General Ward') {
      subType = bedForm.generalWardType;
    } else if (bedForm.bedType === 'VIP') {
      subType = bedForm.vipType;
    } else if (bedForm.bedType === 'Normal') {
      subType = bedForm.normalType;
    }

    // Auto-match ward if wardId is not selected
    let targetWardId = bedForm.wardId;
    if (!targetWardId && wards.length > 0) {
      const matched = wards.find(w => w.name.toLowerCase().includes(bedForm.bedType.toLowerCase())) || wards[0];
      targetWardId = matched.id;
    }

    try {
      await api.post('/beds', {
        bedNumber: bedForm.bedNumber,
        roomNumber: bedForm.roomNumber,
        bedType: bedForm.bedType,
        subType: subType,
        treatmentFeatures: bedForm.treatmentFeatures,
        wardId: targetWardId,
        status: BedStatus.VACANT,
      });

      toast.success(`✅ Bed ${bedForm.bedNumber} (${subType} - ${bedForm.roomNumber}) created successfully!`);
      setShowAddBedModal(false);
      
      // Reset form
      setBedForm({
        bedType: 'ICU',
        generalWardType: 'General Ward A',
        vipType: 'Executive Suite',
        normalType: 'Standard Single',
        roomNumber: 'Room 102',
        bedNumber: 'BED-ICU-102',
        wardId: wards.length > 0 ? wards[0].id : '',
        treatmentFeatures: 'Oxygen Line, Cardiac Monitor',
      });
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
    const matchesType =
      selectedBedTypeFilter === 'all' ||
      b.bedType?.toLowerCase() === selectedBedTypeFilter.toLowerCase() ||
      b.subType?.toLowerCase().includes(selectedBedTypeFilter.toLowerCase());

    const q = search.toLowerCase();
    const matchesSearch =
      b.bedNumber.toLowerCase().includes(q) ||
      b.roomNumber.toLowerCase().includes(q) ||
      (b.bedType && b.bedType.toLowerCase().includes(q)) ||
      (b.subType && b.subType.toLowerCase().includes(q)) ||
      (b.currentPatientName && b.currentPatientName.toLowerCase().includes(q));

    return matchesWard && matchesStatus && matchesType && matchesSearch;
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

  const renderBedTypeBadge = (b: Bed) => {
    const typeStr = b.subType || b.bedType || 'Normal';
    if (typeStr.includes('ICU')) {
      return <span className="badge badge-purple" style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', color: '#fff' }}>⚡ ICU</span>;
    }
    if (typeStr.includes('General Ward A')) {
      return <span className="badge badge-info" style={{ background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#fff' }}>🏢 General Ward A</span>;
    }
    if (typeStr.includes('General Ward B')) {
      return <span className="badge badge-info" style={{ background: 'linear-gradient(135deg, #0284c7, #0ea5e9)', color: '#fff' }}>🏢 General Ward B</span>;
    }
    if (typeStr.includes('VIP')) {
      return <span className="badge badge-warning" style={{ background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', color: '#000', fontWeight: 800 }}>👑 {typeStr}</span>;
    }
    return <span className="badge badge-secondary" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid #10b981' }}>🛌 {typeStr}</span>;
  };

  if (loading) {
    return <CenteredLoader message="Loading Hospital Bed Grid..." subtext="Syncing real-time ward capacity & room status" />;
  }

  return (
    <DashboardLayout role={role} title="Hospital Bed & Ward Management">
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2>🏥 Hospital Bed & Ward Management Portal</h2>
          <p>Real-time room occupancy grid, bed types (ICU, General Ward A/B, VIP, Normal), and patient bed allocations.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Main + Icon Button to Add Bed */}
          <button
            className="btn btn-primary"
            onClick={() => setShowAddBedModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', fontWeight: 700, borderRadius: 10 }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>➕</span> Add Bed
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAdmissionModal(true)}>
            📥 Request Admission
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowAddWardModal(true)}>
            🏢 Add Ward
          </button>
          {beds.length > 0 && (
            <button className="btn btn-danger btn-sm" style={{ opacity: 0.8 }} onClick={handlePurgeAllBeds} title="Clear default beds">
              🗑️ Clear Default Beds
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #6366f1, #0ea5e9)' } as any}>
          <div className="stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: 'var(--primary-light)' }}>🛏️</div>
          <div className="stat-value">{totalBeds}</div>
          <div className="stat-label">Total Hospital Beds</div>
          <div className="stat-change" style={{ color: 'var(--text-muted)' }}>Created in Management</div>
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
          <div className="stat-label">Sanitizing / Cleaning</div>
          <div className="stat-change" style={{ color: '#fbbf24' }}>Sanitation in progress</div>
        </div>

        <div className="stat-card" style={{ '--gradient': 'linear-gradient(135deg, #8b5cf6, #ec4899)' } as any}>
          <div className="stat-icon" style={{ background: 'rgba(139,92,246,0.15)', color: '#c084fc' }}>⏳</div>
          <div className="stat-value">{pendingAdmissions.length}</div>
          <div className="stat-label">Pending Doctor Requests</div>
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
              ⚠️ Doctor Bed Allocation Requests Queue ({pendingAdmissions.length})
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
                    <th>Requested Ward / Type</th>
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
      <div className="action-bar mb-4" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="search-bar" style={{ flex: 1, minWidth: 260 }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search room number, bed code, or patient name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 170 }} value={selectedBedTypeFilter} onChange={(e) => setSelectedBedTypeFilter(e.target.value)}>
            <option value="all">All Bed Types</option>
            <option value="icu">⚡ ICU</option>
            <option value="general ward a">🏢 General Ward A</option>
            <option value="general ward b">🏢 General Ward B</option>
            <option value="vip">👑 VIP</option>
            <option value="normal">🛌 Normal</option>
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

      {/* Hospital Bed Grid Visualizer (Cards) */}
      <div className="card mb-4">
        <div className="card-header flex justify-between items-center">
          <div>
            <h3 className="card-title">🛏️ Management Bed Grid ({filteredBeds.length})</h3>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Displays room number, bed type, status & allocation</span>
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddBedModal(true)}>
            ➕ Add Bed Card
          </button>
        </div>
        <div className="card-body">
          {filteredBeds.length === 0 ? (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <div className="empty-icon" style={{ fontSize: 42, marginBottom: 12 }}>🛏️</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No beds created yet</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Click the <strong>➕ Add Bed</strong> button to create beds with ICU, General Ward A/B, VIP, or Normal bed types and room numbers.
              </p>
              <button className="btn btn-primary" onClick={() => setShowAddBedModal(true)}>
                ➕ Create First Bed Card
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
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
                        ? 'rgba(239,68,68,0.05)'
                        : isVacant
                          ? 'rgba(16,185,129,0.05)'
                          : isCleaning
                            ? 'rgba(245,158,11,0.05)'
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
                      boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
                      transition: 'transform 0.15s ease',
                    }}
                  >
                    <div>
                      {/* Bed Card Header: General Ward shows Bed Number, VIP/Normal/ICU shows Room Number */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--primary-light)' }}>
                          {bed.bedType === 'General Ward' || bed.subType?.includes('General Ward')
                            ? `🛏️ Bed: ${bed.bedNumber}`
                            : `🚪 Room: ${bed.roomNumber}`}
                        </span>
                        <button
                          onClick={() => handleDeleteBed(bed.id, bed.bedNumber)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: 13 }}
                          title="Delete Bed"
                        >
                          🗑️
                        </button>
                      </div>

                      {/* Room Number & Bed Type */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          🚪 Room: <span style={{ color: '#0ea5e9' }}>{bed.roomNumber}</span>
                        </div>
                        <div>
                          {renderBedTypeBadge(bed)}
                        </div>
                      </div>

                      {/* Treatment features */}
                      {bed.treatmentFeatures && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10, background: 'var(--bg-surface)', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                          ✨ {bed.treatmentFeatures}
                        </div>
                      )}

                      {/* Occupied Patient Info */}
                      {isOccupied ? (
                        <div style={{ background: 'var(--bg-surface)', padding: 10, borderRadius: 8, border: '1px solid var(--border)', marginBottom: 12 }}>
                          <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 800 }}>ADMITTED PATIENT</div>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{bed.currentPatientName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>ID: <code>{bed.currentPatientId}</code></div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0', minHeight: 44 }}>
                          {isVacant ? '🟢 Ready for allocation to Doctor request' : isCleaning ? '🧹 Cleaning & sanitization in progress' : '🛠️ Under Maintenance'}
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
          )}
        </div>
      </div>

      {/* Modal: Add New Bed (Triggered by + Icon Button) */}
      {showAddBedModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                ➕ Add New Bed Card
              </h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowAddBedModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateBed}>
              <div className="modal-body form-grid">
                {/* Bed Type Selection */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>1. Select Bed Type *</label>
                  <select
                    className="form-control"
                    value={bedForm.bedType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      setBedForm(prev => ({
                        ...prev,
                        bedType: newType,
                      }));
                    }}
                    required
                  >
                    <option value="ICU">⚡ ICU (Intensive Care Unit)</option>
                    <option value="General Ward">🏢 General Ward</option>
                  </select>
                </div>

                {/* Conditional Sub-type when General Ward is selected */}
                {bedForm.bedType === 'General Ward' && (
                  <div className="form-group" style={{ background: 'rgba(14,165,233,0.08)', padding: 12, borderRadius: 8, border: '1px solid rgba(14,165,233,0.3)' }}>
                    <label className="form-label" style={{ fontWeight: 700, color: '#0ea5e9' }}>
                      General Ward Selection *
                    </label>
                    <select
                      className="form-control"
                      value={bedForm.generalWardType}
                      onChange={(e) => {
                        const newGenWard = e.target.value;
                        setBedForm(prev => ({
                          ...prev,
                          generalWardType: newGenWard,
                        }));
                      }}
                      required
                    >
                      <option value="General Ward A">🏢 General Ward A</option>
                      <option value="General Ward B">🏢 General Ward B</option>
                    </select>
                  </div>
                )}

                {/* Room Number Input */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>2. Room Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 101, 102, 204"
                    value={bedForm.roomNumber}
                    onChange={(e) => setBedForm({ ...bedForm, roomNumber: e.target.value })}
                    required
                  />
                </div>

                {/* Bed Number Input (Just numbers / simple identifier) */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>3. Bed Number *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 101, 102, Bed 1, Bed 2"
                    value={bedForm.bedNumber}
                    onChange={(e) => setBedForm({ ...bedForm, bedNumber: e.target.value })}
                    required
                  />
                </div>

                {/* Features & Treatment Options */}
                <div className="form-group">
                  <label className="form-label">Treatment Features & Equipment (Optional)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Oxygen Line, Cardiac Monitor"
                    value={bedForm.treatmentFeatures}
                    onChange={(e) => setBedForm({ ...bedForm, treatmentFeatures: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer" style={{ marginTop: 12 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddBedModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Creating Bed...' : '✓ Create Bed Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    placeholder="e.g. NMH26000000"
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
                    <label className="form-label">Requested Ward / Type</label>
                    <select
                      className="form-control"
                      value={admissionForm.requestedWard}
                      onChange={(e) => setAdmissionForm({ ...admissionForm, requestedWard: e.target.value })}
                    >
                      <option value="">-- Select Ward / Type --</option>
                      <option value="ICU">⚡ ICU</option>
                      <option value="General Ward A">🏢 General Ward A</option>
                      <option value="General Ward B">🏢 General Ward B</option>
                      <option value="VIP">👑 VIP</option>
                      <option value="Normal">🛌 Normal</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Primary Diagnosis</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Post-operative observation"
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
                  <label className="form-label">Select Vacant Bed Card</label>
                  <select
                    className="form-control"
                    value={targetBedId}
                    onChange={(e) => setTargetBedId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Vacant Bed Card --</option>
                    {beds
                      .filter((b) => b.status === BedStatus.VACANT)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.bedNumber} ({b.subType || b.bedType || 'Ward'} — {b.roomNumber})
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
                    placeholder="e.g. General Ward A"
                    value={wardForm.name}
                    onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Floor / Location *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 1st Floor Wing A"
                    value={wardForm.floor}
                    onChange={(e) => setWardForm({ ...wardForm, floor: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-control"
                    placeholder="Ward details"
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
