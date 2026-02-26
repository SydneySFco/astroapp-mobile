type EnvConfig = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

const readEnv = (key: string): string => {
  const value = (globalThis as {process?: {env?: Record<string, string | undefined>}})
    .process?.env?.[key];

  return value?.trim() ?? '';
};

export const env: EnvConfig = {
  supabaseUrl: readEnv('SUPABASE_URL'),
  supabaseAnonKey: readEnv('SUPABASE_ANON_KEY'),
};

export const isSupabaseConfigured =
  env.supabaseUrl.length > 0 && env.supabaseAnonKey.length > 0;
