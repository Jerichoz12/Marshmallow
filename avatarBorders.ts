// AAA Avatar Frame System - Strictly 2 Borders: Quantum Void Weaver & Slate Gray Bevel

export type RarityTier = 'Common' | 'Cosmic';

export type FrameTheme = 'tech';

export type FrameStyle =
  | 'tech_quantum'
  | 'heavy_metallic'
  | 'dragon_sovereign'
  | 'lion_monarch'
  | 'phoenix_wings'
  | 'angelic_divine'
  | 'demonic_nether'
  | 'royal_crown'
  | 'cyber_exoskeleton'
  | 'cosmic_galaxy'
  | 'crystal_prism'
  | 'ice_frost'
  | 'fire_inferno'
  | 'nature_ancient'
  | 'neon_plasma';

export type AnimationStyle =
  | 'spin-slow'
  | 'none'
  | 'spin-reverse'
  | 'particle-orbit'
  | 'pulse-aura'
  | 'shimmer-flow';

export interface BorderDesign {
  id: number;
  name: string;
  rarity: RarityTier;
  theme: FrameTheme;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  glowColor: string;
  frameStyle: FrameStyle;
  animation: AnimationStyle;
  hasOrbit?: boolean;
  hasSparks?: boolean;
  hasGems?: boolean;
}

export const RARITY_CONFIG: Record<RarityTier, { name: string; color: string; badgeBg: string; textGradient: string; borderGlow: string }> = {
  Common: {
    name: 'Common',
    color: '#94a3b8',
    badgeBg: 'bg-slate-800/90 text-slate-300 border-slate-700',
    textGradient: 'from-slate-300 to-slate-400',
    borderGlow: 'rgba(148, 163, 184, 0.4)'
  },
  Cosmic: {
    name: 'Cosmic',
    color: '#00f0ff',
    badgeBg: 'bg-cyan-950/90 text-cyan-200 border-cyan-400 animate-pulse',
    textGradient: 'from-cyan-300 via-purple-400 to-emerald-300',
    borderGlow: 'rgba(0, 240, 255, 0.85)'
  }
};

// Deterministic seed converter: 0 = Quantum Void Weaver (Devs), 1 = Slate Gray Bevel (Ordinary)
export function getBorderIdFromSeed(seed?: string): number {
  if (!seed) return 1;
  const clean = seed.trim().toLowerCase();
  if (
    clean.includes('143456') ||
    clean.includes('547257') ||
    clean.includes('537212') ||
    clean.includes('official admin') ||
    clean.includes('sweet dev') ||
    clean.includes('marshmallow dev') ||
    clean.includes('dev')
  ) {
    return 0; // Quantum Void Weaver
  }
  return 1; // Slate Gray Bevel
}

// Exactly 2 Border Designs allowed
export const BORDER_DESIGNS: BorderDesign[] = [
  {
    id: 0,
    name: 'Quantum Void Weaver',
    rarity: 'Cosmic',
    theme: 'tech',
    primaryColor: '#00f0ff',
    secondaryColor: '#7c3aed',
    accentColor: '#39ff14',
    glowColor: 'rgba(0, 240, 255, 0.85)',
    frameStyle: 'tech_quantum',
    animation: 'spin-slow',
    hasOrbit: true,
    hasSparks: true,
    hasGems: true
  },
  {
    id: 1,
    name: 'Slate Gray Bevel',
    rarity: 'Common',
    theme: 'tech',
    primaryColor: '#475569',
    secondaryColor: '#1e293b',
    accentColor: '#cbd5e1',
    glowColor: 'rgba(71, 85, 105, 0.4)',
    frameStyle: 'heavy_metallic',
    animation: 'none'
  }
];

export function getBorderDesign(borderId?: number, seed?: string): BorderDesign {
  if (borderId !== undefined && borderId !== null) {
    if (borderId === 0 || borderId === 6) return BORDER_DESIGNS[0];
    if (borderId === 1 || borderId === 108) return BORDER_DESIGNS[1];
    return BORDER_DESIGNS[borderId % BORDER_DESIGNS.length] || BORDER_DESIGNS[1];
  }
  const defaultId = getBorderIdFromSeed(seed);
  return BORDER_DESIGNS[defaultId] || BORDER_DESIGNS[1];
}
