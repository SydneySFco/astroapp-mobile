import {alpha, colorTokens, ThemeMode} from './tokens';

let themeMode: ThemeMode = 'dark';
const palette = colorTokens[themeMode];

export const colors = {
  background: palette.bg,
  card: palette.surface,
  textPrimary: palette.textPrimary,
  textSecondary: palette.textSecondary,

  primary: palette.primary,
  primaryPressed: palette.primaryPressed,
  primarySoft: palette.primarySoft,

  border: palette.border,
  overlay: palette.overlay,
  accent: palette.accent,

  success: palette.success,
  warning: palette.warning,
  error: palette.error,
  danger: palette.error,

  ctaPrimaryText: {
    light: '#FFFFFF',
    dark: '#1E2233',
  }[themeMode],
  ctaSecondaryText: palette.textPrimary,
  ctaGhostText: palette.primary,

  cardBorder: palette.border,

  stateSuccessBg: alpha(palette.success, 0.12),
  stateWarningBg: alpha(palette.warning, 0.12),
  stateErrorBg: alpha(palette.error, 0.12),
  stateInfoBg: alpha(palette.accent, 0.12),
};
