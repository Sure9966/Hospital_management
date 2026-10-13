'use client';

import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';

export default function ThemeSelector({
  compact = false,
}: {
  compact?: boolean;
}) {
  useEffect(() => {
    applyTheme('hospital-white');
  }, []);

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          borderRadius: 8,
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--primary)',
          }}
        />

        Hospital White
      </div>
    );
  }

  return (
    <div
    // style={{
    //   display: 'flex',
    //   alignItems: 'center',
    //   gap: 8,
    //   padding: '6px 12px',
    //   borderRadius: 10,
    //   border: '1px solid var(--border)',
    //   background: 'var(--bg-surface)',
    //   color: 'var(--text-primary)',
    //   fontSize: 12,
    //   fontWeight: 600,
    // }}
    >
      {/* <span
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'var(--primary)',
          boxShadow: '0 0 6px rgba(37, 99, 235, 0.25)',
        }}
      /> */}

      {/* Theme: Hospital White */}
    </div>
  );
}