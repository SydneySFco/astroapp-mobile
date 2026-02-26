type EnvConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  reliabilityStateStoreDriver: 'supabase' | 'postgres' | 'file';
  reliabilityStateStoreTable: string;
  reliabilityReplayMaxCount: number;
  reliabilityReplayBaseBackoffMs: number;
  reliabilityReplayMaxBackoffMs: number;
  reliabilityReplayJitterFactor: number;
};

const readEnv = (key: string): string => {
  const value = (globalThis as {process?: {env?: Record<string, string | undefined>}})
    .process?.env?.[key];

  return value?.trim() ?? '';
};

const readNumberEnv = (key: string, fallback: number): number => {
  const value = Number(readEnv(key));
  return Number.isFinite(value) ? value : fallback;
};

const readStateStoreDriver = (): EnvConfig['reliabilityStateStoreDriver'] => {
  const raw = readEnv('RELIABILITY_STATE_STORE_DRIVER').toLowerCase();
  if (raw === 'supabase' || raw === 'postgres' || raw === 'file') {
    return raw;
  }

  return 'supabase';
};

export const env: EnvConfig = {
  supabaseUrl: readEnv('SUPABASE_URL'),
  supabaseAnonKey: readEnv('SUPABASE_ANON_KEY'),
  reliabilityStateStoreDriver: readStateStoreDriver(),
  reliabilityStateStoreTable: readEnv('RELIABILITY_STATE_STORE_TABLE') || 'watermark_state',
  reliabilityReplayMaxCount: Math.max(1, readNumberEnv('RELIABILITY_REPLAY_MAX_COUNT', 8)),
  reliabilityReplayBaseBackoffMs: Math.max(
    1,
    readNumberEnv('RELIABILITY_REPLAY_BASE_BACKOFF_MS', 500),
  ),
  reliabilityReplayMaxBackoffMs: Math.max(
    1,
    readNumberEnv('RELIABILITY_REPLAY_MAX_BACKOFF_MS', 60_000),
  ),
  reliabilityReplayJitterFactor: Math.min(
    1,
    Math.max(0, readNumberEnv('RELIABILITY_REPLAY_JITTER_FACTOR', 0.2)),
  ),
};

export const isSupabaseConfigured =
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
