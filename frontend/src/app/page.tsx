'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';
import { applyTheme, getCurrentTheme } from '@/lib/theme';
import CenteredLoader from '@/components/CenteredLoader';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    applyTheme(getCurrentTheme());
    const token = getToken();
    const user = getUser();
    if (token && user) {
      router.push(`/dashboard/${user.role}`);
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <CenteredLoader
      message="Redirecting to MediCore Portal..."
      subtext="Checking user role permissions & hospital security session"
    />
  );
}
