export type AuthTokens = {
  accessToken: string;
  refreshToken?: string;
};

export type TokenStorage = {
  getTokens: () => Promise<AuthTokens | null>;
  setTokens: (tokens: AuthTokens) => Promise<void>;
  clearTokens: () => Promise<void>;
};

let memoryTokens: AuthTokens | null = null;

/**
 * Placeholder abstraction.
 * Replace this implementation with secure storage integration (Keychain/Keystore)
 * when backend auth is fully enabled.
 */
export const tokenStorage: TokenStorage = {
  async getTokens() {
    return memoryTokens;
  },
  async setTokens(tokens) {
    memoryTokens = tokens;
  },
  async clearTokens() {
    memoryTokens = null;
  },
};
