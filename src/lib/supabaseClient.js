import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const rawSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const sanitizeSupabaseUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  }
};

const supabaseUrl = sanitizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey = rawSupabaseAnonKey ? rawSupabaseAnonKey.trim() : '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials missing! Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

export const isValidUUID = (str) => {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});

export default supabase;
