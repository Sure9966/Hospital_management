'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getToken, getUser } from '@/lib/auth';
import { applyTheme, getCurrentTheme } from '@/lib/theme';
import CenteredLoader from '@/components/CenteredLoader';

export default function HomePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    applyTheme(getCurrentTheme());
    const token = getToken();
    const user = getUser();
    if (token && user) {
      router.push(`/dashboard/${user.role}`);
    } else {
      router.push('/login');
    }
  }, [router]);

  if (!mounted) {
    return null;
  }

  return (
    <CenteredLoader
      message="Redirecting to MediCore Portal..."
      subtext="Checking user role permissions & hospital security session"
    />
  );
}
