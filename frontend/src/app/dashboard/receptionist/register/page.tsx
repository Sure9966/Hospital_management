'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['male', 'female', 'other'];
const DEPARTMENTS = ['Cardiology', 'Neurology', 'Orthopedics', 'Pediatrics', 'General', 'Emergency', 'Surgery', 'Oncology'];

const emptyForm = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '',
  bloodGroup: '', phone: '', email: '', address: '',
  emergencyContact: '', emergencyPhone: '',
  insuranceNumber: '', insuranceProvider: '',
  diagnosis: '', ward: '', bedNumber: '', admittedBy: '', assignedNurse: '',
  assignedDoctorId: '', assignedDoctorName: '', department: '',
  status: 'registered', notes: '',
};

export default function RegisterPatient() {
  const router = useRouter();
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createdPatient, setCreatedPatient] = useState<any>(null);
  const [department, setDepartment] = useState('');
  const [eligibleDoctors, setEligibleDoctors] = useState<any[]>([]);

  // Form error state management
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const url = department ? `/users/doctors?department=${encodeURIComponent(department)}` : '/users/doctors';
    api.get(url)
      .then(res => setEligibleDoctors(res.data || []))
      .catch(() => setEligibleDoctors([]));
  }, [department]);

  const set = (k: string, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (formErrors[k]) {
      setFormErrors((prev) => ({ ...prev, [k]: '' }));
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Validate Indian phone number (+91 format & 10 digits starting with 6-9)
  const validatePhoneFormat = (phoneVal: string): string | null => {
    if (!phoneVal || !phoneVal.trim()) return 'Phone number is required';
    const digits = phoneVal.replace(/\D/g, '');
    const raw10 = digits.length >= 10 ? digits.slice(-10) : digits;
    if (raw10.length !== 10) {
      return 'Must be a valid 10-digit phone number (+91 XXXXXXXXXX)';
    }
    // if (!/^[6-9]\d{9}$/.test(raw10)) {
    //   return 'Indian mobile numbers must start with 6, 7, 8, or 9';
    // }
    return null;
  };

  // Format phone input on change/blur to +91 format if 10 digits entered
  const handlePhoneChange = (val: string) => {
    set('phone', val);
    if (phoneError) setPhoneError(null);
    if (formErrors.phone) setFormErrors((prev) => ({ ...prev, phone: '' }));
  };

  // Check backend for duplicate phone number
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      // Final duplicate phone check with backend before posting
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

  const handlePrintToken = () => {
    const printWindow = window.open('', '_blank', 'width=450,height=600');
    if (!printWindow) return toast.error('Please allow popups to print token card');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>OPD Token - ${createdPatient.opdTokenNumber}</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; color: #0f172a; text-align: center; }
            .card { border: 2px dashed #0ea5e9; border-radius: 16px; padding: 24px; background: #f0f9ff; }
            .h-name { font-size: 20px; font-weight: 800; color: #0284c7; }
            .title { font-size: 12px; text-transform: uppercase; color: #64748b; margin-top: 4px; font-weight: 700; }
            .token-box { background: #0284c7; color: white; border-radius: 12px; padding: 16px; margin: 20px 0; }
            .token-num { font-size: 32px; font-weight: 900; letter-spacing: 2px; }
            .details { text-align: left; background: white; padding: 12px 16px; border-radius: 8px; font-size: 13px; margin-top: 12px; border: 1px solid #e2e8f0; }
            .details div { padding: 4px 0; border-bottom: 1px solid #f1f5f9; }
            @media print { body { padding: 0; } .card { border-style: solid; } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="h-name">🏥 MediCore Hospital</div>
            <div class="title">OPD Patient Registration & Queue Token</div>
            
            <div class="token-box">
              <div style="font-size: 11px; text-transform: uppercase; opacity: 0.9;">OPD Token Number</div>
              <div class="token-num">${createdPatient.opdTokenNumber}</div>
            </div>

            <div class="details">
              <div><strong>Patient ID:</strong> ${createdPatient.patientId}</div>
              <div><strong>Patient Name:</strong> ${createdPatient.firstName} ${createdPatient.lastName}</div>
              <div><strong>Gender / Age:</strong> ${createdPatient.gender} (${createdPatient.dateOfBirth})</div>
              <div><strong>Phone:</strong> ${createdPatient.phone}</div>
              <div><strong>Blood Group:</strong> ${createdPatient.bloodGroup || 'N/A'}</div>
              <div><strong>Issued Date:</strong> ${new Date(createdPatient.createdAt).toLocaleString()}</div>
            </div>

            <div style="font-size: 11px; color: #64748b; margin-top: 20px;">
              Please present this token at the OPD consultation triage desk.
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
      <div className="topbar">
        <div className="topbar-title">Register New Patient & Generate OPD Token</div>
      </div>
      <div className="page-content">
        {!createdPatient ? (
          <form onSubmit={handleSubmit} noValidate>
            {/* Personal Info */}
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

            {/* Insurance & Admission */}
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
        ) : (
          /* Token Ticket Modal / Card */
          <div className="card" style={{ maxWidth: 560, margin: '20px auto', textAlign: 'center', padding: 24, border: '2px solid var(--primary-light)' }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎟️</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-light)' }}>Patient Registration Successful!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>PostgreSQL record created & automatic OPD token generated.</p>

            <div style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)', color: 'white', padding: 20, borderRadius: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.9 }}>AUTOMATIC OPD QUEUE TOKEN</div>
              <div style={{ fontSize: 36, fontWeight: 900, marginTop: 4 }}>{createdPatient.opdTokenNumber}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 10, textAlign: 'left', fontSize: 13, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              <div><strong>Patient ID:</strong> {createdPatient.patientId}</div>
              <div><strong>Full Name:</strong> {createdPatient.firstName} {createdPatient.lastName}</div>
              <div><strong>Phone:</strong> {createdPatient.phone}</div>
              <div><strong>Gender:</strong> {createdPatient.gender}</div>
              <div><strong>Blood Group:</strong> {createdPatient.bloodGroup || 'N/A'}</div>
              <div><strong>Status:</strong> <span className="badge badge-success">{createdPatient.status}</span></div>
            </div>

            <div className="flex gap-3 justify-center">
              <button className="btn btn-primary" onClick={handlePrintToken}>🖨️ Print OPD Token Slip</button>
              <button className="btn btn-secondary" onClick={() => { setCreatedPatient(null); setForm({ ...emptyForm }); setPhoneError(null); setFormErrors({}); }}>+ Register Another</button>
              <button className="btn btn-secondary" onClick={() => router.push('/dashboard/receptionist')}>Go to Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
