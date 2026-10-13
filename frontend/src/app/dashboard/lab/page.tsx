'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';

export default function LabDashboard() {
  const [labTests, setLabTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'in_progress' | 'completed' | 'urgent'>(
    (tabParam && ['pending', 'in_progress', 'completed', 'urgent', 'all'].includes(tabParam) ? tabParam : 'all') as any
  );
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (tabParam && ['pending', 'in_progress', 'completed', 'urgent', 'all'].includes(tabParam)) {
      setActiveTab(tabParam as any);
    }
  }, [tabParam]);

  // New Test Request Modal
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({
    patientId: '',
    patientName: '',
    doctorName: '',
    testName: '',
    category: 'Pathology',
    sampleType: 'Blood',
    priority: 'NORMAL',
    notes: '',
  });

  // Result Recording Modal
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [resultForm, setResultForm] = useState({
    resultSummary: '',
    reportUrl: '',
    testValues: '',
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdf(true);
    toast.loading('Uploading report to Supabase...', { id: 'pdf-upload' });
    try {
      const formData = new FormData();
      formData.append('file', file);

      let reportUrl = '';
      if (selectedTest?.id) {
        const res = await api.post(`/lab/${selectedTest.id}/upload-report`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        reportUrl = res.data.reportUrl;
      } else {
        const res = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        reportUrl = res.data.url;
      }

      setResultForm((prev) => ({ ...prev, reportUrl }));
      toast.success('📄 PDF Report uploaded to Supabase successfully!', { id: 'pdf-upload' });
    } catch (err: any) {
      toast.error('Failed to upload PDF report', { id: 'pdf-upload' });
    } finally {
      setUploadingPdf(false);
    }
  };

  const loadLabTests = async () => {
    try {
      const { data } = await api.get('/lab');
      setLabTests(data);
    } catch (err: any) {
      console.error('Failed to load lab tests:', err);
    }
  };

  useEffect(() => {
    loadLabTests();
    const interval = setInterval(loadLabTests, 10000); // 10s auto-refresh for live status
    return () => clearInterval(interval);
  }, []);

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!orderForm.patientId || !orderForm.patientName || !orderForm.testName) {
      toast.error('Patient ID, Patient Name, and Test Name are required!');
      return;
    }
    setLoading(true);
    try {
      await api.post('/lab', orderForm);
      toast.success('🧪 New Lab Test requested successfully!');
      setShowOrderModal(false);
      setOrderForm({
        patientId: '',
        patientName: '',
        doctorName: '',
        testName: '',
        category: 'Pathology',
        sampleType: 'Blood',
        priority: 'NORMAL',
        notes: '',
      });
      loadLabTests();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to order lab test');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.put(`/lab/${id}/status`, { status });
      toast.success(`Lab Test status updated to ${status}`);
      loadLabTests();
    } catch (err: any) {
      toast.error('Failed to update status');
    }
  };

  const handleResultSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!selectedTest) return;
    if (!resultForm.resultSummary) {
      toast.error('Please enter a result summary');
      return;
    }
    setLoading(true);
    try {
      await api.put(`/lab/${selectedTest.id}/results`, resultForm);
      toast.success('✅ Lab Test results & report uploaded successfully!');
      setShowResultModal(false);
      setSelectedTest(null);
      setResultForm({ resultSummary: '', reportUrl: '', testValues: '' });
      loadLabTests();
    } catch (err: any) {
      toast.error('Failed to record lab results');
    } finally {
      setLoading(false);
    }
  };

  // Metrics
  // Metrics
  const totalCount = labTests.length;
  const pendingCount = labTests.filter((t) => (t.status || '').toUpperCase() === 'PENDING').length;
  const inProgressCount = labTests.filter((t) => (t.status || '').toUpperCase() === 'IN_PROGRESS').length;
  const completedCount = labTests.filter((t) => (t.status || '').toUpperCase() === 'COMPLETED').length;
  const urgentCount = labTests.filter((t) => (t.priority || '').toUpperCase() === 'URGENT').length;

  // Filtered List
  const filteredTests = labTests.filter((t) => {
    const matchesSearch =
      t.patientId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.patientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.testName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    const statusUpper = (t.status || '').toUpperCase();
    const priorityUpper = (t.priority || '').toUpperCase();

    if (activeTab === 'pending') return statusUpper === 'PENDING';
    if (activeTab === 'in_progress') return statusUpper === 'IN_PROGRESS';
    if (activeTab === 'completed') return statusUpper === 'COMPLETED';
    if (activeTab === 'urgent') return priorityUpper === 'URGENT';
    return true;
  });

  return (
    <DashboardLayout role="lab_technician">
      <div className="dashboard-content" style={{ padding: '24px' }}>
        {/* Top Header Banner */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '24px',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h1 style={{ fontSize: '26px', fontWeight: '800', margin: 0, color: 'var(--text-main, #0f172a)' }}>
              🧪 Laboratory & Diagnostics Portal
            </h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
              Manage pathology, biochemistry & radiology test orders, samples, and real-time patient lab reports
            </p>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowOrderModal(true)}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              fontWeight: 600,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#06b6d4',
              borderColor: '#0891b2',
            }}
          >
            ➕ New Lab Request
          </button>
        </div>

        {/* Metric Cards - Interactive Tabs */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '28px',
          }}
        >
          <div
            className="stat-card"
            onClick={() => setActiveTab('all')}
            style={{
              borderLeft: '4px solid #06b6d4',
              cursor: 'pointer',
              boxShadow: activeTab === 'all' ? '0 0 0 2px #06b6d4, 0 4px 12px rgba(6,182,212,0.2)' : undefined,
              transform: activeTab === 'all' ? 'translateY(-2px)' : undefined,
              transition: 'all 0.2s ease',
            }}
          >
            <div className="stat-value">{totalCount}</div>
            <div className="stat-label">Total Lab Orders</div>
          </div>
          <div
            className="stat-card"
            onClick={() => setActiveTab('pending')}
            style={{
              borderLeft: '4px solid #f59e0b',
              cursor: 'pointer',
              boxShadow: activeTab === 'pending' ? '0 0 0 2px #f59e0b, 0 4px 12px rgba(245,158,11,0.2)' : undefined,
              transform: activeTab === 'pending' ? 'translateY(-2px)' : undefined,
              transition: 'all 0.2s ease',
            }}
          >
            <div className="stat-value" style={{ color: activeTab === 'pending' ? '#d97706' : undefined }}>{pendingCount}</div>
            <div className="stat-label">Pending Samples</div>
          </div>
          <div
            className="stat-card"
            onClick={() => setActiveTab('in_progress')}
            style={{
              borderLeft: '4px solid #3b82f6',
              cursor: 'pointer',
              boxShadow: activeTab === 'in_progress' ? '0 0 0 2px #3b82f6, 0 4px 12px rgba(59,130,246,0.2)' : undefined,
              transform: activeTab === 'in_progress' ? 'translateY(-2px)' : undefined,
              transition: 'all 0.2s ease',
            }}
          >
            <div className="stat-value" style={{ color: activeTab === 'in_progress' ? '#2563eb' : undefined }}>{inProgressCount}</div>
            <div className="stat-label">Testing In-Progress</div>
          </div>
          <div
            className="stat-card"
            onClick={() => setActiveTab('completed')}
            style={{
              borderLeft: '4px solid #10b981',
              cursor: 'pointer',
              boxShadow: activeTab === 'completed' ? '0 0 0 2px #10b981, 0 4px 12px rgba(16,185,129,0.2)' : undefined,
              transform: activeTab === 'completed' ? 'translateY(-2px)' : undefined,
              transition: 'all 0.2s ease',
            }}
          >
            <div className="stat-value" style={{ color: activeTab === 'completed' ? '#059669' : undefined }}>{completedCount}</div>
            <div className="stat-label">Completed Today</div>
          </div>
          <div
            className="stat-card"
            onClick={() => setActiveTab('urgent')}
            style={{
              borderLeft: '4px solid #ef4444',
              cursor: 'pointer',
              boxShadow: activeTab === 'urgent' ? '0 0 0 2px #ef4444, 0 4px 12px rgba(239,68,68,0.2)' : undefined,
              transform: activeTab === 'urgent' ? 'translateY(-2px)' : undefined,
              transition: 'all 0.2s ease',
            }}
          >
            <div className="stat-value" style={{ color: activeTab === 'urgent' ? '#dc2626' : undefined }}>{urgentCount}</div>
            <div className="stat-label">Urgent Priority</div>
          </div>
        </div>

        {/* Tab & Search Bar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
            backgroundColor: 'var(--card-bg, #ffffff)',
            padding: '12px 16px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['all', 'pending', 'in_progress', 'completed', 'urgent'] as const).map((tabKey) => (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === tabKey ? '#06b6d4' : '#f1f5f9',
                  color: activeTab === tabKey ? '#ffffff' : '#475569',
                  transition: 'all 0.2s ease',
                }}
              >
                {tabKey === 'all' && '📋 All Tests'}
                {tabKey === 'pending' && `⏳ Pending (${pendingCount})`}
                {tabKey === 'in_progress' && `🔬 In Progress (${inProgressCount})`}
                {tabKey === 'completed' && `✅ Completed (${completedCount})`}
                {tabKey === 'urgent' && `🚨 Urgent (${urgentCount})`}
              </button>
            ))}
          </div>

          <div style={{ minWidth: '260px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search Patient, ID, or Test..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                width: '100%',
              }}
            />
          </div>
        </div>

        {/* Tests Table */}
        <div
          style={{
            backgroundColor: 'var(--card-bg, #ffffff)',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '14px 16px' }}>Patient Details</th>
                <th style={{ padding: '14px 16px' }}>Test Name & Category</th>
                <th style={{ padding: '14px 16px' }}>Sample Type</th>
                <th style={{ padding: '14px 16px' }}>Priority</th>
                <th style={{ padding: '14px 16px' }}>Status</th>
                <th style={{ padding: '14px 16px' }}>Results & Summary</th>
                <th style={{ padding: '14px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTests.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔍</div>
                    <p style={{ margin: 0, fontWeight: 500 }}>No lab test records found matching filters.</p>
                  </td>
                </tr>
              ) : (
                filteredTests.map((test) => {
                  const isDischarged = test.patientStatus === 'discharged';
                  return (
                    <tr
                      key={test.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        backgroundColor: isDischarged ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
                      }}
                    >
                      {/* Patient Details */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{test.patientName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          ID: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{test.patientId}</span>
                        </div>
                        {isDischarged && (
                          <span
                            style={{
                              display: 'inline-block',
                              marginTop: '4px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 800,
                              backgroundColor: '#fee2e2',
                              color: '#991b1b',
                              border: '1px solid #fca5a5',
                            }}
                          >
                            🚨 DISCHARGED PATIENT
                          </span>
                        )}
                      </td>

                      {/* Test Name */}
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{test.testName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          Category: {test.category || 'Pathology'} • Ref: {test.orderedBy || 'Doctor'}
                        </div>
                      </td>

                      {/* Sample Type */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                          }}
                        >
                          🩸 {test.sampleType || 'Blood'}
                        </span>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '11px',
                            fontWeight: 700,
                            backgroundColor: test.priority === 'URGENT' ? '#fee2e2' : '#e0f2fe',
                            color: test.priority === 'URGENT' ? '#dc2626' : '#0284c7',
                          }}
                        >
                          {test.priority === 'URGENT' ? '🔥 URGENT' : '🟢 NORMAL'}
                        </span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '14px 16px' }}>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 700,
                            backgroundColor:
                              test.status === 'COMPLETED'
                                ? '#dcfce7'
                                : test.status === 'IN_PROGRESS'
                                ? '#dbeafe'
                                : '#fef3c7',
                            color:
                              test.status === 'COMPLETED'
                                ? '#166534'
                                : test.status === 'IN_PROGRESS'
                                ? '#1e40af'
                                : '#92400e',
                          }}
                        >
                          {test.status === 'COMPLETED' && '✅ COMPLETED'}
                          {test.status === 'IN_PROGRESS' && '🔬 IN PROGRESS'}
                          {test.status === 'PENDING' && '⏳ PENDING'}
                          {test.status === 'CANCELLED' && '❌ CANCELLED'}
                        </span>
                      </td>

                      {/* Results & Summary */}
                      <td style={{ padding: '14px 16px', maxWidth: '280px' }}>
                        {test.resultSummary ? (
                          <div>
                            <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 500 }}>{test.resultSummary}</div>
                            {test.reportUrl && (
                              <a
                                href={test.reportUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  fontSize: '12px',
                                  color: '#0284c7',
                                  fontWeight: 600,
                                  textDecoration: 'underline',
                                  marginTop: '4px',
                                  display: 'inline-block',
                                }}
                              >
                                📄 View Uploaded Report
                              </a>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>Awaiting lab findings...</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          {test.status === 'PENDING' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleStatusChange(test.id, 'IN_PROGRESS')}
                              style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#e0f2fe', color: '#0369a1' }}
                            >
                              🔬 Start Test
                            </button>
                          )}
                          {test.status !== 'COMPLETED' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => {
                                setSelectedTest(test);
                                setResultForm({
                                  resultSummary: test.resultSummary || '',
                                  reportUrl: test.reportUrl || '',
                                  testValues: test.testValues || '',
                                });
                                setShowResultModal(true);
                              }}
                              style={{ fontSize: '12px', padding: '4px 10px', backgroundColor: '#06b6d4' }}
                            >
                              📝 Enter Results
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Request New Lab Test */}
      {showOrderModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                🧪 Order New Lab Test
              </h2>
              <button
                onClick={() => setShowOrderModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOrderSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Patient ID *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. NMH26000000"
                    value={orderForm.patientId}
                    onChange={(e) => setOrderForm({ ...orderForm, patientId: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Robert Vance"
                    value={orderForm.patientName}
                    onChange={(e) => setOrderForm({ ...orderForm, patientName: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Test Name *
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Lipid Profile / CBC"
                    value={orderForm.testName}
                    onChange={(e) => setOrderForm({ ...orderForm, testName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    className="form-control"
                    value={orderForm.category}
                    onChange={(e) => setOrderForm({ ...orderForm, category: e.target.value })}
                  >
                    <option value="Pathology">Pathology</option>
                    <option value="Biochemistry">Biochemistry</option>
                    <option value="Microbiology">Microbiology</option>
                    <option value="Radiology">Radiology</option>
                    <option value="Hematology">Hematology</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Sample Type
                  </label>
                  <select
                    className="form-control"
                    value={orderForm.sampleType}
                    onChange={(e) => setOrderForm({ ...orderForm, sampleType: e.target.value })}
                  >
                    <option value="Blood">Blood</option>
                    <option value="Urine">Urine</option>
                    <option value="Swab">Swab</option>
                    <option value="Sputum">Sputum</option>
                    <option value="Tissue">Tissue</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    Priority
                  </label>
                  <select
                    className="form-control"
                    value={orderForm.priority}
                    onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })}
                  >
                    <option value="NORMAL">🟢 Normal</option>
                    <option value="URGENT">🔥 Urgent</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Ordering Doctor Name
                </label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Dr. Sarah Jenkins"
                  value={orderForm.doctorName}
                  onChange={(e) => setOrderForm({ ...orderForm, doctorName: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Instructions / Clinical Notes
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Fasting sample required..."
                  value={orderForm.notes}
                  onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowOrderModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#06b6d4' }} disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Lab Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Record Test Results */}
      {showResultModal && selectedTest && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '540px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0f172a' }}>
                  📝 Record Test Results
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Test: <strong>{selectedTest.testName}</strong> | Patient: <strong>{selectedTest.patientName}</strong> ({selectedTest.patientId})
                </p>
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {selectedTest.patientStatus === 'discharged' && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#991b1b',
                  fontSize: '13px',
                  fontWeight: 600,
                  marginBottom: '16px',
                }}
              >
                ⚠️ Note: This patient has already been <strong>DISCHARGED</strong>. Results will still be filed to their permanent medical record.
              </div>
            )}

            <form onSubmit={handleResultSubmit}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Result Summary & Metric Findings *
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  placeholder="e.g. Hemoglobin: 13.5 g/dL (Normal), WBC: 7,200/uL, Platelets: 240,000/uL"
                  value={resultForm.resultSummary}
                  onChange={(e) => setResultForm({ ...resultForm, resultSummary: e.target.value })}
                  required
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Supabase Cloud PDF Report (Upload or Link)
                </label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="url"
                    className="form-control"
                    placeholder="Supabase storage URL or paste link"
                    value={resultForm.reportUrl}
                    onChange={(e) => setResultForm({ ...resultForm, reportUrl: e.target.value })}
                    style={{ flex: 1 }}
                  />
                  <label
                    className="btn btn-secondary"
                    style={{
                      cursor: uploadingPdf ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '8px 12px',
                      fontSize: '12px',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                    }}
                  >
                    {uploadingPdf ? '⏳ Uploading...' : '📁 Upload PDF'}
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      disabled={uploadingPdf}
                    />
                  </label>
                </div>
                {resultForm.reportUrl && (
                  <div style={{ marginTop: '6px' }}>
                    <a
                      href={resultForm.reportUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: '12px', color: '#0284c7', textDecoration: 'underline' }}
                    >
                      🔗 Preview Uploaded Supabase PDF
                    </a>
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                  Detailed Value Metrics (JSON or Key-Value)
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder='{"Glucose": "95 mg/dL", "Creatinine": "0.9 mg/dL"}'
                  value={resultForm.testValues}
                  onChange={(e) => setResultForm({ ...resultForm, testValues: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowResultModal(false)}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981' }} disabled={loading}>
                  {loading ? 'Saving...' : '✅ Save & Mark Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
