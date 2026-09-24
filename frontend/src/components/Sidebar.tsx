'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { clearAuth, getUser } from '@/lib/auth';
import { useSocket } from '@/lib/useSocket';
import toast from 'react-hot-toast';
import Logo from '@/components/Logo';

const roleMenus: Record<string, { icon: string; label: string; href: string }[]> = {
  admin: [
    { icon: '📊', label: 'Dashboard', href: '/dashboard/admin' },
    { icon: '👥', label: 'Users', href: '/dashboard/admin/users' },
    { icon: '🏥', label: 'Patients', href: '/dashboard/admin/patients' },

  ],
  receptionist: [
    { icon: '📊', label: 'OPD & Dashboard', href: '/dashboard/receptionist' },
    { icon: '🏥', label: 'Register Patient', href: '/dashboard/receptionist/register' },
    { icon: '📅', label: 'Appointments', href: '/dashboard/receptionist/appointments' },
    { icon: '🎟️', label: 'OPD Queue Tokens', href: '/dashboard/receptionist/opd-queue' },
    // { icon: '🛏️', label: 'Bed Management', href: '/dashboard/receptionist/beds' },
    // { icon: '💳', label: 'Billing & Payments', href: '/dashboard/receptionist/beds?tab=billing' },
  ],
  nurse: [
    { icon: '📊', label: 'Nurse Dashboard', href: '/dashboard/nurse', },
    { icon: '🩺', label: 'Inpatient Monitoring (IP)', href: '/dashboard/nurse/inpatient-monitoring', },
    { icon: '💗', label: 'Vitals Overview', href: '/dashboard/nurse?tab=vitals', },
    { icon: '🚨', label: 'Triage & Priority', href: '/dashboard/nurse?tab=triage', },
    { icon: '📂', label: 'Patient History', href: '/dashboard/nurse?tab=history', },
    { icon: '🧪', label: 'Test Reports', href: '/dashboard/nurse?tab=reports', },
    { icon: '📋', label: 'Discharge Summaries', href: '/dashboard/nurse?tab=discharges', },
    { icon: '🛏️', label: 'Bed Management', href: '/dashboard/nurse/beds', },
  ],
  doctor: [
    { icon: '📊', label: 'Doctor Dashboard', href: '/dashboard/doctor' },
    { icon: '🏥', label: 'Patient Files', href: '/dashboard/doctor?tab=patients' },
    { icon: '📝', label: 'Consultations', href: '/dashboard/doctor?tab=consultation' },
    { icon: '💊', label: 'Prescriptions', href: '/dashboard/doctor?tab=prescriptions' },
  ],
  pharmacist: [
    { icon: '📊', label: 'Dashboard', href: '/dashboard/pharmacist' },
    { icon: '💊', label: 'Prescriptions', href: '/dashboard/pharmacist/prescriptions' },
  ],
  management: [
    { icon: '📊', label: 'Dashboard', href: '/dashboard/management' },
    { icon: '🩺', label: 'Inpatient Monitoring', href: '/dashboard/management?tab=inpatient' },
    { icon: '👥', label: 'All Staff', href: '/dashboard/management?tab=staff' },
    { icon: '🏥', label: 'All Patients', href: '/dashboard/management?tab=patients' },
    { icon: '📋', label: 'Discharge Summaries', href: '/dashboard/management?tab=discharges' },
    { icon: '📢', label: 'Broadcast', href: '/dashboard/management?tab=broadcast' },
    { icon: '🛏️', label: 'Bed Management', href: '/dashboard/management/beds' },
  ],
  patient: [
    { icon: '📊', label: 'My Records', href: '/dashboard/patient' },
    { icon: '💊', label: 'Prescriptions', href: '/dashboard/patient/prescriptions' },
  ],
  lab_technician: [
    { icon: '📊', label: 'Lab Dashboard', href: '/dashboard/lab' },
    { icon: '🧪', label: 'Pending Requests', href: '/dashboard/lab?tab=pending' },
    { icon: '📋', label: 'Completed Results', href: '/dashboard/lab?tab=completed' },
  ],
};

export default function Sidebar({ role }: { role: string }) {
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getUser>>(null);
  const searchParams = useSearchParams();
  const currentTab = mounted ? searchParams.get('tab') : null;
  const pathname = usePathname();
  const router = useRouter();
  const { notifications, unreadCount, markRead, connectionStatus } = useSocket();
  const [notifOpen, setNotifOpen] = useState(false);
  let menus = roleMenus[role] || [];
  if (role === 'nurse') {
    const isIpDuty = (user?.dutyType || '').toUpperCase() === 'IP';
    if (!isIpDuty) {
      // OP duty nurse: hide Inpatient Monitoring (IP) from sidebar navigation
      menus = menus.filter(item => item.href !== '/dashboard/nurse/inpatient-monitoring');
    }
  }

  useEffect(() => {
    setMounted(true);
    setUser(getUser());
  }, []);

  // Debug logging
  useEffect(() => {
    if (mounted) {
      console.log('🔔 Sidebar notification state:', {
        notificationsCount: notifications.length,
        unreadCount,
        connectionStatus,
        role,
        userId: user?.id
      });
    }
  }, [mounted, notifications, unreadCount, connectionStatus, role, user?.id]);

  if (!mounted) {
    return null;
  }

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    router.push('/login');
  };

  const roleColors: Record<string, string> = {
    admin: '#6366f1', receptionist: '#0ea5e9', nurse: '#10b981', doctor: '#ec4899',
    pharmacist: '#f59e0b', management: '#ef4444', patient: '#8b5cf6', lab_technician: '#06b6d4',
  };

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Logo variant="sidebar" size="md" />
        </div>

        <nav className="sidebar-nav">
          <p className="nav-section-title">Navigation</p>
          {menus.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${
                item.href.includes('?tab=')
                  ? (pathname === item.href.split('?')[0] || (pathname === '/dashboard/lab_technician' && item.href.startsWith('/dashboard/lab'))) &&
                    currentTab === item.href.split('tab=')[1]
                    ? 'active'
                    : ''
                  : (pathname === item.href || (pathname === '/dashboard/lab_technician' && item.href === '/dashboard/lab')) && !currentTab
                  ? 'active'
                  : ''
              }`}
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
            <span style={{ 
              marginLeft: 'auto', 
              fontSize: '10px', 
              padding: '2px 6px', 
              borderRadius: '4px',
              background: connectionStatus === 'connected' ? 'rgba(16, 185, 129, 0.15)' : 
                         connectionStatus === 'connecting' ? 'rgba(245, 158, 11, 0.15)' : 
                         'rgba(239, 68, 68, 0.15)',
              color: connectionStatus === 'connected' ? '#34d399' : 
                     connectionStatus === 'connecting' ? '#fbbf24' : 
                     '#f87171',
              fontWeight: 600
            }}>
              {connectionStatus === 'connected' ? '●' : connectionStatus === 'connecting' ? '○' : '○'}
            </span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-card">
            <div className="user-avatar" style={{ background: `linear-gradient(135deg, ${roleColors[role]}, ${roleColors[role]}88)` }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="user-info">
              <div className="user-name">{user?.firstName} {user?.lastName}</div>
              <div className="user-role" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span>{role}</span>
                {role === 'nurse' && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: (user?.dutyType || '').toUpperCase() === 'IP' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: (user?.dutyType || '').toUpperCase() === 'IP' ? '#34d399' : '#fbbf24',
                    border: `1px solid ${(user?.dutyType || '').toUpperCase() === 'IP' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                  }}>
                    {(user?.dutyType || 'OP').toUpperCase()} Duty
                  </span>
                )}
              </div>
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
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{notifications.length} total, {unreadCount} unread</p>
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
            notifications.map((n) => (
              <div key={n.id || n.createdAt} className={`notif-item ${!n.isRead ? 'unread' : ''}`}>
                <div className="notif-title">{n.title}</div>
                <div className="notif-message">{n.message}</div>
                <div className="notif-meta">
                  <span className="notif-time">{new Date(n.createdAt).toLocaleTimeString()}</span>
                  <span className="notif-type">{n.type || 'general'}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      {notifOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 79 }} onClick={() => setNotifOpen(false)} />}
    </>
  );
}
