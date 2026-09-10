'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import { getUser, User } from '@/lib/auth';

const emptyPrescriptionItem = { medicineName: '', dosage: '1 tablet twice daily', duration: '5 days', quantity: 10, unitPrice: 15 };

const emptyConsultationForm = {
  patientId: '',
  patientName: '',
  consultationNotes: '',
  diagnosis: '',
  testOrders: '',
  followUpDate: '',
  followUpInstructions: '',
  status: 'in_progress',
  admittedByDoctor: '',
};

export default function DoctorDashboard() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [savingDischarge, setSavingDischarge] = useState(false);

  const [dischargeForm, setDischargeForm] = useState({
    patientId: '',
    patientName: '',
    diagnosis: '',
    dischargeDate: new Date().toISOString().split('T')[0],
    conditionAtDischarge: 'Stable',
    dischargeSummary: '',
    medications: '',
    followUpDate: '',
    followUpInstructions: '',
    dietInstructions: '',
    activityInstructions: '',
  });
  const [activeTab, setActiveTab] = useState<'queue' | 'patients' | 'consultation' | 'vitals' | 'tests' | 'prescriptions' | 'bedrequests'>('queue');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected EHR Patient state
  const [selectedPatientEhr, setSelectedPatientEhr] = useState<any>(null);
  const [showEhrModal, setShowEhrModal] = useState(false);
  const [loadingEhr, setLoadingEhr] = useState(false);

  // Consultation Note Modal Form
  const [showConsultModal, setShowConsultModal] = useState(false);
  const [consultForm, setConsultForm] = useState({ ...emptyConsultationForm });
  const [savingConsult, setSavingConsult] = useState(false);

  // Prescription Creation Modal Form
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescriptionForm, setPrescriptionForm] = useState({
    patientId: '',
    patientName: '',
    doctorName: 'Doctor',
    notes: 'Take medicines after meals with warm water.',
    items: [{ ...emptyPrescriptionItem }],
  });
  const [savingPrescription, setSavingPrescription] = useState(false);

  // Assign Doctor Modal Form
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ patientId: '', patientName: '', doctorId: '', doctorName: 'Doctor' });
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignDepartment, setAssignDepartment] = useState('');
  const [eligibleDoctors, setEligibleDoctors] = useState<any[]>([]);

  // Bed Request Modal
  const [showBedRequestModal, setShowBedRequestModal] = useState(false);
  const [bedRequestForm, setBedRequestForm] = useState({
    patientId: '',
    patientName: '',
    doctorName: 'Doctor',
    diagnosis: '',
    requestedWard: 'General',
    notes: '',
  });
  const [savingBedRequest, setSavingBedRequest] = useState(false);
  const [bedRequests, setBedRequests] = useState<any[]>([]);

  // Resolve Doctor Name and Doctor ID
  const doctorFullName = currentUser
    ? (currentUser.firstName?.startsWith('Dr.')
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : `Dr. ${currentUser.firstName} ${currentUser.lastName}`)
    : 'Doctor';
  const doctorId = currentUser?.id || '';

  useEffect(() => {
    const user = getUser();
    if (user) {
      setCurrentUser(user);
      const name = user.firstName?.startsWith('Dr.')
        ? `${user.firstName} ${user.lastName}`
        : `Dr. ${user.firstName} ${user.lastName}`;
      setPrescriptionForm(f => ({ ...f, doctorName: name }));
      setAssignForm(f => ({ ...f, doctorId: user.id, doctorName: name }));
      setBedRequestForm(f => ({ ...f, doctorName: name }));
      setConsultForm(f => ({ ...f, admittedByDoctor: name }));
    }
  }, []);

  useEffect(() => {
    const url = assignDepartment ? `/users/doctors?department=${encodeURIComponent(assignDepartment)}` : '/users/doctors';
    api.get(url)
      .then(res => setEligibleDoctors(res.data || []))
      .catch(() => setEligibleDoctors([]));
  }, [assignDepartment]);

  const loadData = () => {
    setLoading(true);
    const user = getUser();
    Promise.all([
      api.get('/patients'),
      api.get('/nurse/vitals'),
      api.get('/doctor/appointments/my'),
      api.get('/doctor/consultations'),
      api.get('/beds/admissions'),
      api.get('/pharmacy/prescriptions').catch(() => ({ data: [] })),
    ])
      .then(([patRes, vitRes, apptRes, consultRes, admRes, rxRes]) => {
        const patData = patRes.data || [];
        setPatients(patData);
        setVitals(vitRes.data || []);
        setAppointments(apptRes.data || []);
        setConsultations(consultRes.data || []);

        // Only show bed requests submitted for or by this doctor
        const myRequests = (admRes.data || []).filter((a: any) =>
          (a.doctorName && user?.lastName && a.doctorName.toLowerCase().includes(user.lastName.toLowerCase())) ||
          (a.notes && user?.lastName && a.notes.toLowerCase().includes(user.lastName.toLowerCase())) ||
          (a.notes && a.notes.includes('[Doctor Bed Request]'))
        );
        setBedRequests(myRequests);

        // Prescriptions for this doctor's assigned patients
        const myRx = (rxRes.data || []).filter((r: any) =>
          patData.some((p: any) => p.patientId === r.patientId) ||
          (r.doctorName && user?.lastName && r.doctorName.toLowerCase().includes(user.lastName.toLowerCase()))
        );
        setPrescriptions(myRx);
      })
      .catch(() => toast.error('Failed to load doctor dashboard records'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');

    if (
      tab === 'patients' ||
      tab === 'consultation' ||
      tab === 'vitals' ||
      tab === 'tests' ||
      tab === 'prescriptions' ||
      tab === 'bedrequests'
    ) {
      setActiveTab(tab);
    } else {
      setActiveTab('queue');
    }
  }, [searchParams]);


  const openDischargeModal = (patient: any) => {
    setDischargeForm({
      patientId: patient.patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      diagnosis: patient.diagnosis || '',
      dischargeDate: new Date().toISOString().split('T')[0],
      conditionAtDischarge: 'Stable',
      dischargeSummary: '',
      medications: '',
      followUpDate: '',
      followUpInstructions: '',
      dietInstructions: '',
      activityInstructions: '',
    });

    setShowDischargeModal(true);
  };

  const handleDischargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingDischarge(true);

    try {
      await api.post(
        `/doctor/patient/${dischargeForm.patientId}/discharge`,
        dischargeForm
      );

      toast.success(
        '✅ Patient discharged successfully. Nurse notified.'
      );

      setShowDischargeModal(false);
      loadData();

    } catch (err: any) {
      toast.error(
        err.response?.data?.message ||
        'Failed to discharge patient'
      );
    } finally {
      setSavingDischarge(false);
    }
  };
  const handleOpenEhr = async (patientIdentifier: string) => {
    setLoadingEhr(true);
    setShowEhrModal(true);
    try {
      const { data } = await api.get(`/doctor/patient/${patientIdentifier}/ehr`);
      setSelectedPatientEhr(data);
    } catch {
      toast.error('Could not load patient EHR records');
      setShowEhrModal(false);
    } finally {
      setLoadingEhr(false);
    }
  };

  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConsult(true);
    try {
      const payload = {
        ...consultForm,
        testOrders: consultForm.testOrders ? consultForm.testOrders.split(',').map(s => s.trim()) : [],
      };
      await api.post('/doctor/consultations', payload);

      if (consultForm.admittedByDoctor && consultForm.patientId) {
        await api.post(`/doctor/patient/${consultForm.patientId}/assign-doctor`, {
          doctorName: consultForm.admittedByDoctor,
        });
      }

      toast.success('✅ Consultation Notes & Medical Orders Saved!');
      setShowConsultModal(false);
      setConsultForm({ ...emptyConsultationForm });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving consultation');
    } finally {
      setSavingConsult(false);
    }
  };

  // const handleSavePrescription = async (e: React.FormEvent) => {
  //   e.preventDefault();
  //   setSavingPrescription(true);
  //   try {
  //     // Map frontend items (medicineName/unitPrice) → backend medicines (name/unitCost)
  //     const medicines = prescriptionForm.items.map(i => ({
  //       name: i.medicineName,
  //       dosage: i.dosage,
  //       duration: i.duration,
  //       quantity: Number(i.quantity),
  //       unitCost: Number(i.unitPrice),
  //       lineTotal: Number(i.quantity) * Number(i.unitPrice),
  //     }));
  //     await api.post('/pharmacy/prescriptions', {
  //       patientId: prescriptionForm.patientId,
  //       patientName: prescriptionForm.patientName,
  //       doctorName: prescriptionForm.doctorName,
  //       notes: prescriptionForm.notes,
  //       medicines,
  //     });
  //     toast.success('💊 Prescription created and sent to Pharmacy!');
  //     setShowPrescriptionModal(false);
  //     loadData();
  //   } catch (err: any) {
  //     toast.error(err.response?.data?.message || 'Error creating prescription');
  //   } finally {
  //     setSavingPrescription(false);
  //   }
  // };
  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();

    // ✅ Validate items first
    const validItems = prescriptionForm.items.filter(
      i => i.medicineName && i.medicineName.trim() !== ''
    );

    if (validItems.length === 0) {
      toast.error('Please add at least one medicine with a name.');
      return;
    }

    // ✅ Sanitize numbers (avoid NaN)
    const medicines = validItems.map(i => ({
      name: i.medicineName.trim(),
      dosage: i.dosage?.trim() || 'As directed',
      duration: i.duration?.trim() || '5 days',
      quantity: Number(i.quantity) || 0,
      unitCost: Number(i.unitPrice) || 0,
    }));

    setSavingPrescription(true);
    try {
      await api.post('/pharmacy/prescriptions', {
        patientId: prescriptionForm.patientId.trim(),
        patientName: prescriptionForm.patientName.trim(),
        doctorName: prescriptionForm.doctorName,
        notes: prescriptionForm.notes,
        medicines, // ✅ always a non-empty array of valid objects
      });

      toast.success('💊 Prescription created and sent to Pharmacy!');
      setShowPrescriptionModal(false);
      loadData();
    } catch (err: any) {
      // 🔎 Log the full backend error so you can see exactly which field failed
      console.error('Prescription error:', err.response?.data);
      toast.error(
        err.response?.data?.message ||
        err.response?.data?.errors?.[0]?.message ||
        'Error creating prescription'
      );
    } finally {
      setSavingPrescription(false);
    }
  };

  const handleSaveAssignDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingAssign(true);
    try {
      await api.post(`/doctor/patient/${assignForm.patientId}/assign-doctor`, {
        doctorName: assignForm.doctorName,
        doctorId: assignForm.doctorId,
      });
      toast.success(`🩺 Assigned Attending Doctor (${assignForm.doctorName}) updated!`);
      setShowAssignModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error assigning doctor');
    } finally {
      setSavingAssign(false);
    }
  };

  const handleSendBedRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBedRequest(true);
    try {
      await api.post('/beds/admissions', {
        ...bedRequestForm,
        notes: `[Doctor Bed Request] ${bedRequestForm.notes}`.trim(),
      });
      toast.success('🛏️ Bed request sent to Reception & Management!');
      setShowBedRequestModal(false);
      setBedRequestForm({ patientId: '', patientName: '', doctorName: doctorFullName, diagnosis: '', requestedWard: 'General', notes: '' });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send bed request');
    } finally {
      setSavingBedRequest(false);
    }
  };

  const addPrescriptionItem = () => {
    setPrescriptionForm(f => ({ ...f, items: [...f.items, { ...emptyPrescriptionItem }] }));
  };

  const removePrescriptionItem = (idx: number) => {
    setPrescriptionForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setPrescriptionForm(f => {
      const next = [...f.items];
      next[idx] = { ...next[idx], [field]: value };
      return { ...f, items: next };
    });
  };

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      normal: 'badge-success', warning: 'badge-warning', critical: 'badge-danger',
      registered: 'badge-info', admitted: 'badge-purple', under_treatment: 'badge-warning', discharged: 'badge-gray',
      in_progress: 'badge-warning', completed: 'badge-success', follow_up_required: 'badge-purple'
    };
    return `badge ${map[s] || 'badge-gray'}`;
  };

  const filteredPatients = patients.filter(p =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.diagnosis && p.diagnosis.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (p.admittedBy && p.admittedBy.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout role="doctor">
      <div className="topbar">
        <div>
          <div className="topbar-title">🩺 Doctor Clinical Management Dashboard</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Logged in as <strong style={{ color: 'var(--primary-light)' }}>{doctorFullName}</strong> {currentUser?.department ? `• Department: ${currentUser.department}` : ''}
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => { setConsultForm({ ...emptyConsultationForm, admittedByDoctor: doctorFullName }); setShowConsultModal(true); }}>
            📝 Add Consultation Note
          </button>
          <button className="btn btn-secondary" onClick={() => { setPrescriptionForm(f => ({ ...f, doctorName: doctorFullName })); setShowPrescriptionModal(true); }}>
            💊 Create Prescription
          </button>
          <button className="btn" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none' }} onClick={() => { setBedRequestForm(f => ({ ...f, doctorName: doctorFullName })); setShowBedRequestModal(true); }}>
            🛏️ Request Bed
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Navigation Responsive Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20, paddingBottom: 4 }}>
          {[
            { id: 'queue', label: '📅 Today OPD Queue', icon: '🎟️' },
            { id: 'patients', label: '🏥 Patient Records & Files', icon: '📂' },
            { id: 'consultation', label: '📝 Consultation Notes & Diagnosis', icon: '🩺' },
            { id: 'vitals', label: '💗 Clinical Vitals Log', icon: '🌡️' },
            { id: 'tests', label: '🧪 Test Orders & Lab Results', icon: '🔬' },
            { id: 'prescriptions', label: '💊 Prescriptions Created', icon: '📑' },
            { id: 'bedrequests', label: '🛏️ Bed Requests', icon: '🏥', badge: bedRequests.filter((r: any) => r.status === 'pending').length },
          ].map((tab: any) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 20, padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap', position: 'relative' }}
            >
              <span>{tab.icon}</span> {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={{ marginLeft: 5, background: '#ef4444', color: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 10 }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Operational Key Metrics */}
        <div className="stats-grid">
          {[
            { icon: '🏥', label: 'My Assigned Patients', value: patients.length, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
            { icon: '📅', label: 'My Appointments', value: appointments.length, color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
            { icon: '🚨', label: 'Assigned Critical Vitals', value: vitals.filter(v => v.status === 'critical').length, color: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
            { icon: '🩺', label: 'My Consultations', value: consultations.length, color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--gradient': s.gradient } as any}>
              <div className="stat-icon" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* TAB 1: Today OPD Queue */}
        {activeTab === 'queue' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📅 My OPD Consultation Waiting Queue Today ({appointments.length})</span>
            </div>
            <div className="table-container">
              {appointments.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">📅</div><h3>No OPD patients queued today</h3></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Patient Name & ID</th>
                      <th>Reason / Complaint</th>
                      <th>Attending Doctor (Visible to Patient)</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(a => (
                      <tr key={a.id}>
                        <td><strong>{a.appointmentTime}</strong></td>
                        <td>
                          <strong>{a.patientName}</strong>
                          <br /><span className="text-muted text-xs">{a.patientId}</span>
                        </td>
                        <td>{a.reason || 'General OPD Consultation'}</td>
                        <td>
                          <span className="badge badge-info">{a.doctorName}</span>
                        </td>
                        <td><span className={statusBadge(a.status)}>{a.status}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-primary btn-sm" onClick={() => {
                              setConsultForm(f => ({ ...f, patientId: a.patientId, patientName: a.patientName, admittedByDoctor: a.doctorName || doctorFullName }));
                              setShowConsultModal(true);
                            }}>
                              📝 Consult
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleOpenEhr(a.patientId)}>
                              📂 Open EHR
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Patient Records & Files */}
        {activeTab === 'patients' && (
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="card-title">🏥 My Assigned Patient Records & Files ({filteredPatients.length})</span>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  Showing exclusively patients assigned to <strong style={{ color: 'var(--primary-light)' }}>{doctorFullName}</strong>
                </p>
              </div>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="🔍 Search assigned patient name, ID, or diagnosis..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 280 }}
              />
            </div>
            <div className="table-container">
              {filteredPatients.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏥</div>
                  <h3>No matching assigned patient files found</h3>
                  <p>Only patients assigned to you are displayed in this view.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Patient ID / Name</th>
                      <th>Gender & DOB</th>
                      <th>Blood Group</th>
                      <th>Status</th>
                      <th>Hospital Assigned Doctor Name</th>
                      <th>Diagnosis</th>
                      <th>EHR Profile</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.map(p => (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.firstName} {p.lastName}</strong>
                          <br /><span style={{ color: '#0ea5e9', fontSize: 11, fontWeight: 700 }}>{p.patientId}</span>
                        </td>
                        <td>{p.gender} ({p.dateOfBirth})</td>
                        <td><span className="badge badge-info">{p.bloodGroup || 'N/A'}</span></td>
                        <td><span className={statusBadge(p.status)}>{p.status}</span></td>
                        <td>
                          <div className="flex items-center gap-2">
                            {p.admittedBy || p.assignedDoctorName ? (
                              <strong style={{ color: 'var(--primary-light)', fontSize: 13 }}>{p.assignedDoctorName || p.admittedBy}</strong>
                            ) : (
                              <span className="text-muted text-xs">Unassigned</span>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              onClick={() => {
                                setAssignForm({
                                  patientId: p.patientId,
                                  patientName: `${p.firstName} ${p.lastName}`,
                                  doctorId: p.assignedDoctorId || doctorId,
                                  doctorName: p.assignedDoctorName || p.admittedBy || doctorFullName,
                                });
                                setShowAssignModal(true);
                              }}
                            >
                              ✏️ Update
                            </button>
                          </div>
                        </td>
                        <td>{p.diagnosis || 'Pending Diagnosis'}</td>
                        {/* <td>
                          <button className="btn btn-primary btn-sm" onClick={() => handleOpenEhr(p.patientId)}>
                            📂 Open Patient EHR
                          </button>
                        </td> */}

                        <td>
                          <div
                            style={{
                              display: 'flex',
                              gap: 6,
                              flexWrap: 'wrap',
                            }}
                          >
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleOpenEhr(p.patientId)}
                            >
                              📂 Open EHR
                            </button>

                            {p.status !== 'discharged' && (
                              <button type="button" className="btn btn-sm" style={{ background: '#10b981', color: '#fff', border: 'none', }} onClick={() => openDischargeModal(p)}>
                                ✅ Discharge
                              </button>
                            )}
                            {p.status === 'discharged' && (
                              <button type="button" className="btn btn-sm" style={{ background: '#c60938ff', color: '#fff', border: 'none', }} onClick={() => openDischargeModal(p)}>
                                ✅ Discharged
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
        )}

        {/* TAB 3: Consultation Notes & Diagnosis */}
        {activeTab === 'consultation' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📝 Doctor Consultation Notes & Follow-up Schedule ({consultations.length})</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
                {consultations.map(c => (
                  <div key={c.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                      <strong>{c.patientName} ({c.patientId})</strong>
                      <span className={statusBadge(c.status)}>{c.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--primary-light)', fontWeight: 600, marginBottom: 8 }}>
                      Attending Physician: {c.doctorName}
                    </div>
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      <strong>Diagnosis:</strong> {c.diagnosis || 'N/A'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      <strong>Clinical Notes:</strong> {c.consultationNotes || 'No notes attached.'}
                    </div>
                    {c.testOrders && c.testOrders.length > 0 && (
                      <div style={{ fontSize: 11, marginBottom: 8 }}>
                        <strong>Test Orders:</strong> {c.testOrders.join(', ')}
                      </div>
                    )}
                    {c.followUpDate && (
                      <div style={{ fontSize: 11, background: 'rgba(14,165,233,0.1)', padding: 6, borderRadius: 6, color: '#0ea5e9', fontWeight: 600 }}>
                        📅 Follow-up Scheduled: {c.followUpDate} ({c.followUpInstructions || 'Routine Checkup'})
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Clinical Vitals Log */}
        {activeTab === 'vitals' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">🌡️ Triage & Nurse Vitals Records Log ({vitals.length})</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Patient Name / ID</th>
                    <th>Temp</th>
                    <th>BP</th>
                    <th>Heart Rate</th>
                    <th>SpO2</th>
                    <th>Priority</th>
                    <th>Vitals Status</th>
                    <th>Recorded Time</th>
                  </tr>
                </thead>
                <tbody>
                  {vitals.map(v => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.patientName}</strong>
                        <br /><span className="text-muted text-xs">{v.patientId}</span>
                      </td>
                      <td>{v.temperature ? `${v.temperature}°C` : '—'}</td>
                      <td>{v.bloodPressure || '—'}</td>
                      <td>{v.heartRate ? `${v.heartRate} bpm` : '—'}</td>
                      <td>{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                      <td><span className="badge badge-purple">{v.triagePriority || 'Routine'}</span></td>
                      <td><span className={statusBadge(v.status)}>{v.status}</span></td>
                      <td>{new Date(v.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: Test Orders & Lab Results */}
        {activeTab === 'tests' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">🧪 Laboratory & Radiology Test Orders for Assigned Patients</span>
            </div>
            <div className="table-container">
              {consultations.filter(c => c.testOrders && c.testOrders.length > 0).length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🧪</div>
                  <h3>No pending test orders for your assigned patients</h3>
                  <p>When you prescribe diagnostic laboratory or radiology tests in consultation notes, they will appear here.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Patient Name & ID</th>
                      <th>Diagnostic Tests Ordered</th>
                      <th>Attending Doctor</th>
                      <th>Order Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultations
                      .filter(c => c.testOrders && c.testOrders.length > 0)
                      .map((c, idx) => (
                        <tr key={c.id || idx}>
                          <td>
                            <strong>{c.patientName}</strong>
                            <br /><span className="text-muted text-xs">{c.patientId}</span>
                          </td>
                          <td>
                            <div className="flex gap-1 flex-wrap">
                              {(Array.isArray(c.testOrders) ? c.testOrders : String(c.testOrders).split(',')).map((t: string, i: number) => (
                                <span key={i} className="badge badge-info">{t.trim()}</span>
                              ))}
                            </div>
                          </td>
                          <td><span className="badge badge-purple">{c.doctorName}</span></td>
                          <td>{new Date(c.createdAt || Date.now()).toLocaleDateString()}</td>
                          <td><span className="badge badge-success">Active Order</span></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 6: Prescriptions Created */}
        {activeTab === 'prescriptions' && (
          <div className="card">
            <div className="card-header flex justify-between items-center">
              <span className="card-title">💊 Doctor Created Prescriptions ({prescriptions.length})</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPrescriptionModal(true)}>+ New Prescription</button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Prescriptions created for your assigned patients automatically synchronize with Pharmacy fulfillment.
              </p>
              {prescriptions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">💊</div>
                  <h3>No prescriptions created yet for your patients</h3>
                  <p>Click "+ New Prescription" to write a digital prescription for any assigned patient.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Rx ID</th>
                        <th>Patient Name & ID</th>
                        <th>Prescribed Medicines</th>
                        <th>Status</th>
                        <th>Billing</th>
                        <th>Total Cost</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescriptions.map((p: any) => (
                        <tr key={p.id}>
                          <td><code>{p.prescriptionId}</code></td>
                          <td>
                            <strong>{p.patientName}</strong>
                            <br /><span className="text-muted text-xs">{p.patientId}</span>
                          </td>
                          <td>
                            <div style={{ fontSize: 12 }}>
                              {p.medicines && p.medicines.length > 0 ? (
                                p.medicines.map((m: any, mi: number) => (
                                  <div key={mi}>• {m.name} ({m.dosage})</div>
                                ))
                              ) : (
                                <span className="text-muted">No medicines</span>
                              )}
                            </div>
                          </td>
                          <td><span className={statusBadge(p.status)}>{p.status}</span></td>
                          <td><span className="badge badge-info">{p.billingStatus || 'unbilled'}</span></td>
                          <td><strong>${p.totalCost || 0}</strong></td>
                          <td style={{ fontSize: 11 }}>{new Date(p.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 7: Bed Requests */}
        {activeTab === 'bedrequests' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">🛏️ Doctor Bed Admission Requests ({bedRequests.length})</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowBedRequestModal(true)}>🛏️ + New Bed Request</button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>When you submit a bed request, a notification is automatically sent to Reception and Management. Reception will allocate the bed and handle the payment.</p>
            </div>
            {bedRequests.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">🛏️</div><h3>No bed requests submitted yet</h3><p>Click "New Bed Request" to recommend a bed for a patient</p></div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Patient ID</th>
                      <th>Diagnosis</th>
                      <th>Requested Ward</th>
                      <th>Status</th>
                      <th>Allocated Bed</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bedRequests.map((r: any) => (
                      <tr key={r.id}>
                        <td><strong>{r.patientName}</strong></td>
                        <td><code>{r.patientId}</code></td>
                        <td>{r.diagnosis || '—'}</td>
                        <td><span className="badge badge-info">{r.requestedWard || 'General'}</span></td>
                        <td>
                          <span className={`badge ${r.status === 'admitted' ? 'badge-success' : r.status === 'pending' ? 'badge-warning' : 'badge-gray'}`}>{r.status}</span>
                        </td>
                        <td>{r.allocatedBedNumber ? <strong style={{ color: '#10b981' }}>{r.allocatedBedNumber}</strong> : <span className="text-muted">Awaiting reception</span>}</td>
                        <td style={{ fontSize: 11 }}>{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: Add Consultation Note & Diagnosis */}
      {showConsultModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowConsultModal(false)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>📝 Add Doctor Consultation Note & Clinical Orders</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowConsultModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveConsultation}>
              <div className="modal-body">
                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Patient ID *</label>
                    <input className="form-control" placeholder="PAT-2024-0001" value={consultForm.patientId} onChange={e => setConsultForm({ ...consultForm, patientId: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient Name *</label>
                    <input className="form-control" placeholder="John Doe" value={consultForm.patientName} onChange={e => setConsultForm({ ...consultForm, patientName: e.target.value })} required />
                  </div>
                </div>

                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Hospital Assigned Doctor Name (Visible to Patient)</label>
                    <input className="form-control" placeholder={doctorFullName} value={consultForm.admittedByDoctor} onChange={e => setConsultForm({ ...consultForm, admittedByDoctor: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Consultation Status</label>
                    <select className="form-control" value={consultForm.status} onChange={e => setConsultForm({ ...consultForm, status: e.target.value })}>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                      <option value="follow_up_required">Follow-up Required</option>
                      <option value="discharged">Discharged</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Diagnosis & Findings *</label>
                  <input className="form-control" placeholder="Acute Upper Respiratory Tract Infection" value={consultForm.diagnosis} onChange={e => setConsultForm({ ...consultForm, diagnosis: e.target.value })} required />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Clinical Consultation Notes</label>
                  <textarea className="form-control" rows={3} placeholder="Record patient history, physical examination, symptoms, treatment plan..." value={consultForm.consultationNotes} onChange={e => setConsultForm({ ...consultForm, consultationNotes: e.target.value })} />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Laboratory & Radiology Test Orders (comma separated)</label>
                  <input className="form-control" placeholder="CBC, Chest X-Ray PA View, Lipid Profile" value={consultForm.testOrders} onChange={e => setConsultForm({ ...consultForm, testOrders: e.target.value })} />
                </div>

                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Follow-Up Date</label>
                    <input type="date" className="form-control" value={consultForm.followUpDate} onChange={e => setConsultForm({ ...consultForm, followUpDate: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Follow-Up Instructions</label>
                    <input className="form-control" placeholder="Return for routine blood review" value={consultForm.followUpInstructions} onChange={e => setConsultForm({ ...consultForm, followUpInstructions: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowConsultModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingConsult}>
                  {savingConsult ? '⏳ Saving...' : '📝 Save Consultation Notes & Orders'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Prescription */}
      {showPrescriptionModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowPrescriptionModal(false)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h3>💊 Create Patient Prescription</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowPrescriptionModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePrescription}>
              <div className="modal-body">
                <div className="form-grid form-grid-3" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Patient ID *</label>
                    <input className="form-control" placeholder="PAT-2024-0001" value={prescriptionForm.patientId} onChange={e => setPrescriptionForm({ ...prescriptionForm, patientId: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient Name *</label>
                    <input className="form-control" placeholder="John Doe" value={prescriptionForm.patientName} onChange={e => setPrescriptionForm({ ...prescriptionForm, patientName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Doctor Name</label>
                    <input className="form-control" value={prescriptionForm.doctorName} onChange={e => setPrescriptionForm({ ...prescriptionForm, doctorName: e.target.value })} required />
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ margin: 0 }}>Prescribed Medicines</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addPrescriptionItem}>+ Add Medicine</button>
                  </div>

                  {prescriptionForm.items.map((item, idx) => (
                    <div key={idx} className="flex gap-2 items-center" style={{ marginBottom: 8, background: 'var(--bg-surface)', padding: 8, borderRadius: 8, border: '1px solid var(--border)' }}>
                      <input className="form-control" placeholder="Medicine Name" value={item.medicineName} onChange={e => updateItem(idx, 'medicineName', e.target.value)} required style={{ flex: 2 }} />
                      <input className="form-control" placeholder="Dosage" value={item.dosage} onChange={e => updateItem(idx, 'dosage', e.target.value)} style={{ flex: 2 }} />
                      <input className="form-control" placeholder="Qty" type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} style={{ width: 70 }} />
                      <input className="form-control" placeholder="Price ($)" type="number" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} style={{ width: 80 }} />
                      {prescriptionForm.items.length > 1 && (
                        <button type="button" className="btn btn-secondary btn-icon" onClick={() => removePrescriptionItem(idx)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="form-group">
                  <label className="form-label">Instructions / Dosage Notes</label>
                  <textarea className="form-control" rows={2} value={prescriptionForm.notes} onChange={e => setPrescriptionForm({ ...prescriptionForm, notes: e.target.value })} />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPrescriptionModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingPrescription}>
                  {savingPrescription ? '⏳ Processing...' : '💊 Save & Send to Pharmacy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Update Hospital Assigned Doctor Name */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowAssignModal(false)}>
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3>🩺 Update Hospital Assigned Doctor</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowAssignModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveAssignDoctor}>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                  Assign an attending doctor to this patient record. Notifications will be sent directly to the selected doctor.
                </p>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Patient Name</label>
                  <input className="form-control" value={assignForm.patientName} disabled />
                </div>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Filter Department</label>
                  <select
                    className="form-control"
                    value={assignDepartment}
                    onChange={e => setAssignDepartment(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    {['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General', 'Emergency', 'Surgery', 'Oncology'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Attending Doctor * ({eligibleDoctors.length} available)</label>
                  <select
                    className="form-control"
                    value={assignForm.doctorId}
                    onChange={e => {
                      const docId = e.target.value;
                      const doc = eligibleDoctors.find(d => d.id === docId);
                      setAssignForm(f => ({
                        ...f,
                        doctorId: docId,
                        doctorName: doc ? `Dr. ${doc.firstName} ${doc.lastName}` : f.doctorName,
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

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingAssign}>
                  {savingAssign ? '⏳ Saving...' : '💾 Update Assigned Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: Complete Patient EHR Drawer */}
      {showEhrModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEhrModal(false)}>
          <div className="modal" style={{ maxWidth: 840 }}>
            <div className="modal-header">
              <h3>📂 Full Electronic Health Record (EHR) & Diagnostic History</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowEhrModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingEhr || !selectedPatientEhr ? (
                <div className="flex justify-center items-center" style={{ padding: 40 }}>
                  <div className="loading-spinner" />
                </div>
              ) : (
                <>
                  {/* Demographics Card */}
                  <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid var(--border)' }}>
                    <div className="flex justify-between items-center">
                      <div>
                        <span style={{ fontSize: 18, fontWeight: 800 }}>{selectedPatientEhr.patient?.firstName} {selectedPatientEhr.patient?.lastName}</span>
                        <span className="badge badge-info" style={{ marginLeft: 10 }}>{selectedPatientEhr.patient?.patientId}</span>
                      </div>
                      <span className={statusBadge(selectedPatientEhr.patient?.status)}>{selectedPatientEhr.patient?.status}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12, fontSize: 12 }}>
                      <div><strong>Gender:</strong> {selectedPatientEhr.patient?.gender}</div>
                      <div><strong>DOB:</strong> {selectedPatientEhr.patient?.dateOfBirth}</div>
                      <div><strong>Blood Group:</strong> {selectedPatientEhr.patient?.bloodGroup || 'N/A'}</div>
                      <div><strong>Attending Doctor:</strong> <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>Dr. {selectedPatientEhr.patient?.admittedBy || 'Unassigned'}</span></div>
                    </div>
                  </div>

                  {/* Vitals History */}
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🌡️ Clinical Vitals History</h4>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr><th>Date</th><th>Temp</th><th>BP</th><th>HR</th><th>SpO2</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {selectedPatientEhr.vitals?.map((v: any) => (
                            <tr key={v.id}>
                              <td>{new Date(v.createdAt).toLocaleDateString()}</td>
                              <td>{v.temperature ? `${v.temperature}°C` : '—'}</td>
                              <td>{v.bloodPressure || '—'}</td>
                              <td>{v.heartRate ? `${v.heartRate} bpm` : '—'}</td>
                              <td>{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                              <td><span className={statusBadge(v.status)}>{v.status}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Consultation Notes */}
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>📝 Consultation & Diagnosis History</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedPatientEhr.consultations?.map((c: any) => (
                        <div key={c.id} style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                          <div className="flex justify-between">
                            <strong>Diagnosis: {c.diagnosis}</strong>
                            <span style={{ color: 'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleDateString()}</span>
                          </div>
                          <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>{c.consultationNotes}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Laboratory & Test Orders */}
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🧪 Laboratory Results & Test Reports</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedPatientEhr.labResults?.map((l: any) => (
                        <div key={l.id} style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                          <div className="flex justify-between items-center">
                            <strong>{l.testName} ({l.category})</strong>
                            <span className="badge badge-success">{l.status}</span>
                          </div>
                          <div style={{ marginTop: 4, color: 'var(--primary-light)', fontWeight: 600 }}>Findings: {l.result}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Reference Range: {l.referenceRange}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEhrModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: Request Bed for Patient */}
      {showBedRequestModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowBedRequestModal(false)}>
          <div className="modal" style={{ maxWidth: 580 }}>
            <div className="modal-header">
              <h3>🛏️ Request Bed for Patient — Notify Reception</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowBedRequestModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSendBedRequest}>
              <div className="modal-body">
                <div style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  🚨 This request will be sent to <strong style={{ color: '#818cf8' }}>Reception</strong> and <strong style={{ color: '#818cf8' }}>Management</strong> via notification. Reception will handle bed allocation and payment.
                </div>
                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Patient Name *</label>
                    <input className="form-control" placeholder="John Doe" value={bedRequestForm.patientName} onChange={e => setBedRequestForm({ ...bedRequestForm, patientName: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient ID *</label>
                    <input className="form-control" placeholder="PAT-2024-0001" value={bedRequestForm.patientId} onChange={e => setBedRequestForm({ ...bedRequestForm, patientId: e.target.value })} required />
                  </div>
                </div>
                <div className="form-grid form-grid-2" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Attending Doctor Name</label>
                    <input className="form-control" value={bedRequestForm.doctorName} onChange={e => setBedRequestForm({ ...bedRequestForm, doctorName: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Requested Ward</label>
                    <select className="form-control" value={bedRequestForm.requestedWard} onChange={e => setBedRequestForm({ ...bedRequestForm, requestedWard: e.target.value })}>
                      {['General', 'ICU', 'Pediatrics', 'Cardiology', 'Orthopedics', 'Neurology', 'Maternity', 'Emergency'].map(w => <option key={w}>{w}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Diagnosis / Reason for Admission *</label>
                  <input className="form-control" placeholder="e.g. Post-operative monitoring, Cardiac observation..." value={bedRequestForm.diagnosis} onChange={e => setBedRequestForm({ ...bedRequestForm, diagnosis: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Additional Notes for Reception</label>
                  <textarea className="form-control" rows={2} placeholder="Any special requirements, urgency notes, or instructions for reception..." value={bedRequestForm.notes} onChange={e => setBedRequestForm({ ...bedRequestForm, notes: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowBedRequestModal(false)}>Cancel</button>
                <button type="submit" className="btn" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', border: 'none' }} disabled={savingBedRequest}>
                  {savingBedRequest ? '⏳ Sending...' : '🛏️ Send Bed Request to Reception'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: Patient Discharge */}
      {showDischargeModal && (
        <div
          className="modal-overlay"
          onClick={e =>
            e.target === e.currentTarget &&
            setShowDischargeModal(false)
          }
        >
          <div
            className="modal"
            style={{ maxWidth: 760 }}
          >
            <div className="modal-header">
              <div>
                <h3>🏥 Patient Discharge Summary</h3>

                <p
                  style={{
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    marginTop: 4,
                  }}
                >
                  Complete the medical discharge summary.
                  Nursing staff will be notified automatically.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => setShowDischargeModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleDischargeSubmit}>

              <div className="modal-body">

                {/* Patient */}
                <div
                  className="form-grid form-grid-2"
                  style={{ marginBottom: 14 }}
                >
                  <div className="form-group">
                    <label className="form-label">
                      Patient Name
                    </label>

                    <input
                      className="form-control"
                      value={dischargeForm.patientName}
                      disabled
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Patient ID
                    </label>

                    <input
                      className="form-control"
                      value={dischargeForm.patientId}
                      disabled
                    />
                  </div>
                </div>


                {/* Date & Condition */}
                <div
                  className="form-grid form-grid-2"
                  style={{ marginBottom: 14 }}
                >
                  <div className="form-group">
                    <label className="form-label">
                      Discharge Date *
                    </label>

                    <input
                      type="date"
                      className="form-control"
                      value={dischargeForm.dischargeDate}
                      onChange={e =>
                        setDischargeForm(f => ({
                          ...f,
                          dischargeDate: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Condition at Discharge *
                    </label>

                    <select
                      className="form-control"
                      value={dischargeForm.conditionAtDischarge}
                      onChange={e =>
                        setDischargeForm(f => ({
                          ...f,
                          conditionAtDischarge: e.target.value,
                        }))
                      }
                      required
                    >
                      <option value="Stable">Stable</option>
                      <option value="Improved">Improved</option>
                      <option value="Recovered">Recovered</option>
                      <option value="Requires Follow-up">
                        Requires Follow-up
                      </option>
                    </select>
                  </div>
                </div>


                {/* Diagnosis */}
                <div
                  className="form-group"
                  style={{ marginBottom: 14 }}
                >
                  <label className="form-label">
                    Final Diagnosis *
                  </label>

                  <input
                    className="form-control"
                    value={dischargeForm.diagnosis}
                    onChange={e =>
                      setDischargeForm(f => ({
                        ...f,
                        diagnosis: e.target.value,
                      }))
                    }
                    required
                  />
                </div>


                {/* Summary */}
                <div
                  className="form-group"
                  style={{ marginBottom: 14 }}
                >
                  <label className="form-label">
                    Discharge Summary *
                  </label>

                  <textarea
                    className="form-control"
                    rows={4}
                    placeholder="Treatment given, clinical progress and condition at discharge..."
                    value={dischargeForm.dischargeSummary}
                    onChange={e =>
                      setDischargeForm(f => ({
                        ...f,
                        dischargeSummary: e.target.value,
                      }))
                    }
                    required
                  />
                </div>


                {/* Medication */}
                <div
                  className="form-group"
                  style={{ marginBottom: 14 }}
                >
                  <label className="form-label">
                    Medicines on Discharge
                  </label>

                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Paracetamol 500mg twice daily for 3 days..."
                    value={dischargeForm.medications}
                    onChange={e =>
                      setDischargeForm(f => ({
                        ...f,
                        medications: e.target.value,
                      }))
                    }
                  />
                </div>


                {/* Follow-up */}
                <div
                  className="form-grid form-grid-2"
                  style={{ marginBottom: 14 }}
                >
                  <div className="form-group">
                    <label className="form-label">
                      Follow-up Date
                    </label>

                    <input
                      type="date"
                      className="form-control"
                      value={dischargeForm.followUpDate}
                      onChange={e =>
                        setDischargeForm(f => ({
                          ...f,
                          followUpDate: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Follow-up Instructions
                    </label>

                    <input
                      className="form-control"
                      placeholder="Review after 7 days"
                      value={dischargeForm.followUpInstructions}
                      onChange={e =>
                        setDischargeForm(f => ({
                          ...f,
                          followUpInstructions: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>


                {/* Diet + Activity */}
                <div className="form-grid form-grid-2">

                  <div className="form-group">
                    <label className="form-label">
                      Diet Instructions
                    </label>

                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Normal diet, increase fluids..."
                      value={dischargeForm.dietInstructions}
                      onChange={e =>
                        setDischargeForm(f => ({
                          ...f,
                          dietInstructions: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Activity Instructions
                    </label>

                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Avoid heavy activity for one week..."
                      value={dischargeForm.activityInstructions}
                      onChange={e =>
                        setDischargeForm(f => ({
                          ...f,
                          activityInstructions: e.target.value,
                        }))
                      }
                    />
                  </div>

                </div>

              </div>


              <div className="modal-footer">

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDischargeModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn"
                  disabled={savingDischarge}
                  style={{
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                  }}
                >
                  {savingDischarge
                    ? '⏳ Discharging...'
                    : '✅ Confirm Discharge & Notify Nurse'}
                </button>

              </div>

            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}