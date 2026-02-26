import {alpha, colorTokens, ThemeMode} from './tokens';

export type AppColors = {
  background: string;
  card: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  border: string;
  overlay: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  danger: string;
  ctaPrimaryText: string;
  ctaSecondaryText: string;
  ctaGhostText: string;
  cardBorder: string;
  stateSuccessBg: string;
  stateWarningBg: string;
  stateErrorBg: string;
  stateInfoBg: string;
};

export const getColors = (themeMode: ThemeMode): AppColors => {
  const palette = colorTokens[themeMode];

  return {
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
};

// Backward compatible static export for non-migrated screens.
export const colors = getColors('dark');