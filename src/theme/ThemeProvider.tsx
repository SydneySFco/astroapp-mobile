import React, {createContext, useContext, useEffect, useMemo, useState} from 'react';
import {Appearance, ColorSchemeName} from 'react-native';

import {themeStorage} from '../services/theme/themeStorage';
import {AppColors, getColors} from './colors';
import {ThemeMode, ThemePreference} from './tokens';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedMode: ThemeMode;
  colors: AppColors;
  setPreference: (next: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const mapSchemeToMode = (scheme: ColorSchemeName | null | undefined): ThemeMode =>
  scheme === 'light' ? 'light' : 'dark';

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [systemMode, setSystemMode] = useState<ThemeMode>(mapSchemeToMode(Appearance.getColorScheme()));

  useEffect(() => {
    themeStorage.getPreference().then(stored => {
      if (stored) {
        setPreferenceState(stored);
      }
    });

    const subscription = Appearance.addChangeListener(({colorScheme}) => {
      setSystemMode(mapSchemeToMode(colorScheme));
    });

    return () => subscription.remove();
  }, []);

  const resolvedMode = preference === 'system' ? systemMode : preference;

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedMode,
      colors: getColors(resolvedMode),
      setPreference: async (next: ThemePreference) => {
        setPreferenceState(next);
        await themeStorage.setPreference(next);
      },
    }),
    [preference, resolvedMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
