'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CenteredLoader from '@/components/CenteredLoader';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminPatientsPage() {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.get('/patients')
      .then(({ data }) => setPatients(data))
      .catch(() => toast.error('Failed to load patient records'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = patients.filter((p) =>
    p.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    p.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    p.mrn?.toLowerCase().includes(search.toLowerCase()) ||
    p.bloodGroup?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <CenteredLoader message="Loading Hospital Patient Database..." subtext="Syncing electronic health records (EHR)" />;
  }

  return (
    <DashboardLayout role="admin" title="Patient EHR Database">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Patient Electronic Health Records</h2>
          <p>System-wide patient database and medical history entries.</p>
        </div>
      </div>

      <div className="action-bar mb-4">
        <div className="search-bar">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search by MRN, patient name, blood group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏥 Registered Hospital Patients ({filtered.length})</h3>
        </div>
        <div className="card-body p-0">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>MRN</th>
                  <th>Patient Name</th>
                  <th>Age / Gender</th>
                  <th>Blood Group</th>
                  <th>Phone</th>
                  <th>Registration Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No patient records found in database.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => (
                    <tr key={p.id}>
                      <td><code style={{ color: 'var(--primary-light)' }}>{p.mrn}</code></td>
                      <td className="font-semibold">{p.firstName} {p.lastName}</td>
                      <td>{p.age || 'N/A'} yrs / {p.gender || 'N/A'}</td>
                      <td>
                        <span className="badge badge-danger">{p.bloodGroup || 'Unknown'}</span>
                      </td>
                      <td>{p.phone || '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {new Date(p.createdAt || Date.now()).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
