'use client';
import React, { useEffect, useState } from 'react';
import { hospitalThemes, applyTheme, getCurrentTheme } from '@/lib/theme';

export default function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const [activeThemeId, setActiveThemeId] = useState('medicore-white');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const saved = getCurrentTheme();
    setActiveThemeId(saved);
    applyTheme(saved);
  }, []);

  const handleSelect = (id: string) => {
    setActiveThemeId(id);
    applyTheme(id);
    setIsOpen(false);
  };

  const currentTheme = hospitalThemes.find((t) => t.id === activeThemeId) || hospitalThemes[0];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: 12,
          padding: compact ? '4px 8px' : '6px 12px',
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: currentTheme.colors.primary,
            boxShadow: `0 0 8px ${currentTheme.colors.primary}`,
          }}
        />
        {!compact && <span>Theme: <strong>{currentTheme.name}</strong></span>}
        <span style={{ fontSize: 10, opacity: 0.7 }}>▼</span>
      </button>

      {isOpen && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 90 }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '110%',
              zIndex: 100,
              width: 240,
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 14,
              padding: 8,
              boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                padding: '4px 8px 8px',
                letterSpacing: 0.5,
              }}
            >
              Hospital Branding Theme
            </div>
            {hospitalThemes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelect(t.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 8,
                  border: t.id === activeThemeId ? '1px solid var(--primary)' : '1px solid transparent',
                  background: t.id === activeThemeId ? 'rgba(255,255,255,0.06)' : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 12,
                  marginBottom: 4,
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 3,
                  }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: t.colors.primary,
                    }}
                  />
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: t.colors.secondary,
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{t.badge}</div>
                </div>
                {t.id === activeThemeId && <span style={{ color: 'var(--primary)', fontWeight: 'bold' }}>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
