import {ThemePreference} from '../../theme/tokens';

export type ThemeStorage = {
  getPreference: () => Promise<ThemePreference | null>;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

let memoryPreference: ThemePreference | null = null;

/**
 * Placeholder storage abstraction.
 * Replace with AsyncStorage/secure persisted storage when infra is finalized.
 */
export const themeStorage: ThemeStorage = {
  async getPreference() {
    return memoryPreference;
  },
  async setPreference(preference) {
    memoryPreference = preference;
  },
};