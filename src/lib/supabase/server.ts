import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { APIContext } from 'astro';
import type { Database } from '@/lib/database.types';

export function createServerSupabaseClient(context: Pick<APIContext, 'request' | 'cookies'>) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error('Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY');
  }
  return createServerClient<Database>(url, anon, {
    cookies: {
      getAll() {
        return parseCookieHeader(context.request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          if (value) {
            context.cookies.set(name, value, options);
          } else {
            context.cookies.delete(name, options);
          }
        });
      },
    },
  });
}
