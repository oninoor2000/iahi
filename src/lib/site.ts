/**
 * Canonical host when env / Astro.site are unset (current Vercel production).
 * Override with PUBLIC_SITE_URL for a custom domain (e.g. https://iahi.or.id).
 */
export const PUBLIC_SITE_FALLBACK = 'https://iahi.vercel.app' as const;

/**
 * Origin for auth email links (Supabase `emailRedirectTo`) and QR on member card.
 * Prefer PUBLIC_SITE_URL in production; falls back to browser origin in dev; finally PUBLIC_SITE_FALLBACK.
 */
export function getPublicSiteOrigin(): string {
  const fromEnv = import.meta.env.PUBLIC_SITE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return PUBLIC_SITE_FALLBACK;
}
