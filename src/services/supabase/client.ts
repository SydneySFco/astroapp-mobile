import {createClient} from '@supabase/supabase-js';

import {env, isSupabaseConfigured} from '../../config/env';

const fallbackUrl = 'https://placeholder.supabase.co';
const fallbackAnonKey = 'placeholder-anon-key';

/**
 * Single source of truth for Supabase access.
 * If env is not configured yet, client is still created with placeholders
 * so app boot is stable in development.
 */
export const supabase = createClient(
  env.supabaseUrl || fallbackUrl,
  env.supabaseAnonKey || fallbackAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

export {isSupabaseConfigured};
