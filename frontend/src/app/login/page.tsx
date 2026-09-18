'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setAuth, getUser, isLoggedIn } from '@/lib/auth';
import toast from 'react-hot-toast';
import CenteredLoader from '@/components/CenteredLoader';
import { applyTheme, getCurrentTheme } from '@/lib/theme';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageInitializing, setPageInitializing] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const demoAccounts = [
    { role: 'admin', email: 'admin@hospital.com', label: 'Admin', icon: '🛡️' },
    { role: 'doctor', email: 'doctor@hospital.com', label: 'Doctor', icon: '🩺' },
    { role: 'receptionist', email: 'reception@hospital.com', label: 'Reception', icon: '📋' },
    { role: 'nurse', email: 'nurse@hospital.com', label: 'Nurse', icon: '💉' },
    { role: 'pharmacist', email: 'pharmacy@hospital.com', label: 'Pharmacy', icon: '💊' },
    { role: 'lab_technician', email: 'lab@hospital.com', label: 'Lab Tech', icon: '🧪' },
  ];

  useEffect(() => {
    setMounted(true);
    applyTheme(getCurrentTheme());
    if (isLoggedIn()) {
      const user = getUser();
      if (user?.role) {
        const target = (user.role === 'lab_technician' || user.role === 'lab') ? '/dashboard/lab' : `/dashboard/${user.role}`;
        router.replace(target);
        return;
      }
    }
    setPageInitializing(false);
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', form);
      setAuth(data.accessToken, data.user);
      toast.success(`Welcome, ${data.user.firstName || 'User'}! Redirecting to ${data.user.role.toUpperCase()} portal...`);
      const targetRole = (data.user.role === 'lab_technician' || data.user.role === 'lab') ? 'lab' : data.user.role;
      router.push(`/dashboard/${targetRole}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
      setLoading(false);
    }
  };

  const handleQuickSelect = (email: string) => {
    setForm({ email, password: 'demo123' });
    toast.success(`Pre-filled ${email}`);
  };

  if (!mounted) {
    return null;
  }

  if (pageInitializing) {
    return <CenteredLoader message="Initializing MediCore HMS..." subtext="Loading theme & hospital services..." />;
  }

  if (loading) {
    return <CenteredLoader message="Verifying Credentials..." subtext="Accessing allocated role portal..." />;
  }

  return (
    <div className="login-container-split">
      {/* LEFT SIDE: Hospital Interactive Animation & Highlights (Desktop/Laptop view) */}
      <div className="login-left-animation-panel">
        {/* Background Ambient Glow & Grid Patterns */}
        <div className="left-bg-glow glow-1" />
        <div className="left-bg-glow glow-2" />

        {/* Top Header Branding */}
        <div className="hospital-brand-header">
          <div className="brand-badge-pill">
            <span className="live-dot" />
            <span>HMS Enterprise Portal 3.0</span>
          </div>
          <Logo variant="full" size="lg" showBadges={true} />
        </div>

        {/* CENTER: Main Hospital Animation Showcase */}
        <div className="hospital-animation-showcase">
          {/* Animated Central Hospital Emblem */}
          <div className="hospital-icon-wrapper">
            <div className="pulse-ring ring-1" />
            <div className="pulse-ring ring-2" />
            <div className="hospital-emblem">🏥</div>
          </div>

          {/* Dynamic Heartbeat / ECG Animated Line */}
          <div className="ecg-wave-box">
            <svg className="ecg-svg" viewBox="0 0 500 80" preserveAspectRatio="none">
              <path
                className="ecg-path-bg"
                d="M0,40 L100,40 L110,20 L120,60 L130,10 L140,70 L150,40 L250,40 L260,15 L270,65 L280,40 L500,40"
              />
              <path
                className="ecg-path-animated"
                d="M0,40 L100,40 L110,20 L120,60 L130,10 L140,70 L150,40 L250,40 L260,15 L270,65 L280,40 L500,40"
              />
            </svg>
            <div className="ecg-caption">
              <span>🫀 Live Telemetry Monitor</span>
              <span className="ecg-status">BPM 72 — Normal</span>
            </div>
          </div>

          {/* Floating Hospital Feature Cards with Smooth CSS Bounce Animations */}
          <div className="floating-cards-container">
            <div className="floating-card float-card-1">
              <div className="float-icon">🩺</div>
              <div>
                <div className="float-title">OPD Queue</div>
                <div className="float-sub">Real-Time Doctor Assignment</div>
              </div>
            </div>

            <div className="floating-card float-card-2">
              <div className="float-icon">💊</div>
              <div>
                <div className="float-title">Pharmacy Sync</div>
                <div className="float-sub">Automated Prescription Dispensing</div>
              </div>
            </div>

            <div className="floating-card float-card-3">
              <div className="float-icon">🚑</div>
              <div>
                <div className="float-title">Emergency ER</div>
                <div className="float-sub">24/7 Critical Patient Response</div>
              </div>
            </div>
          </div>
        </div>

        {/* BOTTOM: Hospital Metrics Footer */}
        <div className="hospital-stats-footer">
          <div className="stat-pill">
            <span className="stat-num">500+</span>
            <span className="stat-lbl">Daily Beds Managed</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">99.9%</span>
            <span className="stat-lbl">System Uptime</span>
          </div>
          <div className="stat-pill">
            <span className="stat-num">100%</span>
            <span className="stat-lbl">HIPAA Secured</span>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Clean Responsive Login Form */}
      <div className="login-right-form-panel">
        <div className="login-form-card">
          <div className="login-card-header">
            <div style={{ marginBottom: 12 }}>
              <Logo variant="compact" size="sm" />
            </div>
            <h1>Welcome Back</h1>
            <p>Sign in to access your role-based hospital dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="login-actual-form">
            <div className="form-group" style={{ marginBottom: 18 }}>
              <label className="form-label">Email Address</label>
              <div className="input-with-icon">
                <span className="input-icon">📧</span>
                <input
                  type="email"
                  className="form-control styled-input"
                  placeholder="name@gmail.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label">Password</label>
              <div className="input-with-icon">
                <span className="input-icon">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control styled-input"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary login-submit-btn" disabled={loading}>
              🔐 Sign In & Open Dashboard
            </button>
          </form>

          {/* Quick Pre-fill Demo Credentials */}
          {/* <div className="demo-accounts-wrapper">
            <div className="demo-divider">
              <span>Quick Demo Accounts</span>
            </div>
            <div className="demo-btns-grid">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  className="demo-account-btn"
                  onClick={() => handleQuickSelect(acc.email)}
                >
                  <span>{acc.icon}</span> {acc.label}
                </button>
              ))}
            </div>
          </div> */}

          <div className="login-card-footer">
            <span>🛡️ Encrypted HMS Session • MediCore v3.2</span>
          </div>
        </div>
      </div>
    </div>
  );
}
