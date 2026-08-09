'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff', color: '#0f172a', padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🏥</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>404 - Page Not Found</h1>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>The requested MediCore hospital page could not be located.</p>
      <Link href="/login" style={{ padding: '10px 24px', background: '#2563eb', color: '#ffffff', borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
        Return to Login Page
      </Link>
    </div>
  );
}
