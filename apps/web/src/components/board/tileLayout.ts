import type { PropertyGroup } from '@polypoly/engine';

export { computeBoardLayout, type BoardLayout, type TileSide } from '@polypoly/engine';

export const GROUP_COLORS: Record<PropertyGroup, string> = {
  portugal: '#a16207',
  greece: '#0ea5e9',
  norway: '#7c3aed',
  netherlands: '#f97316',
  spain: '#dc2626',
  italy: '#16a34a',
  uk: '#4338ca',
  france: '#db2777',
};

export const GROUP_FLAGS: Record<PropertyGroup, string> = {
  portugal: '🇵🇹',
  greece: '🇬🇷',
  norway: '🇳🇴',
  netherlands: '🇳🇱',
  spain: '🇪🇸',
  italy: '🇮🇹',
  uk: '🇬🇧',
  france: '🇫🇷',
};

/**
 * Hand-rolled inline SVGs (viewBox 0 0 3 2, standard flag ratio) — no
 * external requests, renders identically everywhere regardless of the OS's
 * emoji font (some platforms show a two-letter code instead of a real flag).
 */
export const GROUP_FLAG_SVG: Record<PropertyGroup, string> = {
  portugal: `<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#ff0000"/><rect width="1.2" height="2" fill="#046a38"/><circle cx="1.2" cy="1" r="0.35" fill="#ffcc00" stroke="#ff0000" stroke-width="0.05"/></svg>`,
  greece: `<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#0d5eaf"/>
    <rect y="0" width="3" height="0.222" fill="#fff"/><rect y="0.444" width="3" height="0.222" fill="#fff"/>
    <rect y="0.888" width="3" height="0.222" fill="#fff"/><rect y="1.333" width="3" height="0.222" fill="#fff"/>
    <rect y="1.777" width="3" height="0.223" fill="#fff"/>
    <rect width="1.111" height="1.111" fill="#0d5eaf"/>
    <rect x="0.444" width="0.222" height="1.111" fill="#fff"/><rect y="0.444" width="1.111" height="0.222" fill="#fff"/></svg>`,
  norway: `<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#ba0c2f"/>
    <rect x="0.8" width="0.5" height="2" fill="#fff"/><rect y="0.75" width="3" height="0.5" fill="#fff"/>
    <rect x="0.9" width="0.3" height="2" fill="#00205b"/><rect y="0.85" width="3" height="0.3" fill="#00205b"/></svg>`,
  netherlands: `<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="0.667" fill="#ae1c28"/><rect y="0.667" width="3" height="0.667" fill="#fff"/><rect y="1.333" width="3" height="0.667" fill="#21468b"/></svg>`,
  spain: `<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#aa151b"/><rect y="0.5" width="3" height="1" fill="#f1bf00"/></svg>`,
  italy: `<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>`,
  uk: `<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#00247d"/>
    <path d="M0,0 L3,2 M3,0 L0,2" stroke="#fff" stroke-width="0.4"/>
    <path d="M0,0 L3,2 M3,0 L0,2" stroke="#cf142b" stroke-width="0.13"/>
    <path d="M1.5,0 V2 M0,1 H3" stroke="#fff" stroke-width="0.66"/>
    <path d="M1.5,0 V2 M0,1 H3" stroke="#cf142b" stroke-width="0.4"/></svg>`,
  france: `<svg viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="1" height="2" fill="#0055a4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ef4135"/></svg>`,
};
