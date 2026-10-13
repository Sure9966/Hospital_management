export const hospitalThemes = [
  {
    id: 'hospital-white',
    name: 'Hospital White',
    badge: 'Clean Clinical',

    colors: {
      primary: '#2563eb',
      secondary: '#0ea5e9',

      bgMain: '#ffffff',
      bgSurface: '#f8fafc',
      bgCard: '#ffffff',

      textPrimary: '#0f172a',
      textSecondary: '#475569',
      textMuted: '#64748b',

      border: '#e2e8f0',

      success: '#16a34a',
      warning: '#f59e0b',
      danger: '#dc2626',
    },
  },
];

export function applyTheme(themeId?: string) {
  const theme = hospitalThemes[0];
  const root = document.documentElement;

  root.style.setProperty('--primary', theme.colors.primary);
  root.style.setProperty('--secondary', theme.colors.secondary);

  root.style.setProperty('--bg-dark', '#ffffff');
  root.style.setProperty('--bg-main', theme.colors.bgMain);
  root.style.setProperty('--bg-surface', theme.colors.bgSurface);
  root.style.setProperty('--bg-card', theme.colors.bgCard);

  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--text-muted', theme.colors.textMuted);

  root.style.setProperty('--border', theme.colors.border);

  root.style.setProperty('--success', theme.colors.success);
  root.style.setProperty('--warning', theme.colors.warning);
  root.style.setProperty('--danger', theme.colors.danger);

  if (typeof window !== 'undefined') {
    localStorage.setItem('hospital-theme', 'hospital-white');
  }
}

export function getCurrentTheme() {
  return 'hospital-white';
}