import type { PropertyGroup } from '@polypoly/engine';

export { computeBoardLayout, type BoardLayout, type TileSide } from '@polypoly/engine';

export type Axis = 'row' | 'col';

/**
 * The outer ring of tracks (row/col 1 and gridSize — where every tile
 * lives) is weighted heavier than the interior tracks (the empty center),
 * so tiles get more of the board's pixels and the center shrinks, instead
 * of an even 1/gridSize split. Every ring track shares the same weight (and
 * every interior track shares the same weight), so all tiles stay the same
 * size as each other and the center still grows/shrinks as one leftover
 * block.
 */
export const EDGE_TRACK_WEIGHT = 2.4;
export const INTERIOR_TRACK_WEIGHT = 1.35;

function trackWeight(track: number, gridSize: number): number {
  return track === 1 || track === gridSize ? EDGE_TRACK_WEIGHT : INTERIOR_TRACK_WEIGHT;
}

/** Cumulative fraction (0..1) of the board's width/height after `n` tracks. */
function trackBoundaries(gridSize: number): number[] {
  const boundaries = [0];
  let acc = 0;
  let total = 0;
  for (let t = 1; t <= gridSize; t++) total += trackWeight(t, gridSize);
  for (let t = 1; t <= gridSize; t++) {
    acc += trackWeight(t, gridSize);
    boundaries.push(acc / total);
  }
  return boundaries;
}

export function weightedGridTemplateColumns(gridSize: number): string {
  const edge = `minmax(0, ${EDGE_TRACK_WEIGHT}fr)`;
  const interior = Array.from({ length: gridSize - 2 }, () => `minmax(0, ${INTERIOR_TRACK_WEIGHT}fr)`).join(' ');
  return `${edge} ${interior} ${edge}`;
}

export function weightedGridTemplateRows(gridSize: number): string {
  return weightedGridTemplateColumns(gridSize);
}

/** Where a track's centerline (1-indexed) sits, as a 0-100 percent of the board along `axis`. */
export function trackCenterPercent(track: number, gridSize: number, _axis: Axis): number {
  const b = trackBoundaries(gridSize);
  return ((b[track - 1]! + b[track]!) / 2) * 100;
}

/** Where the boundary right after track `n` sits, as a 0-100 percent of the board along `axis`. */
export function trackBoundaryPercent(n: number, gridSize: number, _axis: Axis): number {
  return trackBoundaries(gridSize)[n]! * 100;
}

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
  portugal: `<svg width="100%" height="100%" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#ff0000"/><rect width="1.2" height="2" fill="#046a38"/><circle cx="1.2" cy="1" r="0.35" fill="#ffcc00" stroke="#ff0000" stroke-width="0.05"/></svg>`,
  greece: `<svg width="100%" height="100%" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#0d5eaf"/>
    <rect y="0" width="3" height="0.222" fill="#fff"/><rect y="0.444" width="3" height="0.222" fill="#fff"/>
    <rect y="0.888" width="3" height="0.222" fill="#fff"/><rect y="1.333" width="3" height="0.222" fill="#fff"/>
    <rect y="1.777" width="3" height="0.223" fill="#fff"/>
    <rect width="1.111" height="1.111" fill="#0d5eaf"/>
    <rect x="0.444" width="0.222" height="1.111" fill="#fff"/><rect y="0.444" width="1.111" height="0.222" fill="#fff"/></svg>`,
  norway: `<svg width="100%" height="100%" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#ba0c2f"/>
    <rect x="0.8" width="0.5" height="2" fill="#fff"/><rect y="0.75" width="3" height="0.5" fill="#fff"/>
    <rect x="0.9" width="0.3" height="2" fill="#00205b"/><rect y="0.85" width="3" height="0.3" fill="#00205b"/></svg>`,
  netherlands: `<svg width="100%" height="100%" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="0.667" fill="#ae1c28"/><rect y="0.667" width="3" height="0.667" fill="#fff"/><rect y="1.333" width="3" height="0.667" fill="#21468b"/></svg>`,
  spain: `<svg width="100%" height="100%" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#aa151b"/><rect y="0.5" width="3" height="1" fill="#f1bf00"/></svg>`,
  italy: `<svg width="100%" height="100%" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="1" height="2" fill="#009246"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ce2b37"/></svg>`,
  uk: `<svg width="100%" height="100%" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="3" height="2" fill="#00247d"/>
    <path d="M0,0 L3,2 M3,0 L0,2" stroke="#fff" stroke-width="0.4"/>
    <path d="M0,0 L3,2 M3,0 L0,2" stroke="#cf142b" stroke-width="0.13"/>
    <path d="M1.5,0 V2 M0,1 H3" stroke="#fff" stroke-width="0.66"/>
    <path d="M1.5,0 V2 M0,1 H3" stroke="#cf142b" stroke-width="0.4"/></svg>`,
  france: `<svg width="100%" height="100%" viewBox="0 0 3 2" preserveAspectRatio="xMidYMid slice"><rect width="1" height="2" fill="#0055a4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#ef4135"/></svg>`,
};
