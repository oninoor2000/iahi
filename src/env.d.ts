/// <reference path="../.astro/types.d.ts" />
import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/database.types';

declare namespace App {
  interface Locals {
    supabase: SupabaseClient<Database> | null;
    user: User | null;
    isAdmin: boolean;
  }
}

type ImportMetaEnv = Readonly<{
  PUBLIC_SUPABASE_URL: string;
  PUBLIC_SUPABASE_ANON_KEY: string;
  /** Canonical site URL (no trailing slash); email confirmation & OAuth redirects */
  PUBLIC_SITE_URL?: string;
  /** Server-only: Vercel/Netlify deploy hook URL (used by /api/trigger-rebuild) */
  REBUILD_HOOK_URL?: string;
  /** Server-only: verify Supabase webhooks or /api/rebuild-hook */
  REBUILD_HOOK_SECRET?: string;
}>;

type ImportMeta = Readonly<{
  env: ImportMetaEnv;
}>;
