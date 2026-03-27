import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

/** Anonymous client for SSG at build time (published content only via RLS). */
export function createBuildTimeSupabaseClient() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY for static generation');
  }
  return createClient<Database>(url, anon);
}
