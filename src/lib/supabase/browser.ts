import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

export function createBrowserSupabaseClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
  }
  return createBrowserClient<Database>(url, anon);
}
