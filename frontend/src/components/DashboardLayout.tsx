'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ThemeSelector from '@/components/ThemeSelector';
import CenteredLoader from '@/components/CenteredLoader';
import { getToken, getUser, User } from '@/lib/auth';
import { applyTheme, getCurrentTheme } from '@/lib/theme';

export default function DashboardLayout({
  children,
  role,
  title,
}: {
  children: React.ReactNode;
  role: string;
  title?: string;
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Apply saved hospital theme
    applyTheme(getCurrentTheme());

    const token = getToken();
    const user = getUser();

    if (!token || !user) {
      router.push('/login');
    } else {
      setCurrentUser(user);
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return <CenteredLoader message="Loading MediCore Dashboard..." subtext="Verifying security credentials & hospital theme" />;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar role={role} />
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-title">
            🏥 {title || `${role.toUpperCase()} PORTAL`} <span>— MediCore HMS</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeSelector />
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 20,
                background: 'rgba(99,102,241,0.15)',
                color: 'var(--primary-light)',
                border: '1px solid rgba(99,102,241,0.3)',
                textTransform: 'uppercase',
              }}
            >
              Role: {currentUser?.role}
            </div>
          </div>
        </header>
        <div className="page-content">{children}</div>
      </main>
    </div>
  );
}
