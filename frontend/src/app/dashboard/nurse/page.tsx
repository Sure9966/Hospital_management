'use client';
import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';

const emptyForm = {
  patientId: '', patientName: '', temperature: '', bloodPressure: '',
  heartRate: '', oxygenSaturation: '', respiratoryRate: '', weight: '',
  height: '', bloodSugar: '', pain: '0', notes: '', triageNotes: '', triagePriority: 'Routine', status: 'normal',
};

export default function NurseDashboard() {
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get('tab');

    if (
      tab === 'vitals' ||
      tab === 'triage' ||
      tab === 'history' ||
      tab === 'reports' ||
      tab === 'discharges'
    ) {
      setActiveTab(tab);
    } else {
      setActiveTab('vitals');
    }
  }, [searchParams]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState<any>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [activeTab, setActiveTab] = useState<'vitals' | 'triage' | 'history' | 'reports' | 'discharges'>('vitals');
  const [searchQuery, setSearchQuery] = useState('');
  const [dischargeSummaries, setDischargeSummaries] = useState<any[]>([]);
  const [labTests, setLabTests] = useState<any[]>([]);

  const load = () => api.get('/nurse/vitals').then(r => setVitals(r.data));
  const loadDischarges = () => api.get('/nurse/discharges').then(r => setDischargeSummaries(r.data));
  const loadLabTests = () => api.get('/lab').then(r => setLabTests(r.data)).catch(() => []);

  useEffect(() => {
    load();
    loadDischarges();
    loadLabTests();
    api.get('/management/dashboard').then(r => setStats(r.data));
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const autoStatus = (f: typeof emptyForm) => {
    const hr = parseInt(f.heartRate);
    const spo2 = parseInt(f.oxygenSaturation);
    const temp = parseFloat(f.temperature);
    if ((hr && (hr < 40 || hr > 140)) || (spo2 && spo2 < 90) || (temp && (temp < 35 || temp > 40))) return 'critical';
    if ((hr && (hr < 60 || hr > 100)) || (spo2 && spo2 < 95) || (temp && (temp < 36 || temp > 38.5))) return 'warning';
    return 'normal';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const status = autoStatus(form);
    try {
      await api.post('/nurse/vitals', { ...form, status });
      toast.success(status === 'critical' ? '🚨 Critical vitals reported! Alert sent!' : status === 'warning' ? '⚠️ Warning vitals recorded!' : '✅ Vitals & Triage recorded!');
      setShowModal(false); setForm({ ...emptyForm }); load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Error recording vitals'); }
    finally { setLoading(false); }
  };

  const handleOpenPatientHistory = async (patientIdentifier: string) => {
    setLoadingHistory(true);
    setShowHistoryModal(true);
    try {
      const { data } = await api.get(`/nurse/patient/${patientIdentifier}/history`);
      setSelectedPatientHistory(data);
    } catch {
      toast.error('Could not load patient medical history');
      setShowHistoryModal(false);
    } finally {
      setLoadingHistory(false);
    }
  };

  const statusBadge = (s: string) => {
    const m: Record<string, string> = { normal: 'badge-success', warning: 'badge-warning', critical: 'badge-danger' };
    return `badge ${m[s] || 'badge-gray'}`;
  };

  const priorityBadge = (p: string) => {
    const m: Record<string, string> = { Emergency: 'badge-danger', Urgent: 'badge-warning', High: 'badge-purple', Routine: 'badge-info' };
    return `badge ${m[p] || 'badge-gray'}`;
  };

  const downloadDischargePdf = async (dischargeId: string, patientId: string) => {
    try {
      toast.loading('Downloading discharge PDF...', { id: 'discharge-pdf-download' });
      const response = await api.get(`/nurse/discharges/${dischargeId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${patientId}_discharge.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('✅ Discharge PDF downloaded successfully', { id: 'discharge-pdf-download' });
    } catch (error) {
      toast.error('Failed to download discharge PDF', { id: 'discharge-pdf-download' });
    }
  };

  const filteredVitals = vitals.filter(v =>
    v.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.patientId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (v.triagePriority && v.triagePriority.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDischarges = dischargeSummaries.filter(d =>
    (d.patientName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.patientId || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.diagnosis || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout role="nurse">
      <div className="topbar">
        <div className="topbar-title">💗 Nurse Clinical Dashboard</div>
        <button className="btn btn-primary" onClick={() => { setForm({ ...emptyForm }); setShowModal(true); }}>
          💗 Record Vitals & Triage Note
        </button>
      </div>

      <div className="page-content">
        {/* Navigation Phone/Tablet Responsive Tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
          {[
            { id: 'vitals', label: '💗 Vitals Overview', icon: '🩺' },
            { id: 'triage', label: '📝 Triage & Priority Notes', icon: '🚨' },
            { id: 'history', label: '🏥 Patient Medical History', icon: '📂' },
            { id: 'reports', label: '🧪 Test Reports Overview', icon: '🔬' },
            { id: 'discharges', label: '📋 Discharge Summaries', icon: '📄' },
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

        {/* Top Operational Stats */}
        <div className="stats-grid">
          {[
            { icon: '🏥', label: 'Total Patients', value: stats.totalPatients ?? 0, color: '#6366f1', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
            { icon: '🛏️', label: 'Admitted', value: stats.admittedPatients ?? 0, color: '#0ea5e9', gradient: 'linear-gradient(135deg,#0ea5e9,#38bdf8)' },
            { icon: '🚨', label: 'Critical Vitals', value: stats.criticalVitals ?? 0, color: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#f87171)' },
            { icon: '💗', label: 'Recorded Today', value: vitals.filter(v => new Date(v.createdAt).toDateString() === new Date().toDateString()).length, color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--gradient': s.gradient } as any}>
              <div className="stat-icon" style={{ background: `${s.color}22`, color: s.color }}>{s.icon}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* TAB 1: Vitals Overview */}
        {activeTab === 'vitals' && (
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">🩺 Recent Patient Vitals Records ({filteredVitals.length})</span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="🔍 Search patient name or ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 240 }}
              />
            </div>
            <div className="table-container">
              {filteredVitals.length === 0 ? (
                <div className="empty-state"><div className="empty-icon">💗</div><h3>No vitals records found</h3></div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Patient Name / ID</th>
                      <th>Temp (°C)</th>
                      <th>BP (mmHg)</th>
                      <th>Heart Rate</th>
                      <th>SpO2</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Recorded Time</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVitals.map(v => (
                      <tr key={v.id}>
                        <td>
                          <strong>{v.patientName}</strong>
                          <br /><span className="text-muted text-xs">{v.patientId}</span>
                        </td>
                        <td>{v.temperature ? `${v.temperature}°C` : '—'}</td>
                        <td>{v.bloodPressure || '—'}</td>
                        <td>{v.heartRate ? `${v.heartRate} bpm` : '—'}</td>
                        <td>{v.oxygenSaturation ? `${v.oxygenSaturation}%` : '—'}</td>
                        <td><span className={priorityBadge(v.triagePriority || 'Routine')}>{v.triagePriority || 'Routine'}</span></td>
                        <td><span className={statusBadge(v.status)}>{v.status}</span></td>
                        <td>{new Date(v.createdAt).toLocaleString()}</td>
                        <td>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleOpenPatientHistory(v.patientId)}>
                            📂 Medical History
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

        {/* TAB 2: Triage & Priority Notes */}
        {activeTab === 'triage' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">📝 Triage Observations & Priority Assessment Log</span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {vitals.map(v => (
                  <div key={v.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                      <strong>{v.patientName} ({v.patientId})</strong>
                      <span className={priorityBadge(v.triagePriority || 'Routine')}>{v.triagePriority || 'Routine'}</span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
                      <strong>Triage Observation:</strong> {v.triageNotes || v.notes || 'No triage note attached during initial intake.'}
                    </div>
                    <div style={{ fontSize: 12, display: 'flex', gap: 12, color: 'var(--text-muted)' }}>
                      <span>Temp: {v.temperature || 'N/A'}°C</span>
                      <span>BP: {v.bloodPressure || 'N/A'}</span>
                      <span>Pain: {v.pain || '0'}/10</span>
                    </div>
                    <div className="mt-3 flex justify-between items-center" style={{ fontSize: 11, color: 'var(--text-muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                      <span>Status: <span className={statusBadge(v.status)}>{v.status}</span></span>
                      <span>{new Date(v.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Patient Medical History Section */}
        {activeTab === 'history' && (
          <div className="card">
            <div className="card-header">
              <span className="card-title">🏥 Patient Medical History Quick Lookup</span>
            </div>
            <div className="card-body">
              <div className="flex gap-3" style={{ marginBottom: 20 }}>
                <input
                  className="form-control"
                  placeholder="Enter Patient ID (e.g. NMH26000000)..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ maxWidth: 360 }}
                />
                <button className="btn btn-primary" onClick={() => searchQuery && handleOpenPatientHistory(searchQuery)}>
                  🔍 Search History
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                {vitals.map(v => (
                  <div key={v.id} style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{v.patientName}</div>
                    <div style={{ fontSize: 12, color: '#0ea5e9', marginBottom: 10 }}>ID: {v.patientId}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                      Latest Vitals Check: {new Date(v.createdAt).toLocaleDateString()}
                    </div>
                    <button className="btn btn-secondary btn-sm w-full" onClick={() => handleOpenPatientHistory(v.patientId)}>
                      📂 Open Full Medical Profile
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Test Reports Overview */}
        {activeTab === 'reports' && (
          <div className="card">
            <div className="card-header flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">🧪 Live Patient Lab & Radiology Diagnostic Reports ({labTests.length})</span>
              <button className="btn btn-secondary btn-sm" onClick={loadLabTests}>🔄 Refresh Reports</button>
            </div>
            <div className="table-container">
              {labTests.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🧪</div>
                  <h3>No lab test orders found</h3>
                  <p>Laboratory and diagnostic orders requested by doctors will be listed here with live sample and report status tracking.</p>
                </div>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Patient Name & ID</th>
                      <th>Test Title & Category</th>
                      <th>Sample Type</th>
                      <th>Priority</th>
                      <th>Live Lab Status</th>
                      <th>Lab Findings & Summary</th>
                      <th>Order Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {labTests.map(t => {
                      const isDischarged = t.patientStatus === 'discharged';
                      return (
                        <tr key={t.id} style={{ backgroundColor: isDischarged ? 'rgba(239, 68, 68, 0.03)' : 'transparent' }}>
                          <td>
                            <strong>{t.patientName}</strong>
                            <br /><span className="text-muted text-xs">{t.patientId}</span>
                            {isDischarged && (
                              <div>
                                <span className="badge badge-danger" style={{ fontSize: 9, marginTop: 2 }}>DISCHARGED</span>
                              </div>
                            )}
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
                          <td style={{ maxWidth: 280 }}>
                            {t.resultSummary ? (
                              <div>
                                <div style={{ fontSize: 12, color: 'var(--text-main)', fontWeight: 600 }}>{t.resultSummary}</div>
                                {t.reportUrl && (
                                  <a
                                    href={t.reportUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: 11, color: '#0284c7', textDecoration: 'underline', marginTop: 2, display: 'inline-block' }}
                                  >
                                    📄 View Official Lab Report
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>Awaiting lab processing...</span>
                            )}
                          </td>
                          <td>{new Date(t.createdAt || Date.now()).toLocaleDateString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: Discharge Summaries */}
        {activeTab === 'discharges' && (
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <span className="card-title">📋 Patient Discharge Summaries & PDF Documents ({filteredDischarges.length})</span>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="🔍 Search patient name, ID, or diagnosis..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: 260 }}
              />
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                Review complete patient discharge summaries and download official generated PDF reports.
              </p>
              {filteredDischarges.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📋</div>
                  <h3>No discharge summaries found</h3>
                  <p>Discharged patient records will be listed here.</p>
                </div>
              ) : (
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th>Patient ID</th>
                        <th>Patient Name</th>
                        <th>Admission No</th>
                        <th>Discharge Date</th>
                        <th>Condition</th>
                        <th>Diagnosis</th>
                        <th>Summary / PDF Content</th>
                        <th>Discharge PDF Action</th>
                        <th>Date Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDischarges.map(d => (
                        <tr key={d.id}>
                          <td><code style={{ color: 'var(--primary-light)', fontSize: 12 }}>{d.patientId}</code></td>
                          <td><strong>{d.patientName}</strong></td>
                          <td><code>{d.admissionNumber || 'N/A'}</code></td>
                          <td>{d.dischargeDate}</td>
                          <td><span className="badge badge-success">{d.conditionAtDischarge || 'Stable'}</span></td>
                          <td>{d.diagnosis || 'N/A'}</td>
                          <td style={{ maxWidth: 260, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <div style={{ maxHeight: 60, overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
                              {d.dischargeSummary || 'No summary text attached.'}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => downloadDischargePdf(d.id, d.patientId)}
                            >
                              📄 Download PDF
                            </button>
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

      {/* MODAL: Record Vitals & Triage Note */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <h3>💗 Record Patient Vitals & Clinical Triage</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid form-grid-3" style={{ marginBottom: 16 }}>
                  <div className="form-group">
                    <label className="form-label">Patient Name *</label>
                    <input className="form-control" placeholder="John Doe" value={form.patientName} onChange={e => set('patientName', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Patient ID</label>
                    <input className="form-control" placeholder="PAT-2024-0001" value={form.patientId} onChange={e => set('patientId', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Triage Priority Level</label>
                    <select className="form-control" value={form.triagePriority} onChange={e => set('triagePriority', e.target.value)}>
                      <option value="Routine">Routine</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Emergency">Emergency</option>
                    </select>
                  </div>
                </div>

                <div className="vital-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                  {[
                    { k: 'temperature', label: 'Temp', placeholder: '37.0', unit: '°C' },
                    { k: 'bloodPressure', label: 'Blood Pressure', placeholder: '120/80', unit: 'mmHg' },
                    { k: 'heartRate', label: 'Heart Rate', placeholder: '72', unit: 'bpm' },
                    { k: 'oxygenSaturation', label: 'SpO2', placeholder: '98', unit: '%' },
                    { k: 'respiratoryRate', label: 'Resp. Rate', placeholder: '16', unit: '/min' },
                    { k: 'bloodSugar', label: 'Blood Sugar', placeholder: '90', unit: 'mg/dL' },
                    { k: 'weight', label: 'Weight', placeholder: '70', unit: 'kg' },
                    { k: 'height', label: 'Height', placeholder: '170', unit: 'cm' },
                  ].map(f => (
                    <div key={f.k} className="vital-item" style={{ textAlign: 'left', background: 'var(--bg-dark)', border: '1px solid var(--border)' }}>
                      <div className="form-group">
                        <label className="form-label">{f.label} <span style={{ color: 'var(--text-muted)' }}>({f.unit})</span></label>
                        <input className="form-control" placeholder={f.placeholder} value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)} style={{ textAlign: 'center', fontSize: 16, fontWeight: 700 }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="form-group" style={{ marginTop: 14 }}>
                  <label className="form-label">Triage & Clinical Observations Note</label>
                  <textarea className="form-control" rows={3} placeholder="Describe patient symptoms, triage notes, or immediate concerns..." value={form.triageNotes} onChange={e => set('triageNotes', e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? '⏳ Saving...' : '💗 Save Vitals & Triage Note'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Full Patient Medical History Drawer */}
      {showHistoryModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowHistoryModal(false)}>
          <div className="modal" style={{ maxWidth: 760 }}>
            <div className="modal-header">
              <h3>📂 Complete Patient Medical History Profile</h3>
              <button className="btn btn-secondary btn-icon" onClick={() => setShowHistoryModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingHistory || !selectedPatientHistory ? (
                <div className="flex justify-center items-center" style={{ padding: 40 }}>
                  <div className="loading-spinner" />
                </div>
              ) : (
                <>
                  {/* Patient Info Card */}
                  <div style={{ background: 'var(--bg-surface)', padding: 16, borderRadius: 12, marginBottom: 20, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                      {selectedPatientHistory.patient?.firstName} {selectedPatientHistory.patient?.lastName}
                    </div>
                    <div style={{ fontSize: 13, color: '#0ea5e9', fontWeight: 600 }}>
                      ID: {selectedPatientHistory.patient?.patientId} | OPD Token: {selectedPatientHistory.patient?.opdTokenNumber || 'N/A'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12, fontSize: 12 }}>
                      <div><strong>DOB:</strong> {selectedPatientHistory.patient?.dateOfBirth}</div>
                      <div><strong>Gender:</strong> {selectedPatientHistory.patient?.gender}</div>
                      <div><strong>Blood Group:</strong> {selectedPatientHistory.patient?.bloodGroup || 'N/A'}</div>
                      <div><strong>Phone:</strong> {selectedPatientHistory.patient?.phone}</div>
                      <div><strong>Status:</strong> <span className="badge badge-success">{selectedPatientHistory.patient?.status}</span></div>
                    </div>
                  </div>

                  {/* Historical Vitals */}
                  <div style={{ marginBottom: 20 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>💗 Vitals & Triage History</h4>
                    <div className="table-container">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Temp</th>
                            <th>BP</th>
                            <th>Heart Rate</th>
                            <th>SpO2</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedPatientHistory.vitalsHistory?.map((v: any) => (
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

                  {/* Test Reports Overview */}
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>🧪 Test Reports Overview</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {selectedPatientHistory.testReports?.map((r: any) => (
                        <div key={r.id} style={{ background: 'var(--bg-surface)', padding: 12, borderRadius: 8, border: '1px solid var(--border)', fontSize: 12 }}>
                          <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                            <strong>{r.title} ({r.category})</strong>
                            <span className="badge badge-success">{r.status}</span>
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>Date: {r.date} | ID: {r.id}</div>
                          <div style={{ marginTop: 6, color: 'var(--text-secondary)' }}>{r.notes}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowHistoryModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
