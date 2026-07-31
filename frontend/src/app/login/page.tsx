'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';
import toast from 'react-hot-toast';
import CenteredLoader from '@/components/CenteredLoader';
import ThemeSelector from '@/components/ThemeSelector';
import { applyTheme, getCurrentTheme } from '@/lib/theme';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [pageInitializing, setPageInitializing] = useState(true);

  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    applyTheme(getCurrentTheme());
    setPageInitializing(false);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Send Email & Password to backend API
      const { data } = await api.post('/auth/login', form);

      // 2. Store Auth Token & Allocated User Role
      setAuth(data.accessToken, data.user);
      toast.success(`Welcome back, ${data.user.firstName || 'User'}! Opening ${data.user.role.toUpperCase()} portal...`);

      // 3. Auto-redirect to the specific role dashboard allocated to this email
      router.push(`/dashboard/${data.user.role}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid email or password');
      setLoading(false);
    }
  };

  // const demoAccounts = [
  //   { role: 'admin', email: 'admin@hospital.com', label: 'IT Admin' },
  //   { role: 'receptionist', email: 'reception@hospital.com', label: 'Receptionist' },
  //   { role: 'nurse', email: 'nurse@hospital.com', label: 'Nurse' },
  //   { role: 'pharmacist', email: 'pharmacy@hospital.com', label: 'Pharmacist' },
  //   { role: 'management', email: 'manager@hospital.com', label: 'Management' },
  // ];

  if (pageInitializing) {
    return <CenteredLoader message="Initializing MediCore..." subtext="Loading theme preferences" />;
  }

  if (loading) {
    return <CenteredLoader message="Verifying Credentials..." subtext="Checking allocated role & opening dashboard..." />;
  }

  return (
    <div className="login-page">
      <div className="login-bg" />

      {/* Theme Selector top right */}
      <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 10 }}>
        <ThemeSelector />
      </div>

      <div className="login-card">
        <div className="login-logo">
          <div className="logo-circle">🏥</div>
          <h1>Medi<span>Core</span> HMS</h1>
          <p>Hospital Role-Based Login System</p>
        </div>

        {/* Clean Email & Password Form */}
        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-control"
              placeholder="Enter your registered email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter your default or custom password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading} style={{ height: 46 }}>
            🔐 Sign In & Open Dashboard
          </button>
        </form>


      </div>
    </div>
  );
}
