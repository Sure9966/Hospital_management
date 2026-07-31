'use client';
import React from 'react';

interface LoaderProps {
  message?: string;
  subtext?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function CenteredLoader({
  message = 'Loading MediCore System...',
  subtext = 'Preparing hospital modules & access permissions',
  fullScreen = true,
  size = 'md',
}: LoaderProps) {
  const outerStyle: React.CSSProperties = fullScreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(10, 15, 30, 0.85)',
        backdropFilter: 'blur(12px)',
      }
    : {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        width: '100%',
      };

  const ringSizes = {
    sm: { container: 60, icon: 24, font: 12 },
    md: { container: 90, icon: 36, font: 14 },
    lg: { container: 120, icon: 48, font: 16 },
  };

  const { container, icon } = ringSizes[size];

  return (
    <div style={outerStyle}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 24,
          padding: '36px 48px',
          boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
          maxWidth: 420,
          width: '90%',
          animation: 'fadeIn 0.3s ease',
        }}
      >
        {/* Animated Hospital Icon & Dual Spinning Pulse Rings */}
        <div style={{ position: 'relative', width: container, height: container, marginBottom: 20 }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: '3px solid transparent',
              borderTopColor: 'var(--primary)',
              borderRightColor: 'var(--secondary)',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: -6,
              borderRadius: '50%',
              border: '2px dashed var(--accent)',
              opacity: 0.5,
              animation: 'spin 3s linear infinite reverse',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 10,
              borderRadius: '50%',
              background: 'radial-gradient(circle, var(--primary-dark) 0%, transparent 80%)',
              opacity: 0.3,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: icon,
            }}
          >
            🏥
          </div>
        </div>

        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
          {message}
        </h3>
        {subtext && (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: 300 }}>
            {subtext}
          </p>
        )}

        {/* Dynamic Progress Bar Glow */}
        <div
          style={{
            width: '100%',
            height: 4,
            background: 'var(--bg-surface)',
            borderRadius: 4,
            marginTop: 20,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '40%',
              background: 'linear-gradient(90deg, var(--primary), var(--secondary), var(--accent))',
              borderRadius: 4,
              animation: 'loaderSlide 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes loaderSlide {
          0% { left: -40%; }
          100% { left: 100%; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(0.95); opacity: 0.3; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
