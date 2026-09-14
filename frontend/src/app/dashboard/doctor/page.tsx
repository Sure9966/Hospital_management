'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import { getUser, User } from '@/lib/auth';

const emptyPrescriptionItem = { medicineName: '', power: '500mg', dosage: '1 tablet twice daily', duration: '5 days', quantity: 10, unitPrice: 15 };

const emptyConsultationForm = {
  patientId: '',
  patientName: '',
  consultationNotes: '',
  diagnosis: '',
  testOrders: '',
  labPriority: 'NORMAL',
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
  const [discharges, setDischarges] = useState<any[]>([]);
  const [storeTablets, setStoreTablets] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [savingDischarge, setSavingDischarge] = useState(false);

  const [dischargeForm, setDischargeForm] = useState({
    patientId: '',
    admissionNumber: '',
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
  const [activeTab, setActiveTab] = useState<'queue' | 'patients' | 'consultation' | 'vitals' | 'tests' | 'prescriptions' | 'bedrequests' | 'discharges'>('queue');
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
    admissionNumber: '',
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
      api.get('/doctor/discharges').catch(() => ({ data: [] })),
      api.get('/pharmacy/tablets').catch(() => ({ data: [] })),
      api.get('/lab').catch(() => ({ data: [] })),
    ])
      .then(([patRes, vitRes, apptRes, consultRes, admRes, rxRes, dischargeRes, tabletRes, labRes]) => {
        const patData = patRes.data || [];
        setPatients(patData);
        setVitals(vitRes.data || []);
        setAppointments(apptRes.data || []);
        setConsultations(consultRes.data || []);
        setDischarges(dischargeRes.data || []);
        setStoreTablets(tabletRes.data || []);
        setLabTests(labRes.data || []);

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
      tab === 'bedrequests' ||
      tab === 'discharges'
    ) {
      setActiveTab(tab);
    } else {
      setActiveTab('queue');
    }
  }, [searchParams]);


  const openDischargeModal = (patient: any) => {
    setDischargeForm({
      patientId: patient.patientId,
      admissionNumber: patient.admissionNumber || '',
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
    if (savingDischarge) return;
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

  const toggleTestOrder = (testName: string) => {
    const current = consultForm.testOrders
      ? consultForm.testOrders.split(',').map(s => s.trim()).filter(Boolean)
      : [];
    let updated: string[];
    if (current.includes(testName)) {
      updated = current.filter(t => t !== testName);
    } else {
      updated = [...current, testName];
    }
    setConsultForm(f => ({ ...f, testOrders: updated.join(', ') }));
  };

  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingConsult) return;
    setSavingConsult(true);
    try {
      const testList = consultForm.testOrders
        ? consultForm.testOrders.split(',').map(s => s.trim()).filter(Boolean)
        : [];

      const payload = {
        ...consultForm,
        testOrders: testList,
      };
      await api.post('/doctor/consultations', payload);

      if (consultForm.admittedByDoctor && consultForm.patientId) {
        await api.post(`/doctor/patient/${consultForm.patientId}/assign-doctor`, {
          doctorName: consultForm.admittedByDoctor,
        });
      }

      // Automatically dispatch 1 single consolidated Lab Test order to Lab Module API
      if (testList.length > 0 && consultForm.patientId) {
        const uniqueTests = Array.from(new Set(testList));
        const combinedTestName = uniqueTests.join(', ');
        let category = 'Pathology';
        let sampleType = 'Blood / Diagnostic';
        const lower = combinedTestName.toLowerCase();
        if (lower.includes('x-ray') || lower.includes('ct') || lower.includes('mri') || lower.includes('ultrasound') || lower.includes('usg')) {
          category = 'Radiology & Pathology';
          sampleType = 'Blood / Imaging';
        } else if (lower.includes('urine') || lower.includes('urinalysis')) {
          category = 'Microbiology';
          sampleType = 'Urine / Sample';
        } else if (lower.includes('lipid') || lower.includes('lft') || lower.includes('kft') || lower.includes('creatinine') || lower.includes('sugar') || lower.includes('fbs')) {
          category = 'Biochemistry';
          sampleType = 'Blood';
        }

        try {
          await api.post('/lab', {
            patientId: consultForm.patientId,
            patientName: consultForm.patientName,
            doctorName: doctorFullName,
            doctorId,
            testName: combinedTestName,
            category,
            sampleType,
            priority: consultForm.labPriority || 'NORMAL',
            notes: `Ordered in Consultation: ${consultForm.diagnosis || 'Clinical Orders'}`,
          });
          toast.success('🧪 Dispatched 1 Lab Order to Lab Portal & Nurses!');
        } catch (err) {
          console.warn('Lab order dispatch warning:', err);
        }
      } else {
        toast.success('✅ Consultation Notes Saved!');
      }

      setShowConsultModal(false);
      setConsultForm({ ...emptyConsultationForm });
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error saving consultation');
    } finally {
      setSavingConsult(false);
    }
  };

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingPrescription) return;

    // ✅ Validate items first
    const validItems = prescriptionForm.items.filter(
      i => i.medicineName && i.medicineName.trim() !== ''
    );

    if (validItems.length === 0) {
      toast.error('Please add at least one medicine with a name.');
      return;
    }

    // ✅ Sanitize numbers and calculate line totals
    const medicines = validItems.map(i => {
      const name = i.power && !i.medicineName.toLowerCase().includes(i.power.toLowerCase())
        ? `${i.medicineName.trim()} (${i.power.trim()})`
        : i.medicineName.trim();
      return {
        name,
        dosage: i.dosage?.trim() || `${i.power || '500mg'} - As directed`,
        duration: i.duration?.trim() || '5 days',
        quantity: Number(i.quantity) || 1,
        unitCost: Number(i.unitPrice) || 0,
        lineTotal: (Number(i.quantity) || 1) * (Number(i.unitPrice) || 0),
      };
    });

    setSavingPrescription(true);
    try {
      await api.post('/pharmacy/prescriptions', {
        patientId: prescriptionForm.patientId.trim(),
        admissionNumber: prescriptionForm.admissionNumber.trim(),
        patientName: prescriptionForm.patientName.trim(),
        doctorName: prescriptionForm.doctorName,
        notes: prescriptionForm.notes,
        medicines, // ✅ always a non-empty array of valid objects
      });

      toast.success('💊 Prescription created and sent to Pharmacy!');
      setShowPrescriptionModal(false);
      loadData();
    } catch (err: any) {
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
    if (savingAssign) return;
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
    if (savingBedRequest) return;
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

  const handleSelectTablet = (idx: number, val: string) => {
    const matched = storeTablets.find(
      t =>
        t.name.toLowerCase() === val.toLowerCase() ||
        `${t.name} ${t.power}`.toLowerCase() === val.toLowerCase() ||
        val.toLowerCase().includes(t.name.toLowerCase())
    );

    setPrescriptionForm(f => {
      const next = [...f.items];
      if (matched) {
        next[idx] = {
          ...next[idx],
          medicineName: matched.name,
          power: matched.power || next[idx].power || '500mg',
          unitPrice: Number(matched.price) || next[idx].unitPrice || 0,
          dosage: `${matched.power || ''} - 1 tablet twice daily`,
        };
      } else {
        next[idx] = {
          ...next[idx],
          medicineName: val,
        };
      }
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

  const downloadDischargePdf = async (dischargeId: string, patientId: string) => {
    try {
      const response = await api.get(`/doctor/discharges/${dischargeId}/pdf`, {
        responseType: 'blob',
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${patientId}_discharge.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('✅ Discharge PDF downloaded successfully');
    } catch (error) {
      toast.error('Failed to download discharge PDF');
    }
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
            { id: 'discharges', label: '📋 Discharge Summaries', icon: '🏥' },
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
                          {p.isEmergency && (
                            <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 10 }}>
                              🚨 Emergency {p.isBasicRegistrationComplete ? '' : '(Pending Details)'}
                            </span>
                          )}
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
            <div className="card-header flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">🧪 Live Laboratory & Diagnostic Test Orders ({labTests.length})</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowConsultModal(true)}>+ Order New Lab Test</button>
            </div>
            <div className="table-container">
              {labTests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🧪</div>
                  <h3>No lab test orders found</h3>
                  <p>When you prescribe diagnostic laboratory or radiology tests in consultation notes, they will be dispatched to the Lab Portal and listed here with live status tracking.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Patient Name & ID</th>
                      <th>Test Name & Category</th>
                      <th>Sample Type</th>
                      <th>Priority</th>
                      <th>Live Lab Status</th>
                      <th>Results & Report Findings</th>
                      <th>Order Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labTests.map((t: any) => (
                      <tr key={t.id}>
                        <td>
                          <strong>{t.patientName}</strong>
                          <br /><span className="text-muted text-xs">{t.patientId}</span>
                        </td>
                        <td>
                          <strong>{t.testName}</strong>
                          <br /><span className="badge badge-info">{t.category || 'Pathology'}</span>
                        </td>
                        <td>
                          <span className="badge badge-secondary">🩸 {t.sampleType || 'Blood'}</span>
                        </td>
                        <td>
                          <span className={t.priority === 'URGENT' ? 'badge badge-danger' : 'badge badge-info'}>
                            {t.priority === 'URGENT' ? '🔥 URGENT' : '🟢 NORMAL'}
                          </span>
                        </td>
                        <td>
                          <span className={t.status === 'COMPLETED' ? 'badge badge-success' : t.status === 'IN_PROGRESS' ? 'badge badge-warning' : 'badge badge-gray'}>
                            {t.status === 'COMPLETED' && '✅ COMPLETED'}
                            {t.status === 'IN_PROGRESS' && '🔬 IN PROGRESS'}
                            {t.status === 'PENDING' && '⏳ PENDING'}
                            {t.status === 'CANCELLED' && '❌ CANCELLED'}
                          </span>
                        </td>
                        <td style={{ maxWidth: 260 }}>
                          {t.resultSummary ? (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-main)' }}>{t.resultSummary}</div>
                              {t.reportUrl && (
                                <a
                                  href={t.reportUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ fontSize: 11, color: '#0284c7', textDecoration: 'underline', marginTop: 2, display: 'inline-block' }}
                                >
                                  📄 View Official Report
                                </a>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting lab processing...</span>
                          )}
                        </td>
                        <td>{new Date(t.createdAt || Date.now()).toLocaleDateString()}</td>
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

        {/* TAB 8: Discharge Summaries */}
        {activeTab === 'discharges' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📋 Patient Discharge Summaries ({discharges.length})</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Discharge summaries with PDF generation for discharged patients.
              </p>
              {discharges.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>No discharge summaries found</h3>
                  <p>Discharge summaries will appear here when patients are discharged.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient Name</th>
                        <th>Patient ID</th>
                        <th>Admission No</th>
                        <th>Discharge Date</th>
                        <th>Condition</th>
                        <th>Diagnosis</th>
                        <th>Discharge PDF</th>
                        <th>Date Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {discharges.map((d: any) => (
                        <tr key={d.id}>
                          <td><strong>{d.patientName}</strong></td>
                          <td><code>{d.patientId}</code></td>
                          <td><code>{d.admissionNumber || 'N/A'}</code></td>
                          <td>{d.dischargeDate}</td>
                          <td><span className="badge badge-success">{d.conditionAtDischarge}</span></td>
                          <td>{d.diagnosis || 'N/A'}</td>
                          <td>
                            {d.dischargePdfName ? (
                              <button 
                                className="btn btn-primary btn-sm"
                                onClick={() => downloadDischargePdf(d.id, d.patientId)}
                              >
                                📄 Download PDF
                              </button>
                            ) : (
                              <span className="text-muted text-xs">No PDF</span>
                            )}
                          </td>
                          <td style={{ fontSize: 11 }}>{new Date(d.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
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
                    <input className="form-control" placeholder="NMH26000000" value={consultForm.patientId} onChange={e => setConsultForm({ ...consultForm, patientId: e.target.value })} required />
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

                <div className="form-group" style={{ marginBottom: 16, background: 'var(--bg-surface)', padding: 14, borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>
                      🧪 Diagnostic & Lab Test Orders (Dispatched to Lab & Nurses)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Priority:</span>
                      <select
                        className="form-control form-control-sm"
                        style={{ width: 110, padding: '2px 8px', fontSize: 11 }}
                        value={consultForm.labPriority || 'NORMAL'}
                        onChange={e => setConsultForm({ ...consultForm, labPriority: e.target.value })}
                      >
                        <option value="NORMAL">🟢 Normal</option>
                        <option value="URGENT">🔥 Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Preset Test Category Badges */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {/* Radiology */}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>🩻 Radiology & Imaging:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Chest X-Ray PA View', 'CT Scan Abdomen', 'MRI Brain', 'USG Abdomen'].map(t => {
                        const active = consultForm.testOrders?.split(',').map(s => s.trim()).includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20 }}
                            onClick={() => toggleTestOrder(t)}
                          >
                            {active ? '✓ ' : '+ '}{t}
                          </button>
                        );
                      })}
                    </div>

                    {/* Pathology & Blood */}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>🩸 Blood & Pathology:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Complete Blood Count (CBC)', 'Blood Group & Rh', 'Hemoglobin (Hb)', 'Lipid Profile', 'Liver Function Test (LFT)', 'Kidney Function Test (KFT)', 'Fasting Blood Sugar (FBS)'].map(t => {
                        const active = consultForm.testOrders?.split(',').map(s => s.trim()).includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20 }}
                            onClick={() => toggleTestOrder(t)}
                          >
                            {active ? '✓ ' : '+ '}{t}
                          </button>
                        );
                      })}
                    </div>

                    {/* Microbiology, Urine & Cardiology */}
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>🔬 Urine, Swab & Cardiology:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {['Urinalysis & Routine Culture', 'COVID-19 Swab Test', 'ECG 12-Lead', 'Echocardiogram (2D Echo)'].map(t => {
                        const active = consultForm.testOrders?.split(',').map(s => s.trim()).includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            className={`btn btn-sm ${active ? 'btn-primary' : 'btn-secondary'}`}
                            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20 }}
                            onClick={() => toggleTestOrder(t)}
                          >
                            {active ? '✓ ' : '+ '}{t}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <input
                    className="form-control"
                    placeholder="Selected tests will appear here (e.g. Chest X-Ray, CBC, Urinalysis...)"
                    value={consultForm.testOrders || ''}
                    onChange={e => setConsultForm({ ...consultForm, testOrders: e.target.value })}
                  />
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
          <div className="modal" style={{ maxWidth: 880 }}>
            <div className="modal-header">
              <h3>💊 Create Patient Prescription</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowPrescriptionModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSavePrescription}>
              <div className="modal-body">
                <div className="form-grid form-grid-4" style={{ marginBottom: 14 }}>
                  <div className="form-group">
                    <label className="form-label">Patient ID *</label>
                    <input className="form-control" placeholder="NMH26000000" value={prescriptionForm.patientId} onChange={e => setPrescriptionForm({ ...prescriptionForm, patientId: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Admission No</label>
                    <input className="form-control" placeholder="IP26000000" value={prescriptionForm.admissionNumber} onChange={e => setPrescriptionForm({ ...prescriptionForm, admissionNumber: e.target.value })} />
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

                {/* Quick Select Store Tablet Banner */}
                {storeTablets.length > 0 && (
                  <div style={{ background: 'var(--bg-surface)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ fontSize: 13 }}>
                      <strong>🏬 Pharmacy Store Inventory:</strong> {storeTablets.length} tablet types available in stock
                    </div>
                    <div className="flex gap-2">
                      <select
                        className="form-control form-control-sm"
                        style={{ width: 270 }}
                        onChange={e => {
                          if (e.target.value) {
                            const t = storeTablets.find(item => item.id === e.target.value);
                            if (t) {
                              setPrescriptionForm(f => ({
                                ...f,
                                items: [
                                  ...f.items.filter(item => item.medicineName.trim() !== ''),
                                  {
                                    medicineName: t.name,
                                    power: t.power,
                                    dosage: `${t.power} - 1 tablet twice daily`,
                                    duration: '5 days',
                                    quantity: 10,
                                    unitPrice: Number(t.price) || 0,
                                  },
                                ],
                              }));
                            }
                            e.target.value = '';
                          }
                        }}
                      >
                        <option value="">+ Quick Pick Store Tablet...</option>
                        {storeTablets.map(t => (
                          <option key={t.id} value={t.id}>
                            💊 {t.name} ({t.power}) - ₹{t.price} (Stock: {t.stockQuantity})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: 14 }}>
                  <div className="flex justify-between items-center" style={{ marginBottom: 10 }}>
                    <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>Prescribed Medicines & Costing</label>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addPrescriptionItem}>+ Add Medicine</button>
                  </div>

                  {/* Column Header Legend */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr auto', gap: 10, padding: '6px 12px', background: 'var(--bg-surface)', borderRadius: '6px 6px 0 0', border: '1px solid var(--border)', borderBottom: 'none', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
                    <div>NAME</div>
                    <div>POWER</div>
                    <div>UNIT PRICE</div>
                    <div>NO OF UNITS</div>
                    <div>TOTAL PRICE</div>
                    <div>ACTION</div>
                  </div>

                  {prescriptionForm.items.map((item: any, idx: number) => {
                    const lineTotal = ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2);
                    return (
                      <div key={idx} style={{ marginBottom: 10, padding: 12, border: '1px solid var(--border)', background: 'var(--bg-surface)', borderRadius: idx === 0 ? '0 0 8px 8px' : 8 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr auto', gap: 10, alignItems: 'center' }}>
                          {/* 1. Name */}
                          <div>
                            <input
                              list={`store-tablets-${idx}`}
                              className="form-control"
                              placeholder="Paracetamol"
                              value={item.medicineName}
                              onChange={e => handleSelectTablet(idx, e.target.value)}
                              required
                            />
                            <datalist id={`store-tablets-${idx}`}>
                              {storeTablets.map((t: any) => (
                                <option key={t.id} value={`${t.name} ${t.power}`}>
                                  ₹{t.price} | Stock: {t.stockQuantity} ({t.category || 'General'})
                                </option>
                              ))}
                            </datalist>
                          </div>

                          {/* 2. Power */}
                          <div>
                            <input
                              className="form-control"
                              placeholder="500mg"
                              value={item.power || ''}
                              onChange={e => updateItem(idx, 'power', e.target.value)}
                            />
                          </div>

                          {/* 3. Unit Price */}
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="form-control"
                              placeholder="15.00"
                              value={item.unitPrice}
                              onChange={e => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                          </div>

                          {/* 4. No of Units */}
                          <div>
                            <input
                              type="number"
                              min="1"
                              className="form-control"
                              placeholder="10"
                              value={item.quantity}
                              onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>

                          {/* 5. Total Price */}
                          <div>
                            <div style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6, fontWeight: 700, color: '#38bdf8', fontSize: 13, border: '1px solid var(--border)', textAlign: 'right' }}>
                              ${lineTotal}
                            </div>
                          </div>

                          {/* Action */}
                          <div>
                            {prescriptionForm.items.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-danger btn-sm btn-icon"
                                onClick={() => removePrescriptionItem(idx)}
                                title="Remove Item"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Dosage Frequency & Duration row */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)' }}>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Frequency:</span>
                            <input
                              className="form-control form-control-sm"
                              placeholder="1 tablet twice daily"
                              value={item.dosage}
                              onChange={e => updateItem(idx, 'dosage', e.target.value)}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Duration:</span>
                            <input
                              className="form-control form-control-sm"
                              placeholder="5 days"
                              value={item.duration}
                              onChange={e => updateItem(idx, 'duration', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Total Summary Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', marginTop: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-secondary)' }}>
                      Prescribed Medicines: <strong>{prescriptionForm.items.length}</strong>
                    </span>
                    <div style={{ fontSize: 13 }}>
                      Total Estimated Prescription Price: <strong style={{ color: '#38bdf8', fontSize: 15, marginLeft: 4 }}>${prescriptionForm.items.reduce((sum: number, item: any) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0).toFixed(2)}</strong>
                    </div>
                  </div>
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
                      <div><strong>Attending Doctor:</strong> <span style={{ color: 'var(--primary-light)', fontWeight: 700 }}>{selectedPatientEhr.patient?.admittedBy || 'Unassigned'}</span></div>
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
                    <input className="form-control" placeholder="NMH26000000" value={bedRequestForm.patientId} onChange={e => setBedRequestForm({ ...bedRequestForm, patientId: e.target.value })} required />
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

                  <div className="form-group">
                    <label className="form-label">
                      Admission Number
                    </label>

                    <input
                      className="form-control"
                      value={dischargeForm.admissionNumber}
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