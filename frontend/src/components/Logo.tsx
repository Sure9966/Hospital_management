'use client';

import React from 'react';

interface LogoProps {
  variant?: 'full' | 'compact' | 'sidebar' | 'login' | 'print' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showBadges?: boolean;
  animated?: boolean;
  className?: string;
}

export default function Logo({
  variant = 'compact',
  size = 'md',
  showBadges = false,
  animated = true,
  className = '',
}: LogoProps) {
  // Dimensions according to size prop
  const iconSizes = {
    sm: 32,
    md: 42,
    lg: 56,
    xl: 80,
  };

  const currentIconSize = iconSizes[size] || 42;

  return (
    <div className={`medicore-hospital-logo variant-${variant} size-${size} ${className}`}>
      {/* Dynamic SVG Brain & Neural Star Emblem */}
      <div className={`logo-emblem-wrapper ${animated ? 'animated-pulse' : ''}`}>
        <svg
          width={currentIconSize}
          height={currentIconSize}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="emblem-svg"
        >
          <defs>
            {/* Primary Neural Gradient */}
            <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>

            {/* Glowing Accent Gradient */}
            <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>

            {/* Subtle Metallic/Cyan Overlay */}
            <linearGradient id="cyanGlow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#4facfe" stopOpacity="0.2" />
            </linearGradient>

            <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Background Ambient Glow Ring */}
          <circle cx="50" cy="50" r="46" fill="url(#brainGrad)" fillOpacity="0.08" stroke="url(#brainGrad)" strokeWidth="1.5" strokeDasharray="4 2" />

          {/* Left Brain Hemisphere - Gyri & Neural Paths */}
          <path
            d="M 47,18 C 36,18 26,24 22,34 C 18,44 20,56 25,65 C 29,72 37,79 47,81 Z"
            fill="url(#brainGrad)"
            fillOpacity="0.15"
            stroke="url(#brainGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 28,34 C 34,36 38,30 46,32 M 23,48 C 30,46 34,54 46,52 M 28,63 C 35,60 39,68 46,67"
            stroke="url(#brainGrad)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Right Brain Hemisphere - Gyri & Neural Paths */}
          <path
            d="M 53,18 C 64,18 74,24 78,34 C 82,44 80,56 75,65 C 71,72 63,79 53,81 Z"
            fill="url(#brainGrad)"
            fillOpacity="0.15"
            stroke="url(#brainGrad)"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M 72,34 C 66,36 62,30 54,32 M 77,48 C 70,46 66,54 54,52 M 72,63 C 65,60 61,68 54,67"
            stroke="url(#brainGrad)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Center Neural Star / Geometric Crest (NEUROSTAR & MEDICORE Emblem) */}
          <g filter="url(#glowFilter)">
            {/* 6-Point Star Core */}
            <path
              d="M 50,26 L 54,42 L 68,50 L 54,58 L 50,74 L 46,58 L 32,50 L 46,42 Z"
              fill="url(#starGrad)"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            {/* Inner Cross Heartbeat Synapse */}
            <circle cx="50" cy="50" r="4" fill="#ffffff" />
          </g>

          {/* Synapse Connection Nodes (Pulsing dots) */}
          <circle cx="50" cy="20" r="2.5" fill="#38bdf8" className="node-pulse" />
          <circle cx="50" cy="80" r="2.5" fill="#38bdf8" className="node-pulse" />
          <circle cx="20" cy="50" r="2.5" fill="#8b5cf6" className="node-pulse" />
          <circle cx="80" cy="50" r="2.5" fill="#8b5cf6" className="node-pulse" />
          <circle cx="30" cy="30" r="2" fill="#0ea5e9" />
          <circle cx="70" cy="30" r="2" fill="#0ea5e9" />
          <circle cx="30" cy="70" r="2" fill="#a855f7" />
          <circle cx="70" cy="70" r="2" fill="#a855f7" />

          {/* Central Stem Line */}
          <line x1="50" y1="14" x2="50" y2="86" stroke="url(#starGrad)" strokeWidth="1.5" strokeDasharray="2 3" />
        </svg>
      </div>

      {/* Typography Section (Rendered when variant is not 'icon') */}
      {variant !== 'icon' && (
        <div className="logo-text-block">
          {/* Primary Hospital Brand Name */}
          <div className="brand-name-row">
            <span className="brand-primary">MEDICORE</span>
            <span className="brand-tm">™</span>
          </div>

          {/* Subtitle Header */}
          <div className="brand-subtitle">
            <span className="subtitle-text">NEURO MULTI SPECIALITY HOSPITAL</span>
          </div>

          {/* Elegant Underline Divider */}
          {(variant === 'full' || variant === 'login' || variant === 'print') && (
            <div className="brand-divider">
              <div className="divider-line" />
              <span className="divider-star">✦</span>
              <div className="divider-line" />
            </div>
          )}

          {/* Specialty Service Badges (24x7 Emergency, Neuro Trauma, Neurosurgery) */}
          {(showBadges || variant === 'full' || variant === 'login' || variant === 'print') && (
            <div className="specialty-badges-row">
              <span className="badge-pill emergency-pill">
                <span className="pill-dot red"></span> 24x7 EMERGENCY
              </span>
              <span className="badge-pill trauma-pill">
                <span className="pill-dot cyan"></span> NEURO TRAUMA
              </span>
              <span className="badge-pill surgery-pill">
                <span className="pill-dot purple"></span> NEUROSURGERY
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
