export interface HospitalTheme {
  id: string;
  name: string;
  badge: string;
  colors: {
    primary: string;
    primaryDark: string;
    primaryLight: string;
    secondary: string;
    accent: string;
    bgDark: string;
    bgCard: string;
    bgSurface: string;
    shadowGlow: string;
  };
}

export const hospitalThemes: HospitalTheme[] = [
  {
    id: 'medicore-blue',
    name: 'MediCore Sapphire',
    badge: '🏥 Standard',
    colors: {
      primary: '#6366f1',
      primaryDark: '#4f46e5',
      primaryLight: '#818cf8',
      secondary: '#0ea5e9',
      accent: '#10b981',
      bgDark: '#0a0f1e',
      bgCard: '#0f172a',
      bgSurface: '#1e293b',
      shadowGlow: '0 0 30px rgba(99,102,241,0.25)',
    },
  },
  {
    id: 'st-jude-emerald',
    name: 'St. Jude Emerald',
    badge: '🌿 Wellness',
    colors: {
      primary: '#10b981',
      primaryDark: '#059669',
      primaryLight: '#34d399',
      secondary: '#14b8a6',
      accent: '#3b82f6',
      bgDark: '#061a14',
      bgCard: '#0a2920',
      bgSurface: '#133e32',
      shadowGlow: '0 0 30px rgba(16,185,129,0.25)',
    },
  },
  {
    id: 'mayo-royal-cyan',
    name: 'Mayo Royal Cyan',
    badge: '👑 Clinical',
    colors: {
      primary: '#06b6d4',
      primaryDark: '#0891b2',
      primaryLight: '#38bdf8',
      secondary: '#3b82f6',
      accent: '#8b5cf6',
      bgDark: '#05131e',
      bgCard: '#0b1f30',
      bgSurface: '#142f47',
      shadowGlow: '0 0 30px rgba(6,182,212,0.25)',
    },
  },
  {
    id: 'mount-sinai-crimson',
    name: 'Mount Sinai Crimson',
    badge: '❤️ Emergency',
    colors: {
      primary: '#f43f5e',
      primaryDark: '#e11d48',
      primaryLight: '#fb7185',
      secondary: '#fb923c',
      accent: '#10b981',
      bgDark: '#1c0a10',
      bgCard: '#2c0f1a',
      bgSurface: '#3e1726',
      shadowGlow: '0 0 30px rgba(244,63,94,0.25)',
    },
  },
  {
    id: 'johns-hopkins-amethyst',
    name: 'Johns Hopkins Purple',
    badge: '🔮 Specialty',
    colors: {
      primary: '#8b5cf6',
      primaryDark: '#7c3aed',
      primaryLight: '#a78bfa',
      secondary: '#6366f1',
      accent: '#0ea5e9',
      bgDark: '#120a21',
      bgCard: '#1c1033',
      bgSurface: '#2a1a4a',
      shadowGlow: '0 0 30px rgba(139,92,246,0.25)',
    },
  },
];

const THEME_KEY = 'hms_hospital_theme';

export function applyTheme(themeId: string) {
  if (typeof document === 'undefined') return;
  const theme = hospitalThemes.find((t) => t.id === themeId) || hospitalThemes[0];
  const root = document.documentElement;

  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--primary-dark', theme.colors.primaryDark);
  root.style.setProperty('--primary-light', theme.colors.primaryLight);
  root.style.setProperty('--secondary', theme.colors.secondary);
  root.style.setProperty('--accent', theme.colors.accent);
  root.style.setProperty('--bg-dark', theme.colors.bgDark);
  root.style.setProperty('--bg-card', theme.colors.bgCard);
  root.style.setProperty('--bg-surface', theme.colors.bgSurface);
  root.style.setProperty('--shadow-glow', theme.colors.shadowGlow);

  localStorage.setItem(THEME_KEY, theme.id);
}

export function getCurrentTheme(): string {
  if (typeof window === 'undefined') return hospitalThemes[0].id;
  return localStorage.getItem(THEME_KEY) || hospitalThemes[0].id;
}
