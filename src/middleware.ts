import { defineMiddleware } from 'astro:middleware';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { Database } from '@/lib/database.types';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    context.locals.user = null;
    context.locals.supabase = null;
    context.locals.isAdmin = false;
    return next();
  }

  const supabase = createServerClient<Database>(url, anon, {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    isAdmin = data?.role === 'admin';
  }

  context.locals.supabase = supabase;
  context.locals.user = user;
  context.locals.isAdmin = isAdmin;

  return next();
});
