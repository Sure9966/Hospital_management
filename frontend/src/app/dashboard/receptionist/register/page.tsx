'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['male', 'female', 'other'];

const emptyForm = {
  firstName: '', lastName: '', dateOfBirth: '', gender: '',
  bloodGroup: '', phone: '', email: '', address: '',
  emergencyContact: '', emergencyPhone: '',
  insuranceNumber: '', insuranceProvider: '',
  diagnosis: '', ward: '', bedNumber: '', admittedBy: '', assignedNurse: '',
  status: 'registered', notes: '',
};

export default function RegisterPatient() {
  const router = useRouter();
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [createdPatient, setCreatedPatient] = useState<any>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/patients', form);
      toast.success(`✅ Patient Registered! OPD Token: ${data.opdTokenNumber}`);
      setCreatedPatient(data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
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
          <form onSubmit={handleSubmit}>
            {/* Personal Info */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="card-header"><span className="card-title">👤 Personal Information</span></div>
              <div className="card-body">
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className="form-control" placeholder="John" value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className="form-control" placeholder="Doe" value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth *</label>
                    <input type="date" className="form-control" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender *</label>
                    <select className="form-control" value={form.gender} onChange={e => set('gender', e.target.value)} required>
                      <option value="">Select Gender</option>
                      {GENDERS.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select className="form-control" value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                      <option value="">Select Blood Group</option>
                      {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input className="form-control" placeholder="+1 (555) 000-0000" value={form.phone} onChange={e => set('phone', e.target.value)} required />
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
                    <input className="form-control" placeholder="+1 (555) 000-0000" value={form.emergencyPhone} onChange={e => set('emergencyPhone', e.target.value)} />
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
              <div className="card-header"><span className="card-title">🛏️ Admission Details</span></div>
              <div className="card-body">
                <div className="form-grid form-grid-3">
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-control" value={form.status} onChange={e => set('status', e.target.value)}>
                      <option value="registered">Registered</option>
                      <option value="admitted">Admitted</option>
                      <option value="under_treatment">Under Treatment</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Ward</label>
                    <input className="form-control" placeholder="General Ward" value={form.ward} onChange={e => set('ward', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Bed Number</label>
                    <input className="form-control" placeholder="B-101" value={form.bedNumber} onChange={e => set('bedNumber', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Admitted by Doctor</label>
                    <input className="form-control" placeholder="Dr. Smith" value={form.admittedBy} onChange={e => set('admittedBy', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assigned Nurse</label>
                    <input className="form-control" placeholder="Nurse Johnson" value={form.assignedNurse} onChange={e => set('assignedNurse', e.target.value)} />
                  </div>
                  <div className="form-group">
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
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ minWidth: 220 }}>
                {loading ? '⏳ Registering...' : '🎟️ Register & Generate OPD Token'}
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
              <button className="btn btn-secondary" onClick={() => { setCreatedPatient(null); setForm({ ...emptyForm }); }}>+ Register Another</button>
              <button className="btn btn-secondary" onClick={() => router.push('/dashboard/receptionist')}>Go to Dashboard</button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
