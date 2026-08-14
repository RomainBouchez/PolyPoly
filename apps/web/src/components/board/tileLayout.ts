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
