import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * External integrations (e.g. Supabase Database Webhook) call this with header
 * `x-rebuild-secret` matching env REBUILD_HOOK_SECRET.
 */
export const POST: APIRoute = async ({ request }) => {
  const secret = import.meta.env.REBUILD_HOOK_SECRET;
  const hook = import.meta.env.REBUILD_HOOK_URL;
  if (!secret || !hook) {
    return new Response('Not configured', { status: 501 });
  }
  if (request.headers.get('x-rebuild-secret') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }
  const res = await fetch(hook, { method: 'POST' });
  if (!res.ok) {
    return new Response(`Hook failed: ${res.status}`, { status: 502 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
