'use client';
import { useEffect, useState, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CenteredLoader from '@/components/CenteredLoader';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────
type RoleKey = 'admin' | 'receptionist' | 'nurse' | 'doctor' | 'pharmacist' | 'management' | 'patient';

interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleKey;
  phone: string;
  department: string;
  dutyType?: string;
  isActive: boolean;
  isApproved: boolean;
  permissions: string[];
  createdAt: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  department?: string;
  phone?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROLE_META: Record<RoleKey, { label: string; badge: string; color: string; bg: string; dashboard: string }> = {
  admin: { label: 'IT Admin', badge: 'badge-purple', color: '#a78bfa', bg: 'rgba(139,92,246,0.15)', dashboard: '' },
  receptionist: { label: 'Receptionist', badge: 'badge-info', color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', dashboard: '' },
  nurse: { label: 'Nurse', badge: 'badge-success', color: '#34d399', bg: 'rgba(16,185,129,0.15)', dashboard: '' },
  doctor: { label: 'Doctor', badge: 'badge-purple', color: '#f472b6', bg: 'rgba(236,72,153,0.15)', dashboard: '' },
  pharmacist: { label: 'Pharmacist', badge: 'badge-warning', color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', dashboard: '' },
  management: { label: 'Management', badge: 'badge-danger', color: '#f87171', bg: 'rgba(239,68,68,0.15)', dashboard: '' },
  patient: { label: 'Patient', badge: 'badge-gray', color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', dashboard: '' },
};

const DEFAULT_ROLE_META = {
  label: 'Employee',
  badge: 'badge-gray',
  color: '#94a3b8',
  bg: 'rgba(148,163,184,0.15)',
  dashboard: '/dashboard',
};

function getRoleMeta(role?: string) {
  if (!role) return DEFAULT_ROLE_META;
  const key = role.toLowerCase() as RoleKey;
  if (ROLE_META[key]) return ROLE_META[key];
  return {
    label: role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    badge: 'badge-gray',
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.15)',
    dashboard: '/dashboard',
  };
}

const DEPARTMENTS: Record<RoleKey, string[]> = {
  admin: [
    'Administration',
  ],

  receptionist: [
    'Reception',
    'OPD',
  ],

  nurse: [
    'Emergency & Triage',
    'ICU',
    'General Ward',
    'Surgery',
    'Pediatrics',
  ],

  doctor: [
    'General',
    'Cardiology',
    'Neurology',
    'Orthopedics',
    'Pediatrics',
    'Radiology',
    'Surgery',
    'Oncology',
  ],

  pharmacist: [
    'Pharmacy',
  ],

  management: [
    'Management',
  ],

  patient: [
    'Patient',
  ],
};

function getDepartmentsForRole(role?: string): string[] {
  if (!role) return ['General'];
  const key = role.toLowerCase() as RoleKey;
  return DEPARTMENTS[key] || ['General'];
}
const BLANK_FORM = {
  firstName: '', lastName: '', email: '', password: '',
  role: 'receptionist' as RoleKey, department: '', phone: '',
  isActive: true, isApproved: true,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
// function validate(form: typeof BLANK_FORM, isNew: boolean): FormErrors {
//   const errors: FormErrors = {};
//   if (!form.firstName.trim()) errors.firstName = 'First name is required';
//   if (!form.lastName.trim()) errors.lastName = 'Last name is required';
//   if (!form.email.trim()) errors.email = 'Email is required';
//   else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
//     errors.email = 'Enter a valid email address';
//   if (isNew && !form.password) errors.password = 'Password is required for new accounts';
//   if (form.phone && !/^\+?[\d\s\-()]{7,15}$/.test(form.phone))
//     errors.phone = 'Enter a valid phone number';
//   return errors;
// }
function validate(
  form: typeof BLANK_FORM,
  isNew: boolean,
): FormErrors {

  const errors: FormErrors = {};

  if (!form.firstName.trim()) {
    errors.firstName = 'First name is required';
  }

  if (!form.lastName.trim()) {
    errors.lastName = 'Last name is required';
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required';
  } else if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
  ) {
    errors.email = 'Enter a valid email address';
  }

  if (isNew && !form.password.trim()) {
    errors.password = 'Password is required';
  }

  if (!form.phone.trim()) {
    errors.phone = 'Phone number is required';
  } else if (
    !/^\+?[\d\s\-()]{7,15}$/.test(form.phone)
  ) {
    errors.phone = 'Enter a valid phone number';
  }

  if (!form.department) {
    errors.department = 'Department is required';
  }

  return errors;
}
import type { ReactNode } from 'react';

type FieldProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

function F({ label, error, children }: FieldProps) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>

      {children}

      {error && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--danger)',
            marginTop: 2,
          }}
        >
          ⚠ {error}
        </span>
      )}
    </div>
  );
}
// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  // data
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // search / filter
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | RoleKey>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'pending'>('all');
  const [sortField, setSortField] = useState<'name' | 'role' | 'department' | 'createdAt'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // panels / modals
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [resetTarget, setResetTarget] = useState<UserItem | null>(null);
  const [dbResetModal, setDbResetModal] = useState(false);

  // form
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [actionLoading, setActionLoading] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await api.get<UserItem[]>('/users');
      setUsers(data);
    } catch {
      toast.error('Failed to load employee directory from backend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const filtered = users
    .filter(u => {
      const q = search.toLowerCase();
      if (q && !(
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.department || '').toLowerCase().includes(q) ||
        (u.phone || '').includes(q)
      )) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'suspended' && u.isActive) return false;
      if (statusFilter === 'pending' && u.isApproved !== false) return false;
      return true;
    })
    .sort((a, b) => {
      let va: string, vb: string;
      if (sortField === 'name') { va = `${a.firstName}${a.lastName}`; vb = `${b.firstName}${b.lastName}`; }
      else if (sortField === 'role') { va = a.role; vb = b.role; }
      else if (sortField === 'department') { va = a.department || ''; vb = b.department || ''; }
      else { va = a.createdAt; vb = b.createdAt; }
      return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const pendingCount = users.filter(u => u.isApproved === false).length;
  const activeCount = users.filter(u => u.isActive).length;
  const suspendedCount = users.filter(u => !u.isActive).length;

  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  }
  function sortIcon(field: typeof sortField) {
    if (sortField !== field) return ' ⇅';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  // ── CRUD handlers ─────────────────────────────────────────────────────────
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(form, true);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    setActionLoading(true);
    try {
      await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        role: form.role,
        department: form.department,
        phone: form.phone,
        isApproved: form.isApproved,
      });
      toast.success(`✅ Employee "${form.firstName} ${form.lastName}" created → redirects to ${getRoleMeta(form.role).dashboard}`);
      setForm({ ...BLANK_FORM });
      setShowCreatePanel(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create employee account');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    const editForm = {
      firstName: editUser.firstName,
      lastName: editUser.lastName,
      email: editUser.email,
      password: '',
      role: editUser.role,
      department: editUser.department,
      phone: editUser.phone,
      isActive: editUser.isActive,
      isApproved: editUser.isApproved,
    };
    const errors = validate(editForm, false);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    setActionLoading(true);
    try {
      await api.put(`/users/${editUser.id}`, {
        firstName: editUser.firstName,
        lastName: editUser.lastName,
        role: editUser.role,
        department: editUser.department,
        phone: editUser.phone,
        isActive: editUser.isActive,
        isApproved: editUser.isApproved,
      });
      toast.success(`✅ Employee "${editUser.firstName} ${editUser.lastName}" updated`);
      setEditUser(null);
      fetchUsers();
    } catch {
      toast.error('Failed to update employee details');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading(true);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success(`🗑️ Employee "${deleteTarget.email}" permanently deleted`);
      setDeleteTarget(null);
      fetchUsers();
    } catch {
      toast.error('Failed to delete user from database');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetTarget) return;
    setActionLoading(true);
    try {
      await api.post(`/users/${resetTarget.id}/reset-password`, { newPassword: 'demo123' });
      toast.success(`🔑 Password reset to "demo123" for ${resetTarget.email}`);
      setResetTarget(null);
    } catch {
      toast.error('Failed to reset password');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (user: UserItem) => {
    try {
      await api.post(`/users/${user.id}/approve`);
      toast.success(`✅ ${user.email} approved for system login`);
      fetchUsers();
    } catch {
      toast.error('Failed to approve user');
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      await api.put(`/users/${user.id}`, { isActive: !user.isActive });
      toast.success(`Account ${!user.isActive ? 'activated' : 'suspended'}: ${user.email}`);
      fetchUsers();
    } catch {
      toast.error('Failed to toggle account status');
    }
  };

  const handleClearDatabase = async () => {
    setActionLoading(true);
    try {
      await api.post('/users/clear-database');
      toast.success('🛢️ Database reset — default logins restored');
      setDbResetModal(false);
      fetchUsers();
    } catch {
      toast.error('Failed to reset database');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  // const F = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
  //   <div className="form-group">
  //     <label className="form-label">{label}</label>
  //     {children}
  //     {error && <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 2 }}>⚠ {error}</span>}
  //   </div>
  // );

  if (loading) {
    return <CenteredLoader message="Loading IT Admin Hub..." subtext="Syncing employee directory & hospital database" />;
  }

  return (
    <DashboardLayout role="admin" title="IT Admin — Employee Management">
      {/* ══ PAGE HEADER ══════════════════════════════════════════════════════ */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            🏥 Employee Management Dashboard
          </h2>
          <p>Create accounts, assign roles, manage access, reset passwords and control database entries.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => { setShowCreatePanel(true); setForm({ ...BLANK_FORM }); setFormErrors({}); }}>
            ➕ Add New Employee
          </button>
          <Link href="/dashboard/admin/users" className="btn btn-secondary btn-sm">
            📋 Full User Directory
          </Link>
          <button className="btn btn-danger btn-sm" onClick={() => setDbResetModal(true)}>
            🛢️ Reset DB
          </button>
        </div>
      </div>

      {/* ══ STATS ════════════════════════════════════════════════════════════ */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))' }}>
        {([
          { icon: '👥', val: users.length, label: 'Total Accounts', sub: 'All roles', grad: 'linear-gradient(135deg,#6366f1,#0ea5e9)' },
          { icon: '✅', val: activeCount, label: 'Active Employees', sub: 'Can login & use system', grad: 'linear-gradient(135deg,#10b981,#14b8a6)' },
          { icon: '⏳', val: pendingCount, label: 'Pending Approvals', sub: pendingCount > 0 ? '⚠ Needs attention' : 'All clear', grad: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
          { icon: '🚫', val: suspendedCount, label: 'Suspended', sub: 'Blocked from login', grad: 'linear-gradient(135deg,#ef4444,#f43f5e)' },
          { icon: '🔑', val: '6 Roles', label: 'Role Engine', sub: 'Email → Dashboard', grad: 'linear-gradient(135deg,#8b5cf6,#6366f1)' },
        ] as const).map((s, i) => (
          <div className="stat-card" key={i} style={{ '--gradient': s.grad } as any}>
            <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.07)', fontSize: 22 }}>{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)', fontSize: 11 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* ══ ROLE BREAKDOWN ═══════════════════════════════════════════════════ */}
      <div className="card mb-4">
        <div className="card-header">
          <h3 className="card-title">🔐 Role Distribution — Email Auto-Redirect Map</h3>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click a role badge to filter the table below</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {(Object.keys(ROLE_META) as RoleKey[]).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(roleFilter === r ? 'all' : r)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px', borderRadius: 12,
                background: roleFilter === r ? ROLE_META[r].bg : 'var(--bg-surface)',
                border: `1px solid ${roleFilter === r ? ROLE_META[r].color : 'var(--border)'}`,
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: ROLE_META[r].color }}>{ROLE_META[r].label}</span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> {ROLE_META[r].dashboard}</span>
              </div>
              <span style={{
                minWidth: 28, height: 28, borderRadius: '50%',
                background: ROLE_META[r].bg, border: `1px solid ${ROLE_META[r].color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: ROLE_META[r].color,
              }}>
                {roleCounts[r] || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ PENDING APPROVALS ALERT ══════════════════════════════════════════ */}
      {pendingCount > 0 && (
        <div className="card mb-4" style={{ border: '1px solid rgba(245,158,11,0.5)', background: 'rgba(245,158,11,0.04)' }}>
          <div className="card-header" style={{ background: 'rgba(245,158,11,0.08)' }}>
            <h3 className="card-title" style={{ color: '#fbbf24' }}>⚠️ {pendingCount} Employee Account(s) Awaiting Approval</h3>
            <button className="btn btn-warning btn-sm" onClick={() => setStatusFilter('pending')}>View Pending</button>
          </div>
          <div className="card-body p-0">
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>Email</th><th>Role Requested</th><th>Department</th><th>Joined</th><th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => u.isApproved === false).map(u => (
                    <tr key={u.id}>
                      <td className="font-semibold">{u.firstName} {u.lastName}</td>
                      <td><code style={{ fontSize: 12 }}>{u.email}</code></td>
                      <td><span className={`badge ${getRoleMeta(u.role).badge}`}>{getRoleMeta(u.role).label}</span></td>
                      <td>{u.department || '—'}</td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-success btn-sm" onClick={() => handleApprove(u)}>✓ Approve</button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditUser(u)}>✏️ Edit Role</button>
                          <button className="btn btn-danger btn-sm" onClick={() => setDeleteTarget(u)}>🗑️ Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══ SEARCH + FILTER BAR ══════════════════════════════════════════════ */}
      <div className="action-bar mb-4">
        <div className="search-bar" style={{ flex: 1, maxWidth: 420 }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search by name, email, department, phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>×</button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="form-control" style={{ width: 160 }} value={roleFilter} onChange={e => setRoleFilter(e.target.value as any)}>
            <option value="all">All Roles ({users.length})</option>
            {(Object.keys(ROLE_META) as RoleKey[]).map(r => (
              <option key={r} value={r}>{getRoleMeta(r).label} ({roleCounts[r] || 0})</option>
            ))}
          </select>
          <select className="form-control" style={{ width: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}>
            <option value="all">All Statuses</option>
            <option value="active">Active ({activeCount})</option>
            <option value="suspended">Suspended ({suspendedCount})</option>
            <option value="pending">Pending ({pendingCount})</option>
          </select>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Showing <strong>{filtered.length}</strong> of <strong>{users.length}</strong>
          </span>
        </div>
      </div>

      {/* ══ EMPLOYEE TABLE ═══════════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">👥 Employee Directory ({filtered.length})</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sort by:</span>
            {(['name', 'role', 'department', 'createdAt'] as const).map(f => (
              <button key={f} type="button" onClick={() => toggleSort(f)}
                className="btn btn-secondary btn-sm" style={{ fontSize: 11, padding: '3px 8px' }}>
                {f === 'createdAt' ? 'Date' : f.charAt(0).toUpperCase() + f.slice(1)}{sortIcon(f)}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body p-0">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Employee</th>
                  <th>Email / Login ID</th>
                  <th>Role </th>
                  <th>Department</th>
                  <th>Phone</th>
                  <th>Account Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <div className="empty-state" style={{ padding: '50px 20px' }}>
                        <div className="empty-icon">🔎</div>
                        <h3>No employees found</h3>
                        <p>Try adjusting the search or filters. Or create a new employee account.</p>
                        <button className="btn btn-primary" style={{ marginTop: 16 }}
                          onClick={() => { setShowCreatePanel(true); setSearch(''); setRoleFilter('all'); }}>
                          ➕ Add First Employee
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((u, idx) => {
                    const meta = getRoleMeta(u.role);
                    return (
                      <tr key={u.id}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{idx + 1}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                              background: meta.bg, border: `1px solid ${meta.color}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, fontWeight: 800, color: meta.color,
                            }}>
                              {u.firstName[0]}{u.lastName[0]}
                            </div>
                            <div>
                              <div className="font-semibold" style={{ fontSize: 13 }}>{u.firstName} {u.lastName}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {new Date(u.createdAt).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td><code style={{ fontSize: 12 }}>{u.email}</code></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <span className={`badge ${meta.badge}`} style={{ alignSelf: 'flex-start' }}>
                              {meta.label}
                            </span>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}> {meta.dashboard}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 13 }}>{u.department || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td style={{ fontSize: 13 }}>{u.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                              {u.isActive ? '● Active' : '● Suspended'}
                            </span>
                            <span className={`badge ${u.isApproved !== false ? 'badge-info' : 'badge-warning'}`}>
                              {u.isApproved !== false ? '✓ Approved' : '⏳ Pending'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" title="Edit employee details" onClick={() => { setEditUser(u); setFormErrors({}); }}>✏️</button>
                            <button className="btn btn-secondary btn-sm" title="Reset password to demo123" onClick={() => setResetTarget(u)}>🔑</button>
                            <button className={`btn btn-sm ${u.isActive ? 'btn-warning' : 'btn-success'}`}
                              title={u.isActive ? 'Suspend account' : 'Activate account'}
                              onClick={() => handleToggleActive(u)}>
                              {u.isActive ? '🚫' : '✓'}
                            </button>
                            {u.isApproved === false && (
                              <button className="btn btn-success btn-sm" title="Approve login access" onClick={() => handleApprove(u)}>✅</button>
                            )}
                            <button className="btn btn-danger btn-sm" title="Delete permanently" onClick={() => setDeleteTarget(u)}>🗑️</button>
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
      </div>

      {/* ══ CREATE EMPLOYEE SLIDE-OVER PANEL ═════════════════════════════════ */}
      {showCreatePanel && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, backdropFilter: 'blur(4px)' }}
            onClick={() => setShowCreatePanel(false)} />
          <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, maxWidth: '95vw',
            background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
            zIndex: 1001, overflowY: 'auto', boxShadow: 'var(--shadow-lg)',
            animation: 'slideLeft 0.3s ease',
          }}>
            <style>{`@keyframes slideLeft { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 2 }}>
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>➕ Create Employee Account</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>New account will be active immediately with selected role & dashboard.</p>
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setShowCreatePanel(false)}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Name row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="First Name *" error={formErrors.firstName}>
                  <input type="text" className="form-control" placeholder="e.g. John"
                    value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                    style={{ borderColor: formErrors.firstName ? 'var(--danger)' : undefined }} />
                </F>
                <F label="Last Name *" error={formErrors.lastName}>
                  <input type="text" className="form-control" placeholder="e.g. Smith"
                    value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                    style={{ borderColor: formErrors.lastName ? 'var(--danger)' : undefined }} />
                </F>
              </div>

              <F label="Email Address * (Login ID)" error={formErrors.email}>
                <input type="email" className="form-control" placeholder="employee@gmail.com"
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  style={{ borderColor: formErrors.email ? 'var(--danger)' : undefined }} />
              </F>

              <F label="Default Password *" error={formErrors.password}>
                <input type="password" className="form-control" placeholder="Minimum 6 characters"
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                  style={{ borderColor: formErrors.password ? 'var(--danger)' : undefined }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  Employee must change password on first login. Default: demo123
                </span>
              </F>

              {/* Role + Department */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <F label="Assigned Role *">
                  <select className="form-control" value={form.role}
                    // onChange={e => setForm({ ...form, role: e.target.value as RoleKey })}>
                    onChange={e => {
                      const newRole = e.target.value as RoleKey;
                      setForm({
                        ...form,
                        role: newRole,
                        department:
                          getDepartmentsForRole(newRole).length === 1
                            ? getDepartmentsForRole(newRole)[0]
                            : '',
                      });
                    }} >
                    {(Object.keys(ROLE_META) as RoleKey[]).map(r => (
                      <option key={r} value={r}>{getRoleMeta(r).label}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    → Redirects to {getRoleMeta(form.role).dashboard}
                  </span>
                </F>
                <F label="Department *" error={formErrors.department}>
                  <select className="form-control" value={form.department} required
                    onChange={e => setForm({ ...form, department: e.target.value })}>
                    <option value="">— Select Department —</option>
                    {getDepartmentsForRole(form.role).map(department => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                </F>
              </div>

              <F label="Phone Number *" error={formErrors.phone}>
                <input type="tel" className="form-control" placeholder="+99 1234567890"
                  value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                  style={{ borderColor: formErrors.phone ? 'var(--danger)' : undefined, background: 'var(--bg-surface)', color: 'var(--text-primary)' }} />
              </F>

              {/* Status toggles */}
              <div style={{ background: 'var(--bg-surface)', borderRadius: 12, padding: '14px 16px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                  Account Access & Approval
                </div>
                <div style={{ display: 'flex', gap: 24 }}>
                  {([
                    { key: 'isActive', label: 'Account Active', hint: 'Can login right away' },
                    { key: 'isApproved', label: 'Pre-Approved by Admin', hint: 'Skip approval queue' },
                  ] as const).map(({ key, label, hint }) => (
                    <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2, cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="checkbox" checked={form[key] as boolean}
                          onChange={e => setForm({ ...form, [key]: e.target.checked })} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{label}</span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 20 }}>{hint}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Role preview card */}
              <div style={{ background: getRoleMeta(form.role).bg, border: `1px solid ${getRoleMeta(form.role).color}`, borderRadius: 12, padding: '12px 16px' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: getRoleMeta(form.role).color, marginBottom: 4 }}>
                  Role Preview
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                  After login, <strong>{form.email || 'this employee'}</strong> will be automatically redirected to:
                </div>
                <code style={{ fontSize: 13, color: getRoleMeta(form.role).color, marginTop: 4, display: 'block' }}>
                  {getRoleMeta(form.role).dashboard}
                </code>
              </div>

              <div style={{ display: 'flex', gap: 10, paddingTop: 8 }}>
                <button type="submit" className="btn btn-primary flex-1" disabled={actionLoading}>
                  {actionLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating Account…
                    </span>
                  ) : '➕ Create Employee Account'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => { setForm({ ...BLANK_FORM }); setFormErrors({}); }}>
                  Reset
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* ══ EDIT MODAL ════════════════════════════════════════════════════════ */}
      {editUser && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: 17, fontWeight: 700 }}>✏️ Edit Employee — {editUser.email}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Changes are saved immediately to the database.</p>
              </div>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditUser(null)}>✕</button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body form-grid">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <F label="First Name *" error={formErrors.firstName}>
                    <input type="text" className="form-control" value={editUser.firstName}
                      onChange={e => setEditUser({ ...editUser, firstName: e.target.value })} required />
                  </F>
                  <F label="Last Name *" error={formErrors.lastName}>
                    <input type="text" className="form-control" value={editUser.lastName}
                      onChange={e => setEditUser({ ...editUser, lastName: e.target.value })} required />
                  </F>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <F label="Assigned Role *">
                    <select className="form-control" value={editUser.role}
                      onChange={e => setEditUser({ ...editUser, role: e.target.value as RoleKey })}>
                      {(Object.keys(ROLE_META) as RoleKey[]).map(r => (
                        <option key={r} value={r}>{getRoleMeta(r).label}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→ {getRoleMeta(editUser.role).dashboard}</span>
                  </F>
                  <F label="Department *" error={formErrors.department} >
                    <select className="form-control" value={editUser.department} required
                      onChange={e => setEditUser({ ...editUser, department: e.target.value, })}
                    >
                      <option value="">— Select Department —</option>
                      {getDepartmentsForRole(editUser.role).map(
                        department => (
                          <option
                            key={department}
                            value={department}
                          >
                            {department}
                          </option>
                        ),
                      )}
                    </select>
                  </F>
                </div>

                <F label="Phone">
                  <input type="tel" className="form-control" value={editUser.phone || ''}
                    onChange={e => setEditUser({ ...editUser, phone: e.target.value })} />
                </F>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <F label="Approval Status">
                    <select className="form-control"
                      value={editUser.isApproved !== false ? 'approved' : 'pending'}
                      onChange={e => setEditUser({ ...editUser, isApproved: e.target.value === 'approved' })}>
                      <option value="approved">✓ Approved for Login</option>
                      <option value="pending">⏳ Pending Approval</option>
                    </select>
                  </F>
                  <F label="Account Status">
                    <select className="form-control"
                      value={editUser.isActive ? 'active' : 'suspended'}
                      onChange={e => setEditUser({ ...editUser, isActive: e.target.value === 'active' })}>
                      <option value="active">● Active</option>
                      <option value="suspended">🚫 Suspended</option>
                    </select>
                  </F>
                </div>

                <div style={{ background: getRoleMeta(editUser.role).bg, border: `1px solid ${getRoleMeta(editUser.role).color}`, borderRadius: 10, padding: '10px 14px', fontSize: 12, color: getRoleMeta(editUser.role).color }}>
                  After login, this account will open: <strong>{getRoleMeta(editUser.role).dashboard}</strong>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving…' : '💾 Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRMATION MODAL ═════════════════════════════════════════ */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
              <h3 style={{ color: '#f87171' }}>🗑️ Confirm Permanent Deletion</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setDeleteTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{
                background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 12, padding: '16px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                  {deleteTarget.firstName} {deleteTarget.lastName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <code>{deleteTarget.email}</code>
                </div>
                <span className={`badge ${getRoleMeta(deleteTarget.role).badge}`}>{getRoleMeta(deleteTarget.role).label}</span>
              </div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 8 }}>
                This will <strong>permanently delete</strong> the employee record from the PostgreSQL <code>users</code> table. This action cannot be undone.
              </p>
              <ul style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 20, lineHeight: 1.8 }}>
                <li>All login credentials will be erased</li>
                <li>Role-based dashboard access will be revoked</li>
                <li>Associated records remain intact in other tables</li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel — Keep Employee</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={actionLoading}>
                {actionLoading ? 'Deleting…' : '🗑️ Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PASSWORD RESET CONFIRMATION MODAL ════════════════════════════════ */}
      {resetTarget && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>🔑 Reset Employee Password</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setResetTarget(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 12 }}>
                Reset the password for <strong>{resetTarget.email}</strong> to the default value:
              </p>
              <div style={{ background: 'var(--bg-surface)', borderRadius: 10, padding: '12px 16px', textAlign: 'center', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>New Default Password</div>
                <code style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary-light)', letterSpacing: 4 }}>demo123</code>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
                The employee should change this password after logging in.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setResetTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleResetPassword} disabled={actionLoading}>
                {actionLoading ? 'Resetting…' : '🔑 Reset to demo123'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DB RESET MODAL ════════════════════════════════════════════════════ */}
      {dbResetModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(239,68,68,0.3)' }}>
              <h3 style={{ color: '#f87171' }}>⚠️ Database Reset — Irreversible Operation</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setDbResetModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 12 }}>This will purge all non-admin user records from the <code>users</code> table and restore factory defaults.</p>
              <ul style={{ fontSize: 13, color: 'var(--text-secondary)', paddingLeft: 20, lineHeight: 1.9 }}>
                <li>All custom employees will be deleted</li>
                <li>5 default accounts will be re-seeded (<code>demo123</code>)</li>
                <li>Other tables (patients, vitals, prescriptions) are unaffected</li>
                <li><strong>This action cannot be undone</strong></li>
              </ul>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDbResetModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleClearDatabase} disabled={actionLoading}>
                {actionLoading ? 'Resetting Database…' : '💣 Reset Database Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
