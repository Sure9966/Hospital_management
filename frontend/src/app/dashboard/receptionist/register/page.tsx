'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['male', 'female', 'other'];
const DEPARTMENTS = ['Emergency', 'Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General', 'Surgery', 'Oncology'];
const SEVERITIES = [
  { value: 'critical', label: '🚨 Critical (Life Threatening)', color: '#ef4444' },
  { value: 'urgent', label: '⚠️ Urgent (High Priority)', color: '#f59e0b' },
  { value: 'standard', label: '🟡 Standard Emergency', color: '#0ea5e9' },
];

const emptyForm = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '',
  bloodGroup: '', phone: '', email: '', address: '',
  emergencyContact: '', emergencyPhone: '',
  insuranceNumber: '', insuranceProvider: '',
  diagnosis: '', ward: '', bedNumber: '', admittedBy: '', assignedNurse: '',
  assignedDoctorId: '', assignedDoctorName: '', department: '',
  status: 'registered', notes: '',
};

const emptyEmergencyForm = {
  firstName: 'Emergency',
  lastName: 'Patient',
  gender: 'male',
  emergencySeverity: 'critical',
  department: 'Emergency',
  assignedDoctorId: '',
  assignedDoctorName: '',
  diagnosis: '',
  phone: '',
  notes: '',
};

function RegisterPatientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get('mode') || 'standard';
  const completeIdParam = searchParams.get('id') || '';

  const [mode, setMode] = useState<'standard' | 'emergency' | 'complete_pending'>(
    initialMode === 'emergency' ? 'emergency' : initialMode === 'complete' ? 'complete_pending' : 'standard'
  );

  const [form, setForm] = useState({ ...emptyForm });
  const [emergencyForm, setEmergencyForm] = useState({ ...emptyEmergencyForm });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdPatient, setCreatedPatient] = useState<any>(null);
  const [department, setDepartment] = useState('General');
  const [eligibleDoctors, setEligibleDoctors] = useState<any[]>([]);

  // Emergency Pending Patients List
  const [pendingPatients, setPendingPatients] = useState<any[]>([]);
  const [selectedPendingPatient, setSelectedPendingPatient] = useState<any>(null);
  const [completeForm, setCompleteForm] = useState({ ...emptyForm });

  // Form error state management
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch doctors based on selected department
  useEffect(() => {
    const targetDept = mode === 'emergency' ? 'Emergency' : department;
    const url = targetDept ? `/users/doctors?department=${encodeURIComponent(targetDept)}` : '/users/doctors';
    api.get(url)
      .then(res => setEligibleDoctors(res.data || []))
      .catch(() => setEligibleDoctors([]));
  }, [department, mode]);

  // Load pending emergency patients
  const loadPendingEmergency = async () => {
    try {
      const { data } = await api.get('/patients/emergency/pending');
      setPendingPatients(data || []);
      if (completeIdParam) {
        const found = (data || []).find((p: any) => p.id === completeIdParam || p.patientId === completeIdParam);
        if (found) {
          startCompleteRegistration(found);
        }
      }
    } catch {
      setPendingPatients([]);
    }
  };

  useEffect(() => {
    loadPendingEmergency();
  }, [completeIdParam]);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (formErrors[k]) {
      setFormErrors((prev) => ({ ...prev, [k]: '' }));
    }
  };

  const setEmg = (k: string, v: string) => {
    setEmergencyForm((f) => ({ ...f, [k]: v }));
    if (formErrors[k]) {
      setFormErrors((prev) => ({ ...prev, [k]: '' }));
    }
  };

  const setComp = (k: string, v: string) => {
    setCompleteForm((f) => ({ ...f, [k]: v }));
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const validatePhoneFormat = (phoneVal: string): string | null => {
    if (!phoneVal || !phoneVal.trim()) return 'Phone number is required';
    const digits = phoneVal.replace(/\D/g, '');
    const raw10 = digits.length >= 10 ? digits.slice(-10) : digits;
    if (raw10.length !== 10) {
      return 'Must be a valid 10-digit phone number (+91 XXXXXXXXXX)';
    }
    return null;
  };

  const handlePhoneChange = (val: string) => {
    set('phone', val);
    if (phoneError) setPhoneError(null);
    if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
  };

  const handlePhoneBlur = async () => {
    const val = form.phone.trim();
    if (!val) return;

    const formatErr = validatePhoneFormat(val);
    if (formatErr) {
      setPhoneError(formatErr);
      setFormErrors((prev) => ({ ...prev, phone: formatErr }));
      return;
    }

    setCheckingPhone(true);
    try {
      const { data } = await api.get(`/patients/check-phone?phone=${encodeURIComponent(val)}`);
      if (data?.exists) {
        const dupMsg = `⚠️ Phone number already registered: ${data.patientName} (${data.patientId})`;
        setPhoneError(dupMsg);
        setFormErrors((prev) => ({ ...prev, phone: dupMsg }));
      } else {
        setPhoneError(null);
        setFormErrors((prev) => ({ ...prev, phone: '' }));
      }
    } catch {
      // Ignore background check network error
    } finally {
      setCheckingPhone(false);
    }
  };

  // Submit Standard Registration
  const handleSubmitStandard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submitting || createdPatient) return;

    const errors: Record<string, string> = {};

    if (!form.firstName.trim()) errors.firstName = 'First Name is required';
    if (!form.lastName.trim()) errors.lastName = 'Last Name is required';
    if (!form.dateOfBirth) errors.dateOfBirth = 'Date of Birth is required';
    if (!form.gender) errors.gender = 'Gender is required';
    if (!department) errors.department = 'Hospital Department is required';
    if (!form.assignedDoctorId) errors.assignedDoctorId = 'Assigned Doctor is required';

    const pErr = validatePhoneFormat(form.phone);
    if (pErr) {
      errors.phone = pErr;
    } else if (phoneError && phoneError.includes('already registered')) {
      errors.phone = phoneError;
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      if (errors.phone) setPhoneError(errors.phone);
      toast.error(errors.phone || 'Please fix the highlighted form errors before submitting');
      return;
    }

    setSubmitting(true);
    setLoading(true);

    try {
      const checkRes = await api.get(`/patients/check-phone?phone=${encodeURIComponent(form.phone)}`);
      if (checkRes.data?.exists) {
        const dupMsg = `⚠️ Phone number already registered: ${checkRes.data.patientName} (${checkRes.data.patientId})`;
        setPhoneError(dupMsg);
        setFormErrors((prev) => ({ ...prev, phone: dupMsg }));
        toast.error(dupMsg);
        setLoading(false);
        setSubmitting(false);
        return;
      }

      const { data } = await api.post('/patients', {
        ...form,
        department,
      });

      toast.success(`✅ Patient Registered! OPD Token: ${data.opdTokenNumber}`);
      setCreatedPatient(data);
      setFormErrors({});
      setPhoneError(null);
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Registration failed';
      if (err.response?.status === 409 || msg.toLowerCase().includes('phone')) {
        setPhoneError(msg);
        setFormErrors((prev) => ({ ...prev, phone: msg }));
      }
      toast.error(msg);
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  // Submit Emergency Quick Intake
  const handleSubmitEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || submitting) return;

    const errors: Record<string, string> = {};
    if (!emergencyForm.assignedDoctorId) errors.assignedDoctorId = 'Assigned Emergency Doctor is required';
    if (!emergencyForm.diagnosis.trim()) errors.diagnosis = 'Emergency condition / symptoms description is required';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error('Please assign an emergency doctor and state emergency condition');
      return;
    }

    setSubmitting(true);
    setLoading(true);

    try {
      const { data } = await api.post('/patients/emergency', {
        ...emergencyForm,
        department: 'Emergency',
      });

      toast.success(`🚨 EMERGENCY INTAKE SAVED! Emergency OPD Token: ${data.opdTokenNumber}`);
      setCreatedPatient(data);
      setFormErrors({});
      loadPendingEmergency();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Emergency intake registration failed');
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  // Start complete registration for an emergency patient
  const startCompleteRegistration = (patient: any) => {
    setSelectedPendingPatient(patient);
    setCompleteForm({
      firstName: patient.firstName || '',
      lastName: patient.lastName || '',
      dateOfBirth: patient.dateOfBirth || '',
      gender: patient.gender || 'male',
      bloodGroup: patient.bloodGroup || '',
      phone: patient.phone || '',
      email: patient.email || '',
      address: patient.address || '',
      emergencyContact: patient.emergencyContact || '',
      emergencyPhone: patient.emergencyPhone || '',
      insuranceNumber: patient.insuranceNumber || '',
      insuranceProvider: patient.insuranceProvider || '',
      diagnosis: patient.diagnosis || '',
      ward: patient.ward || '',
      bedNumber: patient.bedNumber || '',
      admittedBy: patient.admittedBy || '',
      assignedNurse: patient.assignedNurse || '',
      assignedDoctorId: patient.assignedDoctorId || '',
      assignedDoctorName: patient.assignedDoctorName || '',
      department: patient.department || 'Emergency',
      status: patient.status || 'registered',
      notes: patient.notes || '',
    });
    setMode('complete_pending');
  };

  // Submit Completed Registration for Emergency Patient
  const handleSubmitCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPendingPatient || submitting) return;

    if (!completeForm.firstName.trim() || !completeForm.lastName.trim()) {
      toast.error('Patient First Name and Last Name are required');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.put(`/patients/${selectedPendingPatient.id}/complete-registration`, completeForm);
      toast.success(`✅ Registration Completed for Emergency Patient ${data.patientId}`);
      setSelectedPendingPatient(null);
      setMode('complete_pending');
      loadPendingEmergency();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update patient registration');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintToken = () => {
    if (!createdPatient) return;
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) return toast.error('Please allow popups to print token card');

    const isEmg = createdPatient.isEmergency;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${isEmg ? 'EMERGENCY TOKEN' : 'OPD Token'} - ${createdPatient.opdTokenNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #0f172a; text-align: center; }
            .card { border: 2px dashed ${isEmg ? '#ef4444' : '#0ea5e9'}; border-radius: 16px; padding: 24px; background: ${isEmg ? '#fef2f2' : '#f0f9ff'}; }
            .h-name { font-size: 20px; font-weight: 800; color: ${isEmg ? '#dc2626' : '#0284c7'}; }
            .title { font-size: 12px; text-transform: uppercase; color: #64748b; margin-top: 4px; font-weight: 700; }
            .token-box { background: ${isEmg ? '#dc2626' : '#0284c7'}; color: white; border-radius: 12px; padding: 16px; margin: 20px 0; }
            .token-num { font-size: 32px; font-weight: 900; letter-spacing: 2px; }
            .details { text-align: left; background: white; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-top: 12px; border: 1px solid #e2e8f0; }
            .details div { padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
            @media print { body { padding: 0; } .card { border-style: solid; } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="h-name">🏥 MediCore Hospital</div>
            <div class="title">${isEmg ? '🚨 EMERGENCY INTAKE QUEUE TOKEN' : 'OPD Patient Registration & Queue Token'}</div>
            
            <div class="token-box">
              <div style="font-size: 11px; text-transform: uppercase; opacity: 0.9;">Token Number</div>
              <div class="token-num">${createdPatient.opdTokenNumber}</div>
            </div>

            <div class="details">
              <div><strong>Patient ID:</strong> ${createdPatient.patientId}</div>
              <div><strong>Patient Name:</strong> ${createdPatient.firstName} ${createdPatient.lastName}</div>
              <div><strong>Gender:</strong> ${createdPatient.gender}</div>
              <div><strong>Assigned Doctor:</strong> ${createdPatient.assignedDoctorName || 'Emergency Doctor'}</div>
              <div><strong>Department:</strong> ${createdPatient.department || 'Emergency'}</div>
              <div><strong>Condition:</strong> ${createdPatient.diagnosis || 'Emergency Medical Care'}</div>
              <div><strong>Registration Status:</strong> ${createdPatient.isBasicRegistrationComplete ? 'Completed' : 'Basic (Complete Details Pending)'}</div>
              <div><strong>Issued Date:</strong> ${new Date(createdPatient.createdAt).toLocaleString()}</div>
            </div>

            <div style="font-size: 11px; color: #64748b; margin-top: 20px;">
              ${isEmg ? '🚨 URGENT: Route patient directly to Emergency Triage & Assigned Doctor.' : 'Please present this token at the OPD consultation triage desk.'}
            </div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <DashboardLayout role="receptionist">
      <div className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="topbar-title">Receptionist Patient Registration & Emergency Intake</div>

        {/* Navigation Mode Selector Tabs */}
        <div className="flex gap-2" style={{ background: 'var(--bg-surface)', padding: 4, borderRadius: 10, border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'standard' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setMode('standard'); setCreatedPatient(null); setFormErrors({}); }}
          >
            📋 Patient Registration
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'emergency' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ backgroundColor: mode === 'emergency' ? '#ef4444' : undefined, borderColor: mode === 'emergency' ? '#dc2626' : undefined }}
            onClick={() => { setMode('emergency'); setCreatedPatient(null); setFormErrors({}); }}
          >
            🚨 Emergency Intake (Quick)
          </button>
          <button
            type="button"
            className={`btn btn-sm ${mode === 'complete_pending' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setMode('complete_pending'); setSelectedPendingPatient(null); loadPendingEmergency(); }}
          >
            ⏳ Pending Emergency ({pendingPatients.length})
          </button>
        </div>
      </div>

      <div className="page-content">
        {/* SUCCESS TOKEN SCREEN */}
        {createdPatient ? (
          <div className="card" style={{ maxWidth: 600, margin: '20px auto', textAlign: 'center', padding: 24, border: createdPatient.isEmergency ? '2px solid #ef4444' : '2px solid var(--primary-light)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{createdPatient.isEmergency ? '🚨' : '🎟️'}</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: createdPatient.isEmergency ? '#ef4444' : 'var(--primary-light)' }}>
              {createdPatient.isEmergency ? 'Emergency Patient Admitted & Token Issued!' : 'Patient Registration Successful!'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
              {createdPatient.isEmergency
                ? 'Basic details recorded. Immediate notification sent to Assigned Doctor & Management.'
                : 'PostgreSQL record created & automatic OPD token generated.'}
            </p>

            <div style={{ background: createdPatient.isEmergency ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: 'white', padding: 20, borderRadius: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>
                {createdPatient.isEmergency ? 'EMERGENCY TRIAGE TOKEN' : 'AUTOMATIC OPD QUEUE TOKEN'}
              </div>
              <div style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{createdPatient.opdTokenNumber}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 10, textAlign: 'left', fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div><strong>Patient ID:</strong> {createdPatient.patientId}</div>
              <div><strong>Full Name:</strong> {createdPatient.firstName} {createdPatient.lastName}</div>
              <div><strong>Assigned Doctor:</strong> {createdPatient.assignedDoctorName || 'Emergency Doctor'}</div>
              <div><strong>Department:</strong> {createdPatient.department || 'Emergency'}</div>
              <div><strong>Condition:</strong> {createdPatient.diagnosis || 'Emergency Medical Care'}</div>
              <div><strong>Complete Registration:</strong> {createdPatient.isBasicRegistrationComplete ? 'Completed' : 'Pending (Fill later)'}</div>
            </div>

            <div className="flex gap-3 justify-center">
              <button className="btn btn-primary" onClick={handlePrintToken}>🖨️ Print Token Slip</button>
              {createdPatient.isEmergency && !createdPatient.isBasicRegistrationComplete && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    startCompleteRegistration(createdPatient);
                    setCreatedPatient(null);
                  }}
                >
                  📝 Fill Complete Details Now
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => { setCreatedPatient(null); setForm({ ...emptyForm }); setEmergencyForm({ ...emptyEmergencyForm }); setPhoneError(null); setFormErrors({}); }}>
                + Register Another
              </button>
              <button className="btn btn-secondary" onClick={() => router.push('/dashboard/receptionist')}>
                Go to Receptionist Dashboard
              </button>
            </div>
          </div>
        ) : mode === 'emergency' ? (
          /* EMERGENCY QUICK INTAKE FORM */
          <form onSubmit={handleSubmitEmergency} noValidate>
            <div className="card" style={{ borderLeft: '4px solid #ef4444', marginBottom: 20 }}>
              <div className="card-header" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                <span className="card-title" style={{ color: '#ef4444' }}>🚨 Fast Emergency Patient Intake (Basic Details)</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Fill quick details now, complete full profile later when patient is stabilized</span>
              </div>
              <div className="card-body">
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Patient First Name</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Unknown / John"
                      value={emergencyForm.firstName}
                      onChange={e => setEmg('firstName', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Patient Last Name</label>
                    <input
                      className="form-control"
                      placeholder="e.g. Male-01 / Doe"
                      value={emergencyForm.lastName}
                      onChange={e => setEmg('lastName', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select
                      className="form-control"
                      value={emergencyForm.gender}
                      onChange={e => setEmg('gender', e.target.value)}
                    >
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Emergency Severity Level *</label>
                    <select
                      className="form-control"
                      value={emergencyForm.emergencySeverity}
                      onChange={e => setEmg('emergencySeverity', e.target.value)}
                      style={{ fontWeight: 600 }}
                    >
                      {SEVERITIES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assigned Emergency Doctor * ({eligibleDoctors.length} available)</label>
                    <select
                      className="form-control"
                      style={{ borderColor: formErrors.assignedDoctorId ? '#ef4444' : undefined }}
                      value={emergencyForm.assignedDoctorId}
                      onChange={e => {
                        const docId = e.target.value;
                        const doc = eligibleDoctors.find(d => d.id === docId);
                        setEmergencyForm(f => ({
                          ...f,
                          assignedDoctorId: docId,
                          assignedDoctorName: doc ? `Dr. ${doc.firstName} ${doc.lastName}` : '',
                        }));
                      }}
                      required
                    >
                      <option value="">Select Emergency Doctor</option>
                      {eligibleDoctors.map(d => (
                        <option key={d.id} value={d.id}>
                          Dr. {d.firstName} {d.lastName} ({d.department})
                        </option>
                      ))}
                    </select>
                    {formErrors.assignedDoctorId && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                        {formErrors.assignedDoctorId}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Patient / Attendant Contact Phone (Optional)</label>
                    <input
                      className="form-control"
                      placeholder="+91 9876543210"
                      value={emergencyForm.phone}
                      onChange={e => setEmg('phone', e.target.value)}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 3' }}>
                    <label className="form-label">Emergency Condition / Diagnosis / Symptoms *</label>
                    <input
                      className="form-control"
                      style={{ borderColor: formErrors.diagnosis ? '#ef4444' : undefined }}
                      placeholder="e.g. Acute Cardiac Arrest, Severe Road Trauma, Unconscious..."
                      value={emergencyForm.diagnosis}
                      onChange={e => setEmg('diagnosis', e.target.value)}
                      required
                    />
                    {formErrors.diagnosis && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                        {formErrors.diagnosis}
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 3' }}>
                    <label className="form-label">Additional Triage Notes</label>
                    <textarea
                      className="form-control"
                      placeholder="Any initial notes from paramedic or ambulance staff..."
                      value={emergencyForm.notes}
                      onChange={e => setEmg('notes', e.target.value)}
                      rows={2}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || submitting}
                style={{ background: '#ef4444', borderColor: '#dc2626', minWidth: 260 }}
              >
                {loading || submitting ? '⏳ Saving Emergency Intake...' : '🚨 Register Emergency Intake & Notify Doctor'}
              </button>
            </div>
          </form>
        ) : mode === 'complete_pending' ? (
          /* PENDING EMERGENCY LIST OR COMPLETE FORM */
          selectedPendingPatient ? (
            /* COMPLETE REGISTRATION FORM FOR SELECTED EMERGENCY PATIENT */
            <form onSubmit={handleSubmitCompleteRegistration} noValidate>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="card-title">📝 Fill Complete Registration — Patient {selectedPendingPatient.patientId}</span>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedPendingPatient(null)}>
                    ← Back to Pending List
                  </button>
                </div>
                <div className="card-body">
                  <div className="form-grid form-grid-3">
                    <div className="form-group">
                      <label className="form-label">First Name *</label>
                      <input
                        className="form-control"
                        value={completeForm.firstName}
                        onChange={e => setComp('firstName', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Last Name *</label>
                      <input
                        className="form-control"
                        value={completeForm.lastName}
                        onChange={e => setComp('lastName', e.target.value)}
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Date of Birth</label>
                      <input
                        type="date"
                        className="form-control"
                        value={completeForm.dateOfBirth}
                        max={todayStr}
                        onChange={e => setComp('dateOfBirth', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Gender</label>
                      <select
                        className="form-control"
                        value={completeForm.gender}
                        onChange={e => setComp('gender', e.target.value)}
                      >
                        {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Blood Group</label>
                      <select
                        className="form-control"
                        value={completeForm.bloodGroup}
                        onChange={e => setComp('bloodGroup', e.target.value)}
                      >
                        <option value="">Select Blood Group</option>
                        {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Mobile Phone (+91)</label>
                      <input
                        className="form-control"
                        placeholder="+91 9876543210"
                        value={completeForm.phone}
                        onChange={e => setComp('phone', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input
                        type="email"
                        className="form-control"
                        placeholder="patient@email.com"
                        value={completeForm.email}
                        onChange={e => setComp('email', e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                      <label className="form-label">Permanent Address</label>
                      <input
                        className="form-control"
                        placeholder="Street address, City, Zip"
                        value={completeForm.address}
                        onChange={e => setComp('address', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Emergency Contact Name</label>
                      <input
                        className="form-control"
                        placeholder="Guardian / Relative name"
                        value={completeForm.emergencyContact}
                        onChange={e => setComp('emergencyContact', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Emergency Contact Phone</label>
                      <input
                        className="form-control"
                        placeholder="+91 9876543210"
                        value={completeForm.emergencyPhone}
                        onChange={e => setComp('emergencyPhone', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Insurance Provider</label>
                      <input
                        className="form-control"
                        placeholder="BlueCross / Care Health"
                        value={completeForm.insuranceProvider}
                        onChange={e => setComp('insuranceProvider', e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Insurance Policy Number</label>
                      <input
                        className="form-control"
                        placeholder="INS-000000"
                        value={completeForm.insuranceNumber}
                        onChange={e => setComp('insuranceNumber', e.target.value)}
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: 'span 3' }}>
                      <label className="form-label">Diagnosis / Treatment Notes</label>
                      <textarea
                        className="form-control"
                        value={completeForm.diagnosis}
                        onChange={e => setComp('diagnosis', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedPendingPatient(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting} style={{ minWidth: 220 }}>
                  {submitting ? '⏳ Saving Complete Details...' : '✅ Save & Mark Registration Complete'}
                </button>
              </div>
            </form>
          ) : (
            /* LIST OF PENDING EMERGENCY PATIENTS */
            <div className="card">
              <div className="card-header">
                <span className="card-title">⏳ Emergency Patients Awaiting Complete Registration ({pendingPatients.length})</span>
                <button className="btn btn-secondary btn-sm" onClick={loadPendingEmergency}>🔄 Refresh List</button>
              </div>
              <div className="table-container">
                {pendingPatients.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <h3>No pending emergency registrations</h3>
                    <p>All emergency patient registrations are currently complete.</p>
                  </div>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Emergency Token</th>
                        <th>Patient ID</th>
                        <th>Patient Name</th>
                        <th>Severity</th>
                        <th>Emergency Condition</th>
                        <th>Assigned Doctor</th>
                        <th>Admitted Date</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingPatients.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <span style={{ fontWeight: 800, color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '4px 10px', borderRadius: 6 }}>
                              {p.opdTokenNumber || 'EMG-TK'}
                            </span>
                          </td>
                          <td><strong>{p.patientId}</strong></td>
                          <td>{p.firstName} {p.lastName}</td>
                          <td>
                            <span className={`badge ${p.emergencySeverity === 'critical' ? 'badge-danger' : 'badge-warning'}`}>
                              {p.emergencySeverity || 'critical'}
                            </span>
                          </td>
                          <td>{p.diagnosis || 'Emergency'}</td>
                          <td>Dr. {p.assignedDoctorName || 'Emergency Doctor'}</td>
                          <td>{new Date(p.createdAt).toLocaleDateString()} {new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => startCompleteRegistration(p)}
                            >
                              📝 Complete Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )
        ) : (
          /* STANDARD FULL REGISTRATION FORM */
          <form onSubmit={handleSubmitStandard} noValidate>
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">👤 Personal Information</span></div>
              <div className="card-body">
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input
                      className="form-control"
                      style={{ borderColor: formErrors.firstName ? '#ef4444' : undefined }}
                      placeholder="John"
                      value={form.firstName}
                      onChange={e => set('firstName', e.target.value)}
                      required
                    />
                    {formErrors.firstName && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                        {formErrors.firstName}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input
                      className="form-control"
                      style={{ borderColor: formErrors.lastName ? '#ef4444' : undefined }}
                      placeholder="Doe"
                      value={form.lastName}
                      onChange={e => set('lastName', e.target.value)}
                      required
                    />
                    {formErrors.lastName && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                        {formErrors.lastName}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Date of Birth *</label>
                    <input
                      type="date"
                      className="form-control"
                      style={{ borderColor: formErrors.dateOfBirth ? '#ef4444' : undefined }}
                      value={form.dateOfBirth}
                      max={todayStr}
                      onChange={e => set('dateOfBirth', e.target.value)}
                      required
                    />
                    {formErrors.dateOfBirth && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                        {formErrors.dateOfBirth}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select
                      className="form-control"
                      style={{ borderColor: formErrors.gender ? '#ef4444' : undefined }}
                      value={form.gender}
                      onChange={e => set('gender', e.target.value)}
                      required
                    >
                      <option value="">Select Gender</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    {formErrors.gender && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                        {formErrors.gender}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select className="form-control" value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Phone * {checkingPhone && <span style={{ fontSize: '11px', color: '#0ea5e9', fontWeight: 'bold' }}>(Checking backend...)</span>}
                    </label>
                    <input
                      className="form-control"
                      style={{
                        borderColor: (phoneError || formErrors.phone) ? '#ef4444' : undefined,
                        backgroundColor: (phoneError || formErrors.phone) ? '#fef2f2' : undefined,
                      }}
                      placeholder="+91 9876543210"
                      value={form.phone}
                      onChange={e => handlePhoneChange(e.target.value)}
                      onBlur={handlePhoneBlur}
                      required
                    />
                    {(phoneError || formErrors.phone) && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 600 }}>
                        {phoneError || formErrors.phone}
                      </div>
                    )}
                    {!phoneError && !formErrors.phone && (
                      <div style={{ color: '#64748b', fontSize: '11px', marginTop: '4px' }}>
                        Accepts +91 format (e.g. +91 9876543210)
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input type="email" className="form-control" placeholder="patient@email.com" value={form.email} onChange={e => set('email', e.target.value)} />
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 2' }}>
                    <label className="form-label">Address</label>
                    <input className="form-control" placeholder="Street address" value={form.address} onChange={e => set('address', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Emergency Contact */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">🚨 Emergency Contact</span></div>
              <div className="card-body">
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Contact Name</label>
                    <input className="form-control" placeholder="Guardian name" value={form.emergencyContact} onChange={e => set('emergencyContact', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Contact Phone</label>
                    <input className="form-control" placeholder="+91 9876543210" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Insurance */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">🏦 Insurance Information</span></div>
              <div className="card-body">
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Insurance Provider</label>
                    <input className="form-control" placeholder="BlueCross" value={form.insuranceProvider} onChange={e => set('insuranceProvider', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Insurance Number</label>
                    <input className="form-control" placeholder="INS-000000" value={form.insuranceNumber} onChange={e => set('insuranceNumber', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* Admission */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">🛏️ Hospital Department & Attending Doctor Assignment</span></div>
              <div className="card-body">
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Hospital Department *</label>
                    <select
                      className="form-control"
                      style={{ borderColor: formErrors.department ? '#ef4444' : undefined }}
                      value={department}
                      onChange={e => {
                        setDepartment(e.target.value);
                        set('department', e.target.value);
                      }}
                      required
                    >
                      <option value="">Select Department</option>
                      {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {formErrors.department && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                        {formErrors.department}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label">Assigned Doctor * ({eligibleDoctors.length} available)</label>
                    <select
                      className="form-control"
                      style={{ borderColor: formErrors.assignedDoctorId ? '#ef4444' : undefined }}
                      value={form.assignedDoctorId}
                      onChange={e => {
                        const docId = e.target.value;
                        const doc = eligibleDoctors.find(d => d.id === docId);
                        setForm(f => ({
                          ...f,
                          assignedDoctorId: docId,
                          assignedDoctorName: doc ? `Dr. ${doc.firstName} ${doc.lastName}` : '',
                          admittedBy: doc ? `Dr. ${doc.firstName} ${doc.lastName}` : f.admittedBy,
                        }));
                        if (formErrors.assignedDoctorId) setFormErrors(prev => ({ ...prev, assignedDoctorId: '' }));
                      }}
                      required
                    >
                      <option value="">Select Eligible Doctor</option>
                      {eligibleDoctors.map(d => (
                        <option key={d.id} value={d.id}>
                          Dr. {d.firstName} {d.lastName} ({d.department})
                        </option>
                      ))}
                    </select>
                    {formErrors.assignedDoctorId && (
                      <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', fontWeight: 500 }}>
                        {formErrors.assignedDoctorId}
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ gridColumn: 'span 3' }}>
                    <label className="form-label">Diagnosis</label>
                    <input className="form-control" placeholder="Initial diagnosis" value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ gridColumn: 'span 3' }}>
                    <label className="form-label">Additional Notes</label>
                    <textarea className="form-control" placeholder="Any additional notes..." value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || submitting || checkingPhone || !!phoneError}
                style={{
                  minWidth: 220,
                  opacity: loading || submitting || checkingPhone || !!phoneError ? 0.6 : 1,
                  cursor: loading || submitting || checkingPhone || !!phoneError ? 'not-allowed' : 'pointer',
                }}
              >
                {loading || submitting ? '⏳ Registering & Saving...' : '🎟️ Register & Generate OPD Token'}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function RegisterPatient() {
  return (
    <Suspense fallback={<div className="p-4">Loading patient registration form...</div>}>
      <RegisterPatientContent />
    </Suspense>
  );
}
