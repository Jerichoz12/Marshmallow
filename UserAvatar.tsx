import React, { useId, useState } from 'react';
import { BORDER_DESIGNS, getBorderIdFromSeed, getBorderDesign, BorderDesign, RARITY_CONFIG } from '../utils/avatarBorders';

export interface UserAvatarProps {
  userId?: string;
  borderId?: number;
  src?: string | null;
  username?: string;
  nickname?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | number;
  shape?: 'circle' | 'square';
  className?: string;
  imageClassName?: string;
  showStatus?: boolean;
  status?: 'online' | 'offline' | 'busy' | 'away' | string;
  onClick?: () => void;
  title?: string;
  showBorderNameTooltip?: boolean;
  showRarityBadge?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = React.memo(({
  userId,
  borderId,
  src,
  username = 'user',
  nickname,
  size = 'md',
  shape = 'circle',
  className = '',
  imageClassName = '',
  showStatus = false,
  status = 'offline',
  onClick,
  title,
  showBorderNameTooltip = false,
  showRarityBadge = false
}) => {
  const instanceId = useId().replace(/:/g, '');
  const [imageError, setImageError] = useState(false);

  const effectiveAvatarSrc = React.useMemo(() => {
    if (src && typeof src === 'string' && src.trim() !== '') {
      return src.trim();
    }
    return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username || userId || 'user')}`;
  }, [src, username, userId]);

  React.useEffect(() => {
    setImageError(false);
  }, [effectiveAvatarSrc]);

  // Determine border design
  const design: BorderDesign = getBorderDesign(borderId, userId || username);
  const rarityInfo = RARITY_CONFIG[design.rarity] || RARITY_CONFIG.Common;

  // Resolve pixel size
  let pxSize = 40;
  if (typeof size === 'number') {
    pxSize = size;
  } else {
    switch (size) {
      case 'xs': pxSize = 28; break;
      case 'sm': pxSize = 36; break;
      case 'md': pxSize = 48; break;
      case 'lg': pxSize = 60; break;
      case 'xl': pxSize = 80; break;
      case '2xl': pxSize = 110; break;
      case '3xl': pxSize = 144; break;
      default: pxSize = 48;
    }
  }

  // Animation classes
  let spinClass = '';
  if (design.animation === 'spin-slow') spinClass = 'animate-[spin_16s_linear_infinite]';
  else if (design.animation === 'spin-reverse') spinClass = 'animate-[spin_14s_linear_infinite_reverse]';
  else if (design.animation === 'particle-orbit') spinClass = 'animate-[spin_10s_linear_infinite]';

  // Gradient IDs for unique SVG instances
  const metalGradId = `metal-${design.id}-${instanceId}`;
  const metalGrad2Id = `metal2-${design.id}-${instanceId}`;
  const shimmerGradId = `shimmer-${design.id}-${instanceId}`;
  const glowFilterId = `glow-${design.id}-${instanceId}`;

  const isCircle = shape === 'circle';

  return (
    <div
      onClick={onClick}
      title={
        title ||
        (showBorderNameTooltip
          ? `${nickname || username} • [${design.rarity}] ${design.name}`
          : nickname || username)
      }
      style={{ width: `${pxSize}px`, height: `${pxSize}px` }}
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${
        onClick ? 'cursor-pointer hover:scale-105 transition-transform duration-200' : ''
      } ${className}`}
    >
      {/* ================= SVG AAA FRAME OVERLAY ================= */}
      <svg
        className="absolute inset-0 w-full h-full overflow-visible pointer-events-none z-10"
        viewBox="0 0 200 200"
      >
        <defs>
          {/* Main 3D Metallic Gradient with multi-stop bevel effect */}
          <linearGradient id={metalGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={design.primaryColor} />
            <stop offset="25%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="50%" stopColor={design.secondaryColor} />
            <stop offset="75%" stopColor={design.primaryColor} />
            <stop offset="100%" stopColor={design.accentColor} />
          </linearGradient>

          <linearGradient id={metalGrad2Id} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={design.accentColor} />
            <stop offset="35%" stopColor={design.secondaryColor} />
            <stop offset="70%" stopColor={design.primaryColor} />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.9" />
          </linearGradient>

          {/* Shimmering Reflection Sweep */}
          <linearGradient id={shimmerGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>

          {/* Heavy 3D Aura Blur Filter */}
          <filter id={glowFilterId} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. BACKGROUND AURA GLOW LAYER */}
        <circle
          cx="100"
          cy="100"
          r="72"
          fill="none"
          stroke={design.glowColor}
          strokeWidth="14"
          opacity="0.6"
          filter={`url(#${glowFilterId})`}
          className={design.animation === 'pulse-aura' ? 'animate-aura-pulse' : ''}
        />

        {/* 2. ORBITAL PARTICLES / RUNE RINGS (Outside the face zone) */}
        {design.hasOrbit && (
          <g className={spinClass} style={{ transformOrigin: '100px 100px' }}>
            <circle
              cx="100"
              cy="100"
              r="88"
              fill="none"
              stroke={design.accentColor}
              strokeWidth="2"
              strokeDasharray="6 14 3 14"
              opacity="0.8"
            />
            <circle cx="100" cy="12" r="4" fill={design.accentColor} />
            <circle cx="188" cy="100" r="4" fill={design.primaryColor} />
            <circle cx="100" cy="188" r="4" fill={design.secondaryColor} />
            <circle cx="12" cy="100" r="4" fill={design.accentColor} />
          </g>
        )}

        {/* Floating Sparks */}
        {design.hasSparks && (
          <g className="animate-particle-spark">
            <circle cx="35" cy="35" r="2.5" fill={design.accentColor} />
            <circle cx="165" cy="35" r="2.5" fill={design.primaryColor} />
            <circle cx="25" cy="160" r="2" fill={design.secondaryColor} />
            <circle cx="175" cy="160" r="2" fill={design.accentColor} />
          </g>
        )}

        {/* 3. MAIN HEAVY 3D METALLIC ARMOR FRAME */}
        {isCircle ? (
          <g>
            {/* Outer Bevel Shadow */}
            <circle
              cx="100"
              cy="100"
              r="71"
              fill="none"
              stroke="#0f172a"
              strokeWidth="18"
              opacity="0.85"
            />
            {/* Core 3D Metallic Body */}
            <circle
              cx="100"
              cy="100"
              r="70"
              fill="none"
              stroke={`url(#${metalGradId})`}
              strokeWidth="15"
              strokeLinecap="round"
            />
            {/* Inner Specular Bevel Line */}
            <circle
              cx="100"
              cy="100"
              r="62"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              opacity="0.7"
            />
            {/* Outer Specular Rim */}
            <circle
              cx="100"
              cy="100"
              r="77.5"
              fill="none"
              stroke={`url(#${metalGrad2Id})`}
              strokeWidth="2"
              opacity="0.9"
            />
          </g>
        ) : (
          <g>
            {/* Outer Bevel Shadow Square */}
            <rect
              x="25"
              y="25"
              width="150"
              height="150"
              rx="28"
              fill="none"
              stroke="#0f172a"
              strokeWidth="18"
              opacity="0.85"
            />
            {/* Core Metallic Body Square */}
            <rect
              x="26"
              y="26"
              width="148"
              height="148"
              rx="26"
              fill="none"
              stroke={`url(#${metalGradId})`}
              strokeWidth="15"
            />
            {/* Inner Specular Line */}
            <rect
              x="33"
              y="33"
              width="134"
              height="134"
              rx="20"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              opacity="0.7"
            />
          </g>
        )}

        {/* 4. THEME-SPECIFIC 3D SCULPTURES & CRESTS */}

        {/* DRAGON SOVEREIGN FRAME */}
        {design.frameStyle === 'dragon_sovereign' && (
          <g>
            {/* 3D Dragon Horns at Top */}
            <path
              d="M 65 35 Q 40 10 25 15 Q 45 28 68 40 Z"
              fill={`url(#${metalGrad2Id})`}
              stroke="#000"
              strokeWidth="1.5"
            />
            <path
              d="M 135 35 Q 160 10 175 15 Q 155 28 132 40 Z"
              fill={`url(#${metalGrad2Id})`}
              stroke="#000"
              strokeWidth="1.5"
            />
            {/* Dragon Head / Crest Emblem at top center */}
            <polygon
              points="100,12 112,30 100,24 88,30"
              fill={design.accentColor}
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            {/* Dragon Scale Plates at sides */}
            <path d="M 15 90 L 25 100 L 15 110 Z" fill={design.primaryColor} />
            <path d="M 185 90 L 175 100 L 185 110 Z" fill={design.primaryColor} />
          </g>
        )}

        {/* LION MONARCH FRAME */}
        {design.frameStyle === 'lion_monarch' && (
          <g>
            {/* Majestic Golden Lion Crown Mantle */}
            <path
              d="M 70 28 Q 100 8 130 28 L 120 40 Q 100 24 80 40 Z"
              fill={`url(#${metalGrad2Id})`}
              stroke="#000"
              strokeWidth="1.5"
            />
            <polygon points="100,5 108,20 100,16 92,20" fill={design.accentColor} />
            <circle cx="100" cy="24" r="5" fill="#ef4444" stroke="#fff" strokeWidth="1" />
            {/* Bottom Filigree Plate */}
            <path
              d="M 80 172 Q 100 190 120 172 L 112 160 Q 100 170 88 160 Z"
              fill={`url(#${metalGradId})`}
            />
          </g>
        )}

        {/* PHOENIX WINGS FRAME */}
        {design.frameStyle === 'phoenix_wings' && (
          <g>
            {/* Spreading Fiery Phoenix Wings Left & Right */}
            <path
              d="M 30 100 Q 5 70 0 40 Q 25 60 42 76 Q 10 30 30 10 Q 45 45 52 65 Z"
              fill={design.primaryColor}
              stroke="#fff"
              strokeWidth="1"
            />
            <path
              d="M 170 100 Q 195 70 200 40 Q 175 60 158 76 Q 190 30 170 10 Q 155 45 148 65 Z"
              fill={design.primaryColor}
              stroke="#fff"
              strokeWidth="1"
            />
            <circle cx="100" cy="20" r="6" fill={design.accentColor} className="animate-pulse" />
          </g>
        )}

        {/* ANGELIC DIVINE FRAME */}
        {design.frameStyle === 'angelic_divine' && (
          <g>
            {/* Divine Golden Celestial Halo above */}
            <ellipse
              cx="100"
              cy="20"
              rx="45"
              ry="10"
              fill="none"
              stroke={design.accentColor}
              strokeWidth="4"
              filter={`url(#${glowFilterId})`}
            />
            {/* Triple Tier Feathered Wings */}
            <path
              d="M 32 85 Q 8 50 15 25 Q 32 45 46 65 Z"
              fill="#ffffff"
              stroke={design.primaryColor}
              strokeWidth="1.5"
            />
            <path
              d="M 168 85 Q 192 50 185 25 Q 168 45 154 65 Z"
              fill="#ffffff"
              stroke={design.primaryColor}
              strokeWidth="1.5"
            />
          </g>
        )}

        {/* DEMONIC NETHER FRAME */}
        {design.frameStyle === 'demonic_nether' && (
          <g>
            {/* Obsidian Nether Horns */}
            <path
              d="M 60 38 Q 30 15 15 5 Q 35 30 52 48 Z"
              fill="#1e1b4b"
              stroke={design.primaryColor}
              strokeWidth="2"
            />
            <path
              d="M 140 38 Q 170 15 185 5 Q 165 30 148 48 Z"
              fill="#1e1b4b"
              stroke={design.primaryColor}
              strokeWidth="2"
            />
            {/* Crimson Demon Eye Core */}
            <polygon points="100,16 110,28 100,36 90,28" fill="#f43f5e" />
            <circle cx="100" cy="27" r="3" fill="#000" />
          </g>
        )}

        {/* ROYAL CROWN FRAME */}
        {design.frameStyle === 'royal_crown' && (
          <g>
            {/* 3D Imperial Crown mounted on top */}
            <path
              d="M 75 32 L 80 12 L 90 24 L 100 8 L 110 24 L 120 12 L 125 32 Z"
              fill={`url(#${metalGrad2Id})`}
              stroke="#000"
              strokeWidth="1.5"
            />
            {/* Crown Jewels */}
            <circle cx="80" cy="12" r="3" fill="#ef4444" />
            <circle cx="100" cy="8" r="4" fill="#38bdf8" />
            <circle cx="120" cy="12" r="3" fill="#ef4444" />
          </g>
        )}

        {/* CYBER EXOSKELETON FRAME */}
        {design.frameStyle === 'cyber_exoskeleton' && (
          <g>
            {/* Corner Armor Brackets */}
            <path d="M 20 50 L 20 20 L 50 20" fill="none" stroke={design.primaryColor} strokeWidth="6" />
            <path d="M 180 50 L 180 20 L 150 20" fill="none" stroke={design.primaryColor} strokeWidth="6" />
            <path d="M 20 150 L 20 180 L 50 180" fill="none" stroke={design.primaryColor} strokeWidth="6" />
            <path d="M 180 150 L 180 180 L 150 180" fill="none" stroke={design.primaryColor} strokeWidth="6" />
            {/* Illuminated Nodes */}
            <rect x="16" y="16" width="8" height="8" fill={design.accentColor} />
            <rect x="176" y="16" width="8" height="8" fill={design.accentColor} />
            <rect x="16" y="176" width="8" height="8" fill={design.accentColor} />
            <rect x="176" y="176" width="8" height="8" fill={design.accentColor} />
          </g>
        )}

        {/* COSMIC GALAXY FRAME */}
        {design.frameStyle === 'cosmic_galaxy' && (
          <g className={spinClass} style={{ transformOrigin: '100px 100px' }}>
            <ellipse
              cx="100"
              cy="100"
              rx="88"
              ry="32"
              fill="none"
              stroke={design.accentColor}
              strokeWidth="3.5"
              transform="rotate(30 100 100)"
              opacity="0.9"
            />
            <ellipse
              cx="100"
              cy="100"
              rx="88"
              ry="32"
              fill="none"
              stroke={design.primaryColor}
              strokeWidth="3.5"
              transform="rotate(-30 100 100)"
              opacity="0.9"
            />
          </g>
        )}

        {/* CRYSTAL PRISM FRAME */}
        {design.frameStyle === 'crystal_prism' && (
          <g>
            {/* Faceted Crystal Shards around outer ring */}
            <polygon points="100,5 108,22 92,22" fill={design.accentColor} stroke="#fff" strokeWidth="1" />
            <polygon points="195,100 178,108 178,92" fill={design.accentColor} stroke="#fff" strokeWidth="1" />
            <polygon points="100,195 92,178 108,178" fill={design.accentColor} stroke="#fff" strokeWidth="1" />
            <polygon points="5,100 22,92 22,108" fill={design.accentColor} stroke="#fff" strokeWidth="1" />
          </g>
        )}

        {/* ICE FROST FRAME */}
        {design.frameStyle === 'ice_frost' && (
          <g>
            {/* Glacial Spikes */}
            <path d="M 100 2 L 106 25 L 94 25 Z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M 198 100 L 175 106 L 175 94 Z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M 100 198 L 94 175 L 106 175 Z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M 2 100 L 25 94 L 25 106 Z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="1.5" />
          </g>
        )}

        {/* FIRE INFERNO FRAME */}
        {design.frameStyle === 'fire_inferno' && (
          <g className="animate-pulse">
            <path d="M 100 0 Q 108 15 100 28 Q 92 15 100 0 Z" fill="#ef4444" />
            <path d="M 200 100 Q 185 108 172 100 Q 185 92 200 100 Z" fill="#f97316" />
            <path d="M 100 200 Q 92 185 100 172 Q 108 185 100 200 Z" fill="#ef4444" />
            <path d="M 0 100 Q 15 92 28 100 Q 15 108 0 100 Z" fill="#f97316" />
          </g>
        )}

        {/* NATURE ANCIENT FRAME */}
        {design.frameStyle === 'nature_ancient' && (
          <g>
            {/* Golden Spirit Leaves */}
            <circle cx="100" cy="18" r="6" fill="#10b981" stroke="#fff" strokeWidth="1" />
            <circle cx="182" cy="100" r="6" fill="#10b981" stroke="#fff" strokeWidth="1" />
            <circle cx="100" cy="182" r="6" fill="#10b981" stroke="#fff" strokeWidth="1" />
            <circle cx="18" cy="100" r="6" fill="#10b981" stroke="#fff" strokeWidth="1" />
          </g>
        )}

        {/* TECH QUANTUM FRAME */}
        {design.frameStyle === 'tech_quantum' && (
          <g>
            <circle cx="30" cy="30" r="6" fill={design.accentColor} />
            <circle cx="170" cy="30" r="6" fill={design.accentColor} />
            <circle cx="30" cy="170" r="6" fill={design.accentColor} />
            <circle cx="170" cy="170" r="6" fill={design.accentColor} />
          </g>
        )}

        {/* NEON PLASMA FRAME */}
        {design.frameStyle === 'neon_plasma' && (
          <g>
            <circle
              cx="100"
              cy="100"
              r="82"
              fill="none"
              stroke={design.primaryColor}
              strokeWidth="4"
              filter={`url(#${glowFilterId})`}
            />
          </g>
        )}

        {/* 5. MOUNTED CORNER JEWELS (If enabled) */}
        {design.hasGems && (
          <g>
            <polygon points="100,18 106,26 100,34 94,26" fill={design.accentColor} stroke="#fff" strokeWidth="1" />
            <polygon points="182,100 174,106 166,100 174,94" fill={design.accentColor} stroke="#fff" strokeWidth="1" />
            <polygon points="100,182 94,174 100,166 106,174" fill={design.accentColor} stroke="#fff" strokeWidth="1" />
            <polygon points="18,100 26,94 34,100 26,106" fill={design.accentColor} stroke="#fff" strokeWidth="1" />
          </g>
        )}

        {/* LIVE SHIMMER REFLECTION SWEEP */}
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke={`url(#${shimmerGradId})`}
          strokeWidth="14"
          opacity="0.5"
        />
      </svg>

      {/* ================= USER PROFILE PICTURE ================= */}
      {/* Strictly masked inside circle r=52 (so face is NEVER covered) */}
      <div
        className={`w-[60%] h-[60%] flex items-center justify-center overflow-hidden z-0 shadow-inner ${
          isCircle ? 'rounded-full' : 'rounded-2xl'
        }`}
      >
        {!imageError && effectiveAvatarSrc ? (
          <img
            src={effectiveAvatarSrc}
            alt={nickname || username}
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover bg-slate-900 ${
              isCircle ? 'rounded-full' : 'rounded-2xl'
            } ${imageClassName}`}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center bg-slate-800 text-slate-200 border border-slate-700 font-black uppercase tracking-wider select-none ${
              isCircle ? 'rounded-full' : 'rounded-2xl'
            } ${imageClassName}`}
            style={{ fontSize: `${Math.max(10, Math.round(pxSize * 0.25))}px` }}
          >
            {(nickname || username || 'U').charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* ================= ONLINE STATUS BADGE ================= */}
      {showStatus && (
        <span
          style={{
            width: `${Math.max(10, Math.round(pxSize * 0.22))}px`,
            height: `${Math.max(10, Math.round(pxSize * 0.22))}px`
          }}
          className={`absolute bottom-[8%] right-[8%] rounded-full border-2 border-[#18191a] z-20 shadow-md ${
            status === 'online'
              ? 'bg-emerald-500'
              : status === 'busy'
              ? 'bg-rose-500'
              : status === 'away'
              ? 'bg-amber-500'
              : 'bg-slate-500'
          }`}
        />
      )}

      {/* ================= RARITY BADGE TAG ================= */}
      {showRarityBadge && (
        <span
          className={`absolute -bottom-2 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border z-20 shadow-md ${rarityInfo.badgeBg}`}
        >
          {design.rarity}
        </span>
      )}
    </div>
  );
});

UserAvatar.displayName = 'UserAvatar';
