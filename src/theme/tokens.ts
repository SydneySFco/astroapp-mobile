export type ThemeMode = 'light' | 'dark';

export type ColorScale = {
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  bg: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  success: string;
  warning: string;
  error: string;
  accent: string;
  border: string;
  overlay: string;
};

export const colorTokens: Record<ThemeMode, ColorScale> = {
  light: {
    primary: '#6C5CE7',
    primaryPressed: '#5B4BD6',
    primarySoft: '#EEEAFE',
    bg: '#F7F8FC',
    surface: '#FFFFFF',
    textPrimary: '#1E2233',
    textSecondary: '#5F6785',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444',
    accent: '#14B8A6',
    border: '#E6E9F5',
    overlay: 'rgba(15,18,32,0.48)',
  },
  dark: {
    primary: '#9B8CFF',
    primaryPressed: '#8D7CFF',
    primarySoft: '#2A2446',
    bg: '#0F1220',
    surface: '#171A2B',
    textPrimary: '#F4F6FF',
    textSecondary: '#B6BEDD',
    success: '#4ADE80',
    warning: '#FBBF24',
    error: '#F87171',
    accent: '#2DD4BF',
    border: '#2A2F47',
    overlay: 'rgba(0,0,0,0.56)',
  },
};

export const alpha = (hex: string, opacity: number) => {
  const normalized = hex.replace('#', '');
  const fullHex =
    normalized.length === 3
      ? normalized
          .split('')
          .map(char => `${char}${char}`)
          .join('')
      : normalized;

  const r = parseInt(fullHex.slice(0, 2), 16);
  const g = parseInt(fullHex.slice(2, 4), 16);
  const b = parseInt(fullHex.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
