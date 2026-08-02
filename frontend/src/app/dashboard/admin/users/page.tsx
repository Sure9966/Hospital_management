'use client';
import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import CenteredLoader from '@/components/CenteredLoader';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface UserItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'receptionist' | 'nurse' | 'doctor' | 'pharmacist' | 'management' | 'patient';
  phone?: string;
  department?: string;
  isActive: boolean;
  isApproved?: boolean;
  permissions?: string[];
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editUser, setEditUser] = useState<UserItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserItem | null>(null);

  const fetchUsers = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch (err) {
      toast.error('Failed to load user directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (user: UserItem) => {
    try {
      const updated = !user.isActive;
      await api.put(`/users/${user.id}`, { isActive: updated });
      toast.success(`Account for ${user.email} is now ${updated ? 'Active' : 'Suspended'}`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update user status');
    }
  };

  const handleResetPassword = async (user: UserItem) => {
    try {
      await api.post(`/users/${user.id}/reset-password`, { newPassword: 'demo123' });
      toast.success(`Password reset to 'demo123' for ${user.email}`);
    } catch (err) {
      toast.error('Failed to reset password');
    }
  };

  const handleDeleteUser = async (user: UserItem) => {
    setActionLoading(true);
    try {
      await api.delete(`/users/${user.id}`);
      toast.success(`User ${user.email} deleted from database`);
      setConfirmDeleteUser(null);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to delete user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
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
      toast.success(`User details updated for ${editUser.email}`);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to update user');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.firstName.toLowerCase().includes(search.toLowerCase()) ||
      u.lastName.toLowerCase().includes(search.toLowerCase()) ||
      (u.department && u.department.toLowerCase().includes(search.toLowerCase()));

    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return <CenteredLoader message="Loading User Directory..." subtext="Fetching hospital staff accounts & access status" />;
  }

  return (
    <DashboardLayout role="admin" title="User Directory & Access Control">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2>Hospital User Accounts & Access Controls</h2>
          <p>Full directory of hospital employees & patient accounts. Modify roles, reset logins, or delete entries.</p>
        </div>
        <Link href="/dashboard/admin" className="btn btn-primary btn-sm">
          ⚙️ IT Admin Control Hub
        </Link>
      </div>

      {/* Filter and Action Bar */}
      <div className="action-bar mb-4">
        <div className="search-bar">
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search by name, email, department..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filter Role:</label>
          <select
            className="form-control"
            style={{ width: 160 }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All Roles ({users.length})</option>
            <option value="admin">IT Admin</option>
            <option value="receptionist">Receptionist</option>
            <option value="nurse">Nurse</option>
            <option value="doctor">Doctor</option>
            <option value="pharmacist">Pharmacist</option>
            <option value="management">Management</option>
            <option value="patient">Patient</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">👥 All Registered Users ({filtered.length})</h3>
        </div>
        <div className="card-body p-0">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User Name</th>
                  <th>Email (Login ID)</th>
                  <th>Role (Redirect Target)</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Approval</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      No matching user accounts found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((u) => (
                    <tr key={u.id}>
                      <td className="font-semibold">{u.firstName} {u.lastName}</td>
                      <td><code>{u.email}</code></td>
                      <td>
                        <span className={`badge badge-${u.role === 'admin' ? 'purple' : u.role === 'nurse' ? 'success' : u.role === 'pharmacist' ? 'warning' : 'info'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td>{u.department || '—'}</td>
                      <td>
                        <span className={`badge badge-${u.isActive ? 'success' : 'danger'}`}>
                          {u.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge badge-${u.isApproved !== false ? 'success' : 'warning'}`}>
                          {u.isApproved !== false ? 'Approved' : 'Pending'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setEditUser(u)}
                            title="Edit Role & Details"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleResetPassword(u)}
                            title="Set Password to demo123"
                          >
                            🔑 Reset
                          </button>
                          <button
                            className={`btn btn-${u.isActive ? 'warning' : 'success'} btn-sm`}
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.isActive ? '🚫 Suspend' : '✓ Activate'}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setConfirmDeleteUser(u)}
                            title="Delete user from database"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit User Modal */}
      {editUser && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>✏️ Edit User Role & Access — {editUser.email}</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditUser(null)}>✕</button>
            </div>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-body form-grid">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editUser.firstName}
                      onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editUser.lastName}
                      onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Assigned Role</label>
                    <select
                      className="form-control"
                      value={editUser.role}
                      onChange={(e) => setEditUser({ ...editUser, role: e.target.value as any })}
                    >
                      <option value="admin">IT Admin</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="nurse">Nurse</option>
                      <option value="pharmacist">Pharmacist</option>
                      <option value="management">Management</option>
                      <option value="patient">Patient</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={editUser.department || ''}
                      onChange={(e) => setEditUser({ ...editUser, department: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label">Approval Status</label>
                    <select
                      className="form-control"
                      value={editUser.isApproved !== false ? 'approved' : 'pending'}
                      onChange={(e) => setEditUser({ ...editUser, isApproved: e.target.value === 'approved' })}
                    >
                      <option value="approved">Approved for System Login</option>
                      <option value="pending">Pending Approval</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Account Status</label>
                    <select
                      className="form-control"
                      value={editUser.isActive !== false ? 'active' : 'suspended'}
                      onChange={(e) => setEditUser({ ...editUser, isActive: e.target.value === 'active' })}
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : 'Save User Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {confirmDeleteUser && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h3>🗑️ Confirm User Deletion</h3>
              <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setConfirmDeleteUser(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, marginBottom: 8 }}>Are you sure you want to permanently delete:</p>
              <p style={{ fontWeight: 700, color: 'var(--primary-light)' }}>{confirmDeleteUser.firstName} {confirmDeleteUser.lastName} &lt;{confirmDeleteUser.email}&gt;</p>
              <p style={{ fontSize: 12, color: '#ef4444', marginTop: 8 }}>⚠️ This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setConfirmDeleteUser(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDeleteUser(confirmDeleteUser)} disabled={actionLoading}>
                {actionLoading ? 'Deleting...' : '🗑️ Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
