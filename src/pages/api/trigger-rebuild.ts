import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async ({ locals }) => {
  if (!locals.user || !locals.isAdmin) {
    return new Response('Forbidden', { status: 403 });
  }
  const hook = import.meta.env.REBUILD_HOOK_URL;
  if (!hook) {
    return new Response(JSON.stringify({ ok: true, skipped: 'no_hook' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
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
