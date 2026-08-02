import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://hgxbiabmiepbjwzqoifd.supabase.co';
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'sb_publishable_uFfLeYzfLaaTr_QsZLDPGQ_c23uVs-V';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function checkSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error && error.code !== 'PGRST116') {
      return { connected: true, details: 'Connected to Supabase project instance' };
    }
    return { connected: true, details: 'Supabase project reachable' };
  } catch (err: any) {
    return { connected: false, details: err.message || 'Connection failed' };
  }
}
