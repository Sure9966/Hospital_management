'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearAuth, getUser } from '@/lib/auth';
import { useSocket } from '@/lib/useSocket';
import toast from 'react-hot-toast';

const roleMenus: Record<string, { icon: string; label: string; href: string }[]> = {
  admin: [
    { icon: '📊', label: 'Dashboard', href: '/dashboard/admin' },
    { icon: '👥', label: 'Users', href: '/dashboard/admin/users' },
    { icon: '🛏️', label: 'Bed Management', href: '/dashboard/admin/beds' },
    { icon: '🏥', label: 'Patients', href: '/dashboard/admin/patients' },
  ],
  receptionist: [
    { icon: '📊', label: 'OPD & Dashboard', href: '/dashboard/receptionist' },
    { icon: '🏥', label: 'Register Patient', href: '/dashboard/receptionist/register' },
    { icon: '📅', label: 'Appointments', href: '/dashboard/receptionist/appointments' },
    { icon: '🎟️', label: 'OPD Queue Tokens', href: '/dashboard/receptionist/opd-queue' },
  ],
  nurse: [
    { icon: '📊', label: 'Dashboard', href: '/dashboard/nurse' },
    { icon: '💗', label: 'Record Vitals', href: '/dashboard/nurse/vitals' },
    { icon: '🛏️', label: 'Bed Management', href: '/dashboard/admin/beds' },
    { icon: '🏥', label: 'My Patients', href: '/dashboard/nurse/patients' },
  ],
  doctor: [
    { icon: '📊', label: 'Doctor Dashboard', href: '/dashboard/doctor' },
    { icon: '🏥', label: 'Patient Files', href: '/dashboard/doctor' },
    { icon: '📝', label: 'Consultations', href: '/dashboard/doctor' },
    { icon: '💊', label: 'Prescriptions', href: '/dashboard/doctor' },
  ],
  pharmacist: [
    { icon: '📊', label: 'Dashboard', href: '/dashboard/pharmacist' },
    { icon: '💊', label: 'Prescriptions', href: '/dashboard/pharmacist/prescriptions' },
  ],
  management: [
    { icon: '📊', label: 'Dashboard', href: '/dashboard/management' },
    { icon: '👥', label: 'All Staff', href: '/dashboard/management/staff' },
    { icon: '🏥', label: 'All Patients', href: '/dashboard/management/patients' },
    { icon: '📢', label: 'Broadcast', href: '/dashboard/management/broadcast' },
  ],
  patient: [
    { icon: '📊', label: 'My Records', href: '/dashboard/patient' },
    { icon: '💊', label: 'Prescriptions', href: '/dashboard/patient/prescriptions' },
  ],
};

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notifications, unreadCount, markRead } = useSocket();
  const [notifOpen, setNotifOpen] = useState(false);
  const user = getUser();
  const menus = roleMenus[role] || [];

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const roleColors: Record<string, string> = {
    admin: '#6366f1', receptionist: '#0ea5e9', nurse: '#10b981', doctor: '#ec4899',
    pharmacist: '#f59e0b', management: '#ef4444', patient: '#8b5cf6',
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🏥</div>
          <h1>MediCore</h1>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section-title">Navigation</p>
          {menus.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <p className="nav-section-title" style={{ marginTop: 16 }}>Notifications</p>
          <button
            className="nav-item"
            style={{ width: '100%', background: 'none', border: 'none', textAlign: 'left' }}
            onClick={() => { setNotifOpen(!notifOpen); markRead(); }}
          >
            <span className="nav-icon">🔔</span>
            Notifications
            {unreadCount > 0 && <span className="nav-badge">{unreadCount}</span>}
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" style={{ background: `linear-gradient(135deg, ${roleColors[role]}, ${roleColors[role]}88)` }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
              <div className="user-role">{role}</div>
            </div>
          </div>
          <button
            className="btn btn-secondary w-full"
            onClick={handleLogout}
            style={{ marginTop: 10, fontSize: 13 }}
          >
            🚪 Logout
          </button>
        </div>
      </aside>

      {/* Notification Panel */}
      <div className={`notif-panel ${notifOpen ? 'open' : ''}`}>
        <div className="notif-header">
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>Notifications</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notifications.length} total</p>
          </div>
          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setNotifOpen(false)}>✕</button>
        </div>
        <div className="notif-list">
          {notifications.length === 0 ? (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-icon">🔔</div>
              <h3>All caught up!</h3>
              <p>No new notifications</p>
            </div>
          ) : (
            notifications.map((n, i) => (
              <div key={i} className={`notif-item ${!n.isRead ? 'unread' : ''}`}>
                <div className="notif-title">{n.title}</div>
                <div className="notif-message">{n.message}</div>
                <div className="notif-time">{new Date(n.createdAt).toLocaleTimeString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
      {notifOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 79 }} onClick={() => setNotifOpen(false)} />}
    </>
  );
}
