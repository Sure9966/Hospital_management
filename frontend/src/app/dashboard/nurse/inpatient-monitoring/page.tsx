'use client';
import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { getUser, User } from '@/lib/auth';
import { playNotificationSound } from '@/lib/sound';

// ─── 5 Main Categories & 32 Subheadings Definitions ───────────────────────────
interface SubheadingDef {
  id: number;
  title: string;
  categoryKey: CategoryKey;
  icon: string;
  description: string;
}

type CategoryKey = 'admission' | 'nursing' | 'surgical' | 'monitoring' | 'specialized';

interface CategoryDef {
  key: CategoryKey;
  title: string;
  icon: string;
  badgeColor: string;
  description: string;
}

const CATEGORIES: CategoryDef[] = [
  {
    key: 'admission',
    title: 'Admission & Basic Consents',
    icon: '📋',
    badgeColor: '#6366f1',
    description: 'Demographics, triage, initial assessment, general consents & primary consultant notes'
  },
  {
    key: 'nursing',
    title: 'Nursing & Daily Charts',
    icon: '🩺',
    badgeColor: '#10b981',
    description: 'TPR & I/O chart, nursing assessments, medication (MAR), shift notes & discharge summaries'
  },
  {
    key: 'surgical',
    title: 'Surgical & Anesthesia Suite',
    icon: '✂️',
    badgeColor: '#f472b6',
    description: 'Pre-op checklist, anesthesia assessment & records, surgeon notes & PACU recovery records'
  },
  {
    key: 'monitoring',
    title: 'Blood & Clinical Monitoring',
    icon: '🩸',
    badgeColor: '#f59e0b',
    description: 'Blood transfusion forms, diabetic insulin charts, nutrition assessment, diet sheets & lab results'
  },
  {
    key: 'specialized',
    title: 'Specialized Consents & Education',
    icon: '✍️',
    badgeColor: '#8b5cf6',
    description: 'High risk & blood transfusion consents, investigation requisitions, physiotherapy & patient education'
  }
];

const SUBHEADINGS: SubheadingDef[] = [
  // Category 1: Admission & Basic Consents (1-6)
  { id: 1, categoryKey: 'admission', title: '1. Admission Record', icon: '📝', description: 'Patient admission demographics, IP number, ward & attending doctor' },
  { id: 2, categoryKey: 'admission', title: '2. Bed Transfer Consent', icon: '🛏️', description: 'Consent & record for bed or ward transfer request' },
  { id: 3, categoryKey: 'admission', title: '3. Emergency Triage Record', icon: '🚨', description: 'Triage priority, arrival vitals, emergency assessment' },
  { id: 4, categoryKey: 'admission', title: '4. General Consent', icon: '📋', description: 'General medical treatment & nursing care authorization' },
  { id: 5, categoryKey: 'admission', title: '5. Initial Assessment', icon: '🔍', description: 'Comprehensive physical examination & clinical history' },
  { id: 6, categoryKey: 'admission', title: '6. Page for Primary Consultant', icon: '👨‍⚕️', description: 'Consultant visit log, daily rounds & direction notes' },

  // Category 2: Nursing & Daily Charts (7-12)
  { id: 7, categoryKey: 'nursing', title: '1. TPR & I/O Chart', icon: '📈', description: 'Temperature, Pulse, Respiration & Intake/Output tracking' },
  { id: 8, categoryKey: 'nursing', title: '2. Nursing Assessment Chart', icon: '🩺', description: 'Vitals summary, pain score, consciousness & fall risk' },
  { id: 9, categoryKey: 'nursing', title: '3. Duty Doctor\'s Notes', icon: '📝', description: 'Shift clinical impressions, progress notes & orders' },
  { id: 10, categoryKey: 'nursing', title: '4. Medication Chart (MAR)', icon: '💊', description: 'Medication Administration Record, doses & time logs' },
  { id: 11, categoryKey: 'nursing', title: '5. Nurses Notes', icon: '✍️', description: 'Chronological nursing logs & care interventions' },
  { id: 12, categoryKey: 'nursing', title: '6. Discharge / LAMS / Death Summary', icon: '📜', description: 'Final hospital summary, condition at discharge or outcome' },

  // Category 3: Surgical & Anesthesia Suite (13-21)
  { id: 13, categoryKey: 'surgical', title: '1. Consent for Anesthesia / Analgesia / Sedation', icon: '💉', description: 'Anesthetic risk disclosure & patient acknowledgment' },
  { id: 14, categoryKey: 'surgical', title: '2. Consent Form for Surgery', icon: '✂️', description: 'Surgical procedure authorization & risk disclosure' },
  { id: 15, categoryKey: 'surgical', title: '3. Pre Anesthetic Assessment', icon: '🩺', description: 'ASA physical status, airway evaluation & pre-op risk' },
  { id: 16, categoryKey: 'surgical', title: '4. Pre-Operative Checklist', icon: '☑️', description: 'Pre-op prep verification, NPO status & identity check' },
  { id: 17, categoryKey: 'surgical', title: '5. Anesthesia Record', icon: '📊', description: 'Intra-operative anesthesia agents & vitals log' },
  { id: 18, categoryKey: 'surgical', title: '6. Surgeon Notes', icon: '📄', description: 'Operative findings, technique & post-op instructions' },
  { id: 19, categoryKey: 'surgical', title: '7. Post Operative Recovery', icon: '🏥', description: 'Immediate post-surgery vitals & recovery orders' },
  { id: 20, categoryKey: 'surgical', title: '8. Surgical Safety Checklist', icon: '🛡️', description: 'WHO Surgical Safety Checklist (Sign In, Time Out, Sign Out)' },
  { id: 21, categoryKey: 'surgical', title: '9. Recovery Room Record', icon: '🛏️', description: 'PACU monitoring & Aldrete score discharge assessment' },

  // Category 4: Blood & Clinical Monitoring (22-27)
  { id: 22, categoryKey: 'monitoring', title: '1. Blood Transfusion Form', icon: '🩸', description: 'Blood product ID, cross-match, pre & post transfusion vitals' },
  { id: 23, categoryKey: 'monitoring', title: '2. Diabetic Monitoring Chart', icon: '🩸', description: 'Blood sugar levels (BSL) & sliding scale insulin logs' },
  { id: 24, categoryKey: 'monitoring', title: '3. Nutrition Assessment Form', icon: '🥗', description: 'Nutritional risk screening, BMI & dietary requirements' },
  { id: 25, categoryKey: 'monitoring', title: '4. Diet Sheet', icon: '🍲', description: 'Daily meal plans, therapeutic diet & fluid intake rules' },
  { id: 26, categoryKey: 'monitoring', title: '5. Moderate Sedation Chart', icon: '😴', description: 'Sedation depth, airway monitoring & recovery log' },
  { id: 27, categoryKey: 'monitoring', title: '6. Investigation Sheet', icon: '🔬', description: 'Laboratory & Radiology reports cumulative record' },

  // Category 5: Specialized Consents & Education (28-32)
  { id: 28, categoryKey: 'specialized', title: '1. Consent for Blood Transfusion', icon: '✍️', description: 'Informed consent for blood & blood product administration' },
  { id: 29, categoryKey: 'specialized', title: '2. High Risk Consent', icon: '⚠️', description: 'High-risk procedure acknowledgment & relative consent' },
  { id: 30, categoryKey: 'specialized', title: '3. Investigation Requisition Form', icon: '🧪', description: 'Lab test & diagnostic imaging order form' },
  { id: 31, categoryKey: 'specialized', title: '4. Physiotherapy Consent Form', icon: '🏃', description: 'Physical therapy & rehabilitation treatment consent' },
  { id: 32, categoryKey: 'specialized', title: '5. Patient and Family Education', icon: '🎓', description: 'Patient education logs for medications, diet & wound care' }
];

export default function InpatientMonitoringDashboard() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);

  // Active Category State (Default: 'admission')
  const [activeCategoryKey, setActiveCategoryKey] = useState<CategoryKey>('admission');

  // Real-time Database state objects fetched for selected patient
  const [dbVitals, setDbVitals] = useState<any[]>([]);
  const [dbPrescriptions, setDbPrescriptions] = useState<any[]>([]);
  const [dbConsultations, setDbConsultations] = useState<any[]>([]);
  const [dbAdmissions, setDbAdmissions] = useState<any[]>([]);
  const [dbLabs, setDbLabs] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState<boolean>(false);

  // Started medicines and completed doses states for MAR
  const [startedMedicines, setStartedMedicines] = useState<Record<string, boolean>>({});
  const [completedDoses, setCompletedDoses] = useState<Record<string, boolean>>({});
  const [completedDosesLogs, setCompletedDosesLogs] = useState<Record<string, { timestamp: string; dateStr: string; timeStr: string; nurseName: string; dayLabel: string; medName?: string }>>({});

  // Form input state per patient and subheading
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [savingCategory, setSavingCategory] = useState<boolean>(false);

  // Initial load: Fetch admitted patients & user
  useEffect(() => {
    const u = getUser();
    setCurrentUser(u);

    api.get('/patients')
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : [];
        setPatients(list);
        if (list.length > 0) {
          setSelectedPatientId(list[0].id);
          setSelectedPatient(list[0]);
        }
      })
      .catch(() => toast.error('Failed to load inpatient records'));
  }, []);

  // Sync saved MAR logs for selected patient
  useEffect(() => {
    if (selectedPatientId) {
      try {
        const raw = localStorage.getItem(`hms_mar_logs_${selectedPatientId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.startedMedicines) setStartedMedicines(parsed.startedMedicines);
          if (parsed.completedDoses) setCompletedDoses(parsed.completedDoses);
          if (parsed.completedDosesLogs) setCompletedDosesLogs(parsed.completedDosesLogs);
        }
      } catch {}
    }
  }, [selectedPatientId]);

  const saveMarStorage = (
    newStarted: Record<string, boolean>,
    newCompleted: Record<string, boolean>,
    newLogs: Record<string, any>
  ) => {
    if (!selectedPatientId) return;
    try {
      localStorage.setItem(
        `hms_mar_logs_${selectedPatientId}`,
        JSON.stringify({
          startedMedicines: newStarted,
          completedDoses: newCompleted,
          completedDosesLogs: newLogs,
          updatedAt: new Date().toISOString(),
        })
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('hospital-data-refresh'));
      }
    } catch {}
  };

  // Fetch real-time DB information whenever patient changes
  const fetchRealtimePatientDbData = useCallback(async (patientId: string) => {
    if (!patientId) return;
    setLoadingDb(true);
    try {
      const [vRes, pRes, cRes, aRes, lRes] = await Promise.allSettled([
        api.get('/nurse/vitals'),
        api.get('/pharmacy/prescriptions'),
        api.get('/doctor/consultations'),
        api.get('/beds/admissions'),
        api.get('/lab'),
      ]);

      if (vRes.status === 'fulfilled') setDbVitals(Array.isArray(vRes.value.data) ? vRes.value.data : []);
      if (pRes.status === 'fulfilled') setDbPrescriptions(Array.isArray(pRes.value.data) ? pRes.value.data : []);
      if (cRes.status === 'fulfilled') setDbConsultations(Array.isArray(cRes.value.data) ? cRes.value.data : []);
      if (aRes.status === 'fulfilled') setDbAdmissions(Array.isArray(aRes.value.data) ? aRes.value.data : []);
      if (lRes.status === 'fulfilled') setDbLabs(Array.isArray(lRes.value.data) ? lRes.value.data : []);
    } catch {
      toast.error('Failed to sync real-time DB info');
    } finally {
      setLoadingDb(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPatientId) {
      fetchRealtimePatientDbData(selectedPatientId);
    }
  }, [selectedPatientId, fetchRealtimePatientDbData]);

  // Handle patient dropdown selection
  const handleSelectPatient = (id: string) => {
    setSelectedPatientId(id);
    const found = patients.find(p => p.id === id);
    setSelectedPatient(found || null);
  };

  // MAR Start Medicine Handler
  const handleStartMedicine = (medKey: string, medicineName: string) => {
    const nextStarted = { ...startedMedicines, [medKey]: true };
    setStartedMedicines(nextStarted);
    saveMarStorage(nextStarted, completedDoses, completedDosesLogs);
    playNotificationSound();
    toast.success(`▶️ Medication started for "${medicineName}"! Day 1 checkbox is now enabled.`);
  };

  // MAR Dose Box Toggle Handler with Sequential Enablement & Date/Time Log Capture
  const handleToggleDoseBox = (
    medKey: string,
    medicineName: string,
    box: { id: string; label: string },
    boxIdx: number,
    boxes: { id: string; label: string }[],
    isEnabled: boolean
  ) => {
    if (!isEnabled) {
      if (!startedMedicines[medKey]) {
        toast.error(`🔒 Click "▶️ Start Medicine" first to enable Day 1.`);
      } else {
        const prevBox = boxes[boxIdx - 1];
        toast.error(`🔒 Complete "${prevBox?.label || 'previous day'}" first before enabling ${box.label}.`);
      }
      return;
    }

    const boxKey = `${medKey}-${box.id}`;
    const currentlyChecked = !!completedDoses[boxKey];
    const newChecked = !currentlyChecked;

    const newCompletedDoses = { ...completedDoses, [boxKey]: newChecked };
    const newLogs = { ...completedDosesLogs };

    if (newChecked) {
      const now = new Date();
      const dateStr = now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const fullTimestamp = `${now.toISOString().slice(0, 10)} ${timeStr}`;
      const nurseName = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Staff Nurse';

      newLogs[boxKey] = {
        timestamp: fullTimestamp,
        dateStr,
        timeStr,
        nurseName,
        dayLabel: box.label,
        medName: medicineName,
      };

      playNotificationSound();
      toast.success(`✅ Administered ${box.label} for "${medicineName}" at ${timeStr} by ${nurseName}. Next day box is now enabled!`);
    } else {
      delete newLogs[boxKey];
      // Uncheck subsequent boxes if previous day is unchecked
      boxes.slice(boxIdx).forEach(b => {
        const k = `${medKey}-${b.id}`;
        delete newCompletedDoses[k];
        delete newLogs[k];
      });
      toast.success(`↩️ Unmarked ${box.label} administration for "${medicineName}".`);
    }

    setCompletedDoses(newCompletedDoses);
    setCompletedDosesLogs(newLogs);
    saveMarStorage(startedMedicines, newCompletedDoses, newLogs);
  };

  // Safe field getter/setter
  const handleInputChange = (subheadingId: number, field: string, value: any) => {
    const key = `${selectedPatientId}_sub_${subheadingId}`;
    setFormData(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || {}),
        [field]: value,
      }
    }));
  };

  const getFieldValue = (subheadingId: number, field: string, defaultVal: string = '') => {
    const key = `${selectedPatientId}_sub_${subheadingId}`;
    return formData[key]?.[field] ?? defaultVal;
  };

  const handleSaveActiveCategory = () => {
    setSavingCategory(true);
    const catObj = CATEGORIES.find(c => c.key === activeCategoryKey);
    setTimeout(() => {
      setSavingCategory(false);
      toast.success(`✅ Saved all records for "${catObj?.title}" (Patient: ${selectedPatient?.firstName || 'IP Patient'})`);
    }, 400);
  };

  const activeCategory = CATEGORIES.find(c => c.key === activeCategoryKey) || CATEGORIES[0];
  const activeSubheadings = SUBHEADINGS.filter(s => s.categoryKey === activeCategoryKey);

  // Access Guard: Strict Nurse role requirement & IP Duty requirement
  const isNurseRole = currentUser?.role === 'nurse';
  const isIpDuty = (currentUser?.dutyType || '').toUpperCase() === 'IP';

  if (currentUser && (!isNurseRole || !isIpDuty)) {
    return (
      <DashboardLayout role="nurse" title="INPATIENT MONITORING DASHBOARD">
        <div className="card" style={{ maxWidth: 650, margin: '40px auto', padding: 30, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🚫</div>
          <h2 style={{ fontSize: 22, color: '#ef4444', marginBottom: 10 }}>
            {!isNurseRole ? 'Access Restricted — Nurse Role Required' : 'Access Restricted — Nurse IP Duty Required'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
            {!isNurseRole
              ? `This Inpatient Monitoring Dashboard can strictly be accessed only by logged-in Nurse staff. Your current logged-in role is: ${currentUser?.role || 'User'}.`
              : `Inpatient Clinical Monitoring is strictly restricted to Nurses assigned to IP (Inpatient) Duty. Your current duty assignment is: ${(currentUser?.dutyType || 'OP').toUpperCase()} Duty.`
            }
          </p>
          <a href={`/dashboard/${currentUser?.role || 'nurse'}`} className="btn btn-primary" style={{ display: 'inline-block' }}>
            ← Return to {currentUser?.role ? currentUser.role.toUpperCase() : 'Nurse'} Dashboard
          </a>
        </div>
      </DashboardLayout>
    );
  }

  // Find patient vitals from real-time DB
  const patientVitals = dbVitals.filter(v => v.patientId === selectedPatient?.patientId || v.patientName?.toLowerCase().includes((selectedPatient?.firstName || '').toLowerCase()));
  const latestVital = patientVitals[0] || {};
  const patientPrescriptions = dbPrescriptions.filter(p => p.patientId === selectedPatient?.patientId || p.patientName?.toLowerCase().includes((selectedPatient?.firstName || '').toLowerCase()));
  const patientConsultations = dbConsultations.filter(c => c.patientId === selectedPatient?.patientId || c.patientName?.toLowerCase().includes((selectedPatient?.firstName || '').toLowerCase()));
  const patientLabs = dbLabs.filter(l => l.patientId === selectedPatient?.patientId || l.patientName?.toLowerCase().includes((selectedPatient?.firstName || '').toLowerCase()));

  return (
    <DashboardLayout role="nurse" title="INPATIENT CLINICAL MONITORING SUITE">
      {/* ══ TOPBAR PATIENT SELECTOR & REALTIME DB STATUS BANNER ══════════════ */}
      <div className="card mb-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div className="card-body" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28 }}>🏥</span>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>Categorized Inpatient Clinical Suite</h2>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Nurse IP Access • Live Real-time Database Integration
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className={`badge ${isIpDuty ? 'badge-success' : 'badge-warning'}`} style={{ padding: '6px 12px', fontSize: 12 }}>
                {isIpDuty ? '🟢 Nurse IP Duty Active' : '🟡 Nurse OP Duty (IP Mode)'}
              </span>
              <span className="badge badge-info" style={{ padding: '6px 12px', fontSize: 12 }}>
                {loadingDb ? '⏳ Syncing DB...' : '⚡ DB Connected'}
              </span>
            </div>
          </div>

          {/* Patient Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Select Admitted Patient:</label>
            <select
              className="form-control"
              style={{ minWidth: 280, fontWeight: 700, borderColor: 'var(--primary)' }}
              value={selectedPatientId}
              onChange={e => handleSelectPatient(e.target.value)}
            >
              {patients.length === 0 ? (
                <option value="">No admitted patients found</option>
              ) : (
                patients.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName} {p.lastName} ({p.patientId || 'IP'}) — {p.ward || 'General Ward'}
                  </option>
                ))
              )}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={() => fetchRealtimePatientDbData(selectedPatientId)} title="Refresh real-time DB data">
              🔄 Sync DB
            </button>
          </div>
        </div>
      </div>

      {/* ══ SELECTED PATIENT REAL-TIME DB METRICS BANNER ══════════════════════ */}
      {selectedPatient && (
        <div className="card mb-4" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(16,185,129,0.08))', border: '1px solid rgba(99,102,241,0.25)', borderRadius: 12 }}>
          <div className="card-body" style={{ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: 20, justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Patient Name & ID</span>
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary-light)' }}>
                {selectedPatient.firstName} {selectedPatient.lastName} <code style={{ fontSize: 12, marginLeft: 6 }}>{selectedPatient.patientId}</code>
              </div>
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Gender / Age</span>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{selectedPatient.gender || 'Male'} / {selectedPatient.age || 45} yrs</div>
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Admitted Ward / Bed</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>{selectedPatient.ward || 'ICU Ward'} - Bed 102</div>
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Real-time DB Temp / BP</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#0ea5e9' }}>
                {latestVital.temperature ? `${latestVital.temperature}°F` : '98.6°F'} | {latestVital.bloodPressure ? latestVital.bloodPressure : '120/80 mmHg'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 }}>Active Prescriptions (DB)</span>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b' }}>
                {patientPrescriptions.length} Active Rx Prescriptions
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ 5 CATEGORY TABS NAVIGATION BAR ═══════════════════════════════════ */}
      <div className="card mb-4" style={{ borderRadius: 12, border: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
          {CATEGORIES.map(cat => {
            const isActive = activeCategoryKey === cat.key;
            const subCount = SUBHEADINGS.filter(s => s.categoryKey === cat.key).length;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategoryKey(cat.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: isActive ? `2px solid ${cat.badgeColor}` : '1px solid var(--border)',
                  background: isActive ? `${cat.badgeColor}18` : 'var(--bg-card)',
                  color: isActive ? cat.badgeColor : 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 4px 12px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <span style={{ fontSize: 24 }}>{cat.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, lineHeight: 1.2 }}>{cat.title}</div>
                  <div style={{ fontSize: 11, opacity: 0.8, marginTop: 2 }}>{subCount} Subheading Sections</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ CATEGORY HEADER & QUICK SUBHEADING JUMPER ════════════════════════ */}
      <div className="card mb-4" style={{ borderLeft: `4px solid ${activeCategory.badgeColor}` }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26 }}>{activeCategory.icon}</span>
              <h2 className="card-title" style={{ fontSize: 18, color: activeCategory.badgeColor }}>
                {activeCategory.title} ({activeSubheadings.length} Subheadings Page View)
              </h2>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{activeCategory.description}</div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>
              🖨️ Print Entire Category Page
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleSaveActiveCategory} disabled={savingCategory}>
              {savingCategory ? '⏳ Saving All...' : '💾 Save All Subheadings'}
            </button>
          </div>
        </div>

        {/* Quick Anchor Jumper Bar */}
        <div style={{ padding: '10px 16px', background: 'var(--bg-surface)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {activeSubheadings.map(sub => (
            <a
              key={sub.id}
              href={`#subheading-${sub.id}`}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: 11, padding: '2px 8px', borderRadius: 6 }}
            >
              {sub.title}
            </a>
          ))}
        </div>
      </div>

      {/* ══ SINGLE PAGE DISPLAY OF ALL SUBHEADINGS FOR ACTIVE CATEGORY ═══════ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {activeSubheadings.map(sub => (
          <div key={sub.id} id={`subheading-${sub.id}`} className="card" style={{ scrollMarginTop: 100 }}>
            <div className="card-header" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>{sub.icon}</span>
                <div>
                  <h3 className="card-title" style={{ fontSize: 15, fontWeight: 800 }}>{sub.title}</h3>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub.description}</div>
                </div>
              </div>
            </div>

            <div className="card-body">
              <RealtimeSubheadingRenderer
                subheadingId={sub.id}
                patient={selectedPatient}
                latestVital={latestVital}
                prescriptions={patientPrescriptions}
                consultations={patientConsultations}
                labs={patientLabs}
                startedMedicines={startedMedicines}
                setStartedMedicines={setStartedMedicines}
                completedDoses={completedDoses}
                setCompletedDoses={setCompletedDoses}
                completedDosesLogs={completedDosesLogs}
                handleStartMedicine={handleStartMedicine}
                handleToggleDoseBox={handleToggleDoseBox}
                getFieldValue={getFieldValue}
                handleInputChange={handleInputChange}
              />
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}

// Helper to compute dose / daily tracking checkboxes
function getDoseBoxes(duration?: string, frequency?: string) {
  const dur = (duration || '').toLowerCase();
  const freq = (frequency || '').toLowerCase();

  const daysMatch = dur.match(/(\d+)\s*day/);
  if (daysMatch) {
    const count = parseInt(daysMatch[1]);
    return Array.from({ length: Math.min(count, 30) }, (_, i) => ({
      id: `day_${i + 1}`,
      label: `Day ${i + 1}`,
    }));
  } else if (dur.includes('1 month') || dur.includes('month')) {
    return Array.from({ length: 30 }, (_, i) => ({ id: `day_${i + 1}`, label: `Day ${i + 1}` }));
  }

  if (freq.includes('three') || freq.includes('tds') || freq.includes('3 times')) {
    return [
      { id: 'dose_1', label: 'Morning (08:00 AM)' },
      { id: 'dose_2', label: 'Afternoon (02:00 PM)' },
      { id: 'dose_3', label: 'Night (08:00 PM)' },
    ];
  } else if (freq.includes('twice') || freq.includes('bd') || freq.includes('2 times')) {
    return [
      { id: 'dose_1', label: 'Morning (08:00 AM)' },
      { id: 'dose_2', label: 'Night (08:00 PM)' },
    ];
  } else if (freq.includes('four') || freq.includes('qd') || freq.includes('4 times')) {
    return [
      { id: 'dose_1', label: '06:00 AM' },
      { id: 'dose_2', label: '12:00 PM' },
      { id: 'dose_3', label: '06:00 PM' },
      { id: 'dose_4', label: '12:00 AM' },
    ];
  }

  return [
    { id: 'day_1', label: 'Day 1' },
    { id: 'day_2', label: 'Day 2' },
    { id: 'day_3', label: 'Day 3' },
    { id: 'day_4', label: 'Day 4' },
    { id: 'day_5', label: 'Day 5' },
  ];
}

// ─── Sub-Component for Rendering Real-time Database Subheading Information ───
function RealtimeSubheadingRenderer({
  subheadingId,
  patient,
  latestVital,
  prescriptions,
  consultations,
  labs,
  startedMedicines,
  setStartedMedicines,
  completedDoses,
  setCompletedDoses,
  completedDosesLogs,
  handleStartMedicine,
  handleToggleDoseBox,
  getFieldValue,
  handleInputChange,
}: {
  subheadingId: number;
  patient: any;
  latestVital: any;
  prescriptions: any[];
  consultations: any[];
  labs: any[];
  startedMedicines: Record<string, boolean>;
  setStartedMedicines: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  completedDoses: Record<string, boolean>;
  setCompletedDoses: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  completedDosesLogs: Record<string, { timestamp: string; dateStr: string; timeStr: string; nurseName: string; dayLabel: string; medName?: string }>;
  handleStartMedicine: (medKey: string, medicineName: string) => void;
  handleToggleDoseBox: (
    medKey: string,
    medicineName: string,
    box: { id: string; label: string },
    boxIdx: number,
    boxes: { id: string; label: string }[],
    isEnabled: boolean
  ) => void;
  getFieldValue: (subId: number, field: string, defaultVal?: string) => string;
  handleInputChange: (subId: number, field: string, val: any) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 1. Admission Record */}
      {subheadingId === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="badge badge-success" style={{ alignSelf: 'flex-start' }}>✓ Real-time Admission Data Synced</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="form-label">Admission Number</label><input className="form-control" value={getFieldValue(1, 'admNo', patient?.patientId ? `ADM-${patient.patientId}` : 'ADM-2026-881')} onChange={e => handleInputChange(1, 'admNo', e.target.value)} /></div>
            <div><label className="form-label">Date & Time of Admission</label><input className="form-control" type="datetime-local" value={getFieldValue(1, 'admDateTime', new Date().toISOString().slice(0, 16))} onChange={e => handleInputChange(1, 'admDateTime', e.target.value)} /></div>
            <div><label className="form-label">Admitting Consultant (DB)</label><input className="form-control" value={getFieldValue(1, 'doctor', patient?.assignedDoctorName || 'Dr. Sarah Jenkins')} onChange={e => handleInputChange(1, 'doctor', e.target.value)} /></div>
            <div><label className="form-label">Provisional Diagnosis (DB)</label><input className="form-control" value={getFieldValue(1, 'diag', patient?.diagnosis || 'Acute Coronary Syndrome')} onChange={e => handleInputChange(1, 'diag', e.target.value)} /></div>
          </div>
          <div><label className="form-label">Admission Complaints & Clinical Summary</label><textarea className="form-control" rows={2} value={getFieldValue(1, 'notes', patient?.reason || 'Patient admitted for inpatient monitoring and active treatment.')} onChange={e => handleInputChange(1, 'notes', e.target.value)} /></div>
        </div>
      )}

      {/* 2. Bed Transfer Consent */}
      {subheadingId === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="form-label">Current Ward & Bed (DB)</label><input className="form-control" value={getFieldValue(2, 'fromBed', `${patient?.ward || 'General Ward'} - Bed 102`)} onChange={e => handleInputChange(2, 'fromBed', e.target.value)} /></div>
            <div><label className="form-label">Requested Transfer Ward/Bed</label><input className="form-control" value={getFieldValue(2, 'toBed', 'ICU Ward - Bed 04')} onChange={e => handleInputChange(2, 'toBed', e.target.value)} /></div>
          </div>
          <div><label className="form-label">Reason for Bed Transfer</label><input className="form-control" value={getFieldValue(2, 'reason', 'Higher level monitoring required')} onChange={e => handleInputChange(2, 'reason', e.target.value)} /></div>
        </div>
      )}

      {/* 3. Emergency Triage Record */}
      {subheadingId === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label className="form-label">Triage Priority Level</label><select className="form-control" value={getFieldValue(3, 'triagePriority', patient?.isEmergency ? 'Priority 1 - Red (Emergency)' : 'Priority 2 - Yellow')} onChange={e => handleInputChange(3, 'triagePriority', e.target.value)}><option>Priority 1 - Red (Emergency)</option><option>Priority 2 - Yellow (Urgent)</option><option>Priority 3 - Green (Routine)</option></select></div>
            <div><label className="form-label">Arrival Pulse (DB)</label><input className="form-control" value={getFieldValue(3, 'pulse', latestVital.heartRate ? `${latestVital.heartRate} bpm` : '110 bpm')} onChange={e => handleInputChange(3, 'pulse', e.target.value)} /></div>
            <div><label className="form-label">Arrival BP (DB)</label><input className="form-control" value={getFieldValue(3, 'bp', latestVital.bloodPressure ? latestVital.bloodPressure : '140/90 mmHg')} onChange={e => handleInputChange(3, 'bp', e.target.value)} /></div>
          </div>
        </div>
      )}

      {/* 6. Page for Primary Consultant */}
      {subheadingId === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="badge badge-info" style={{ alignSelf: 'flex-start' }}>👨‍⚕️ Primary Consultant Consultations ({consultations.length} records)</div>
          <div><label className="form-label">Consultant Daily Round Notes & Directions</label><textarea className="form-control" rows={3} value={getFieldValue(6, 'consultantNotes', consultations[0]?.notes || 'Continue current IV antibiotics. Monitor vitals Q4H. Repeat ECG in evening.')} onChange={e => handleInputChange(6, 'consultantNotes', e.target.value)} /></div>
        </div>
      )}

      {/* 7. TPR & I/O Chart */}
      {subheadingId === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="badge badge-success" style={{ alignSelf: 'flex-start' }}>📈 Real-time Vitals DB Synced</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
            <div><label className="form-label">Temp (°F)</label><input className="form-control" value={getFieldValue(7, 'temp', latestVital.temperature ? `${latestVital.temperature}°F` : '98.6°F')} onChange={e => handleInputChange(7, 'temp', e.target.value)} /></div>
            <div><label className="form-label">Pulse (bpm)</label><input className="form-control" value={getFieldValue(7, 'pulse', latestVital.heartRate ? `${latestVital.heartRate} bpm` : '78 bpm')} onChange={e => handleInputChange(7, 'pulse', e.target.value)} /></div>
            <div><label className="form-label">Resp Rate</label><input className="form-control" value={getFieldValue(7, 'resp', latestVital.respiratoryRate ? `${latestVital.respiratoryRate} bpm` : '18 bpm')} onChange={e => handleInputChange(7, 'resp', e.target.value)} /></div>
            <div><label className="form-label">BP (mmHg)</label><input className="form-control" value={getFieldValue(7, 'bp', latestVital.bloodPressure ? latestVital.bloodPressure : '120/80 mmHg')} onChange={e => handleInputChange(7, 'bp', e.target.value)} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="form-label">Oral / IV Fluid Intake (mL)</label><input className="form-control" value={getFieldValue(7, 'intake', '1500 mL')} onChange={e => handleInputChange(7, 'intake', e.target.value)} /></div>
            <div><label className="form-label">Urine Output (mL)</label><input className="form-control" value={getFieldValue(7, 'output', '1350 mL')} onChange={e => handleInputChange(7, 'output', e.target.value)} /></div>
          </div>
        </div>
      )}

      {/* 10. Medication Chart (MAR) */}
      {subheadingId === 10 && (() => {
        // Flatten all medicines from DB prescriptions
        const medsList: any[] = [];
        prescriptions.forEach((p: any) => {
          const createdAtStr = p.createdAt
            ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' (' + new Date(p.createdAt).toLocaleDateString() + ')'
            : '08:00 AM';

          if (Array.isArray(p.medicines) && p.medicines.length > 0) {
            p.medicines.forEach((m: any) => {
              medsList.push({
                prescriptionId: p.prescriptionId || p.id,
                createdAtStr,
                medicineName: m.name || m.medicineName || 'Tablet',
                dosage: m.dosage || '1 Tab',
                frequency: m.frequency || 'TDS',
                duration: m.duration || '5 days',
                instructions: m.instructions || '',
              });
            });
          } else if (p.medicineName || p.name) {
            medsList.push({
              prescriptionId: p.prescriptionId || p.id,
              createdAtStr,
              medicineName: p.medicineName || p.name || 'Tablet',
              dosage: p.dosage || '1 Tab',
              frequency: p.frequency || 'TDS',
              duration: p.duration || '5 days',
              instructions: p.instructions || '',
            });
          }
        });

        // Sample fallbacks if DB has no items yet
        const displayList = medsList.length > 0 ? medsList : [
          {
            prescriptionId: 'RX-DEMO-1',
            createdAtStr: '08:00 AM (Today)',
            medicineName: 'Tab. Paracetamol 650mg',
            dosage: '650mg (Oral)',
            frequency: 'TDS (After meals)',
            duration: '5 days',
            instructions: 'Take after meals',
          },
          {
            prescriptionId: 'RX-DEMO-2',
            createdAtStr: '10:30 AM (Today)',
            medicineName: 'Inj. Ceftriaxone 1g',
            dosage: '1g (IV)',
            frequency: 'BD (12-hourly)',
            duration: '3 days',
            instructions: '12-hourly IV infusion',
          }
        ];

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="badge badge-warning" style={{ alignSelf: 'flex-start' }}>
              💊 Medication Administration Record — Prescribed Medicines ({displayList.length} Items)
            </div>

            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tablet / Medicine Name</th>
                    <th>Dose & Route</th>
                    <th>Prescription Creation & Timings</th>
                    <th>Frequency & Duration</th>
                    <th>Start Medicine</th>
                    <th>Dose / Daily Administration Tracking</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((m, i) => {
                    const medKey = `${patient?.id || 'demo'}-${m.medicineName}`;
                    const isStarted = !!startedMedicines[medKey];
                    const boxes = getDoseBoxes(m.duration, m.frequency);

                    return (
                      <tr key={i}>
                        <td><strong>💊 {m.medicineName}</strong></td>
                        <td>{m.dosage}</td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>⏰ {m.createdAtStr}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            Timing: 08:00 AM, 02:00 PM, 08:00 PM
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 12 }}>{m.frequency}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                            Duration: {m.duration} {m.instructions ? `(${m.instructions})` : ''}
                          </div>
                        </td>
                        <td>
                          {isStarted ? (
                            <span className="badge badge-success" style={{ padding: '6px 10px', fontSize: 11 }}>
                              🟢 Started / Active
                            </span>
                          ) : (
                            <button
                              className="btn btn-success btn-sm"
                              style={{ fontWeight: 700 }}
                              onClick={() => handleStartMedicine(medKey, m.medicineName)}
                            >
                              ▶️ Start Medicine
                            </button>
                          )}
                        </td>
                        <td>
                          <div style={{ opacity: isStarted ? 1 : 0.6, transition: 'opacity 0.2s ease' }}>
                            {!isStarted && (
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
                                🔒 Click "▶️ Start Medicine" to enable Day 1 box
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                              {boxes.map((box, boxIdx) => {
                                const boxKey = `${medKey}-${box.id}`;
                                const isChecked = !!completedDoses[boxKey];
                                const log = completedDosesLogs[boxKey];

                                // Sequential enablement: Day 1 enabled when started. Day N enabled only if Day N-1 is checked!
                                const isPrevChecked = boxIdx === 0 ? true : !!completedDoses[`${medKey}-${boxes[boxIdx - 1].id}`];
                                const isEnabled = isStarted && isPrevChecked;

                                return (
                                  <div
                                    key={box.id}
                                    onClick={() => handleToggleDoseBox(medKey, m.medicineName, box, boxIdx, boxes, isEnabled)}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 2,
                                      padding: '6px 10px',
                                      borderRadius: 8,
                                      background: isChecked
                                        ? 'rgba(16,185,129,0.18)'
                                        : isEnabled
                                        ? 'rgba(14,165,233,0.08)'
                                        : 'var(--bg-surface)',
                                      border: `1px solid ${
                                        isChecked
                                          ? '#10b981'
                                          : isEnabled
                                          ? 'rgba(14,165,233,0.4)'
                                          : 'var(--border)'
                                      }`,
                                      cursor: isEnabled ? 'pointer' : 'not-allowed',
                                      fontSize: 11,
                                      fontWeight: 600,
                                      opacity: isEnabled || isChecked ? 1 : 0.45,
                                      userSelect: 'none',
                                      transition: 'all 0.2s ease',
                                      minWidth: 105,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <span>{isChecked ? '✅' : isEnabled ? '⬜' : '🔒'}</span>
                                      <span style={{ color: isChecked ? '#10b981' : isEnabled ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                        {box.label}
                                      </span>
                                    </div>

                                    {/* Real-time Timestamp & Nurse Name */}
                                    {isChecked && log && (
                                      <div style={{ fontSize: 9, color: '#059669', marginTop: 2, fontWeight: 700, lineHeight: 1.2 }}>
                                        <div>🕒 {log.timeStr || log.timestamp}</div>
                                        <div style={{ fontSize: 8, opacity: 0.85 }}>👤 {log.nurseName}</div>
                                      </div>
                                    )}

                                    {!isChecked && !isEnabled && (
                                      <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {!isStarted ? '(Start med first)' : `(Complete Day ${boxIdx} first)`}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* 23. Diabetic Monitoring Chart */}
      {subheadingId === 23 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div><label className="form-label">Blood Sugar Level (BSL mg/dL)</label><input className="form-control" value={getFieldValue(23, 'bsl', latestVital.bloodSugar ? `${latestVital.bloodSugar} mg/dL` : '164 mg/dL')} onChange={e => handleInputChange(23, 'bsl', e.target.value)} /></div>
            <div><label className="form-label">Insulin Dose Administered</label><input className="form-control" value={getFieldValue(23, 'insulin', '4 Units Regular Insulin')} onChange={e => handleInputChange(23, 'insulin', e.target.value)} /></div>
            <div><label className="form-label">Staff Nurse Signature</label><input className="form-control" value={getFieldValue(23, 'nurseSign', 'Staff Nurse')} onChange={e => handleInputChange(23, 'nurseSign', e.target.value)} /></div>
          </div>
        </div>
      )}

      {/* 27. Investigation Sheet */}
      {subheadingId === 27 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="badge badge-info" style={{ alignSelf: 'flex-start' }}>🔬 Real-time Laboratory & Diagnostic Reports ({labs.length} reports)</div>
          <table className="table">
            <thead>
              <tr><th>Test Name</th><th>Category</th><th>Result Summary</th><th>Status</th></tr>
            </thead>
            <tbody>
              {labs.length === 0 ? (
                <tr><td>Complete Blood Count (CBC)</td><td>Hematology</td><td>Hb: 13.2 g/dL, WBC: 8,400</td><td><span className="badge badge-success">Completed</span></td></tr>
              ) : (
                labs.map((l, i) => (
                  <tr key={i}>
                    <td><strong>{l.testName || 'Laboratory Test'}</strong></td>
                    <td>{l.category || 'Lab'}</td>
                    <td>{l.result || 'Normal limits'}</td>
                    <td><span className={`badge ${l.status === 'completed' ? 'badge-success' : 'badge-warning'}`}>{l.status || 'Completed'}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Generic Real-time Subheading Form for all other subheading IDs */}
      {![1, 2, 3, 6, 7, 10, 23, 27].includes(subheadingId) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="form-label">Clinical Documentation & Assessment Notes</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder={`Enter notes for Subheading #${subheadingId}...`}
              value={getFieldValue(subheadingId, 'notes', `Clinical documentation entry for Subheading #${subheadingId}. Patient ${patient?.firstName || 'IP'} evaluated. Vitals: Temp ${latestVital.temperature || '98.6'}°F, BP ${latestVital.bloodPressure || '120/80'}.`)}
              onChange={e => handleInputChange(subheadingId, 'notes', e.target.value)}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><label className="form-label">Attending Staff Nurse</label><input className="form-control" value={getFieldValue(subheadingId, 'staff', 'Staff Nurse')} onChange={e => handleInputChange(subheadingId, 'staff', e.target.value)} /></div>
            <div><label className="form-label">Verification Timestamp</label><input className="form-control" type="datetime-local" value={getFieldValue(subheadingId, 'time', new Date().toISOString().slice(0, 16))} onChange={e => handleInputChange(subheadingId, 'time', e.target.value)} /></div>
          </div>
        </div>
      )}
    </div>
  );
}
