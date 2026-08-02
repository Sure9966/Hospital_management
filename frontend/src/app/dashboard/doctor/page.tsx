'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

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
  const [patients, setPatients] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<'queue' | 'patients' | 'consultation' | 'vitals' | 'tests' | 'prescriptions'>('queue');
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
    doctorName: 'Dr. Sarah Jenkins',
    notes: 'Take medicines after meals with warm water.',
    items: [{ ...emptyPrescriptionItem }],
  });
  const [savingPrescription, setSavingPrescription] = useState(false);

  // Assign Doctor Modal Form
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ patientId: '', patientName: '', doctorName: 'Dr. Sarah Jenkins' });
  const [savingAssign, setSavingAssign] = useState(false);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/patients'),
      api.get('/nurse/vitals'),
      api.get('/receptionist/appointments/today'),
      api.get('/doctor/consultations'),
    ])
      .then(([patRes, vitRes, apptRes, consultRes]) => {
        setPatients(patRes.data || []);
        setVitals(vitRes.data || []);
        setAppointments(apptRes.data || []);
        setConsultations(consultRes.data || []);
      })
      .catch(() => toast.error('Failed to load doctor dashboard records'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPrescription(true);
    try {
      const totalAmount = prescriptionForm.items.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.unitPrice)), 0);
      await api.post('/pharmacy/prescriptions', {
        ...prescriptionForm,
        totalAmount,
      });
      toast.success('💊 Prescription created and sent to Pharmacy!');
      setShowPrescriptionModal(false);
      loadData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error creating prescription');
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
    (p.admittedBy && p.admittedBy.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout role="doctor">
      <div className="topbar">
        <div className="topbar-title">🩺 Doctor Clinical Management Dashboard</div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => { setConsultForm({ ...emptyConsultationForm }); setShowConsultModal(true); }}>
            📝 Add Consultation Note
          </button>
          <button className="btn btn-secondary" onClick={() => setShowPrescriptionModal(true)}>
            💊 Create Prescription
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* Navigation Responsive Tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
          {[
            { id: 'queue', label: '📅 Today OPD Queue', icon: '🎟️' },
            { id: 'patients', label: '🏥 Patient Records & Files', icon: '📂' },
            { id: 'consultation', label: '📝 Consultation Notes & Diagnosis', icon: '🩺' },
            { id: 'vitals', label: '💗 Clinical Vitals Log', icon: '🌡️' },
            { id: 'tests', label: '🧪 Test Orders & Lab Results', icon: '🔬' },
            { id: 'prescriptions', label: '💊 Prescriptions Created', icon: '📑' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ borderRadius: 20, padding: '8px 16px', fontSize: 13, whiteSpace: 'nowrap' }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {/* Operational Key Metrics */}
        <div className="stats-grid">
          {[
            { icon: '🏥', label: 'Total Patients', value: patients.length, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
            { icon: '📅', label: 'Today Appointments', value: appointments.length, color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
            { icon: '🚨', label: 'Critical Vitals', value: vitals.filter(v => v.status === 'critical').length, color: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
            { icon: '🩺', label: 'Consultation Notes', value: consultations.length, color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
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
              <span className="card-title">📅 OPD Consultation Waiting Queue Today ({appointments.length})</span>
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
                          <span className="badge badge-info">Dr. {a.doctorName}</span>
                        </td>
                        <td><span className={statusBadge(a.status)}>{a.status}</span></td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn btn-primary btn-sm" onClick={() => {
                              setConsultForm(f => ({ ...f, patientId: a.patientId, patientName: a.patientName, admittedByDoctor: a.doctorName }));
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
              <span className="card-title">🏥 Patient EHR Database & Hospital Assigned Doctors ({filteredPatients.length})</span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="🔍 Search patient name, ID, or doctor..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 260 }}
              />
            </div>
            <div className="table-container">
              {filteredPatients.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">🏥</div><h3>No matching patient files found</h3></div>
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
                            {p.admittedBy ? (
                              <strong style={{ color: 'var(--primary-light)', fontSize: 13 }}>Dr. {p.admittedBy}</strong>
                            ) : (
                              <span className="text-muted text-xs">Unassigned</span>
                            )}
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: 11 }}
                              onClick={() => {
                                setAssignForm({ patientId: p.patientId, patientName: `${p.firstName} ${p.lastName}`, doctorName: p.admittedBy || 'Dr. Sarah Jenkins' });
                                setShowAssignModal(true);
                              }}
                            >
                              ✏️ Update
                            </button>
                          </div>
                        </td>
                        <td>{p.diagnosis || 'Pending Diagnosis'}</td>
                        <td>
                          <button className="btn btn-primary btn-sm" onClick={() => handleOpenEhr(p.patientId)}>
                            📂 Open Patient EHR
                          </button>
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
              <span className="card-title">🧪 Laboratory & Radiology Test Orders & Diagnostic Results</span>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Test ID</th>
                    <th>Patient Name</th>
                    <th>Test Description</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Diagnostic Finding</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'LAB-101', patient: 'John Doe', name: 'Complete Blood Count (CBC)', cat: 'Hematology', status: 'Completed', result: 'Hb: 14.2 g/dL, WBC: 6,800 /uL, Platelets: 250,000 /uL' },
                    { id: 'LAB-102', patient: 'Sarah Connor', name: 'Comprehensive Metabolic Panel', cat: 'Biochemistry', status: 'Completed', result: 'Fasting Glucose: 95 mg/dL, Creatinine: 0.9 mg/dL' },
                    { id: 'LAB-103', patient: 'Michael Scott', name: 'Chest X-Ray PA View', cat: 'Radiology', status: 'Completed', result: 'Lungs clear, no pulmonary infiltrates.' },
                    { id: 'LAB-104', patient: 'Emma Watson', name: 'Lipid Profile Panel', cat: 'Biochemistry', status: 'Pending', result: 'Sample in Central Laboratory for processing.' },
                  ].map(t => (
                    <tr key={t.id}>
                      <td><strong>{t.id}</strong></td>
                      <td>{t.patient}</td>
                      <td>{t.name}</td>
                      <td><span className="badge badge-info">{t.cat}</span></td>
                      <td><span className="badge badge-success">{t.status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: Prescriptions Created */}
        {activeTab === 'prescriptions' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">💊 Doctor Created Prescriptions</span>
              <button className="btn btn-primary btn-sm" onClick={() => setShowPrescriptionModal(true)}>+ New Prescription</button>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Prescriptions created here automatically synchronize with the Pharmacy fulfillment dashboard and generate print-ready billing receipts.</p>
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
                    <input className="form-control" placeholder="Dr. Sarah Jenkins" value={consultForm.admittedByDoctor} onChange={e => setConsultForm({ ...consultForm, admittedByDoctor: e.target.value })} />
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
              <h3>🩺 Update Hospital Assigned Doctor Name</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowAssignModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveAssignDoctor}>
              <div className="modal-body">
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                  This is the responsive hospital assign doctor name that patients only see on their portal and tickets.
                </p>

                <div className="form-group" style={{ marginBottom: 14 }}>
                  <label className="form-label">Patient Name</label>
                  <input className="form-control" value={assignForm.patientName} disabled />
                </div>

                <div className="form-group">
                  <label className="form-label">Assigned Attending Doctor Name *</label>
                  <input className="form-control" placeholder="Dr. Sarah Jenkins" value={assignForm.doctorName} onChange={e => setAssignForm({ ...assignForm, doctorName: e.target.value })} required />
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
    </DashboardLayout>
  );
}
