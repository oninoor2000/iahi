/**
 * 1) Applies supabase/migrations SQL via direct Postgres.
 * 2) Registers admin via Auth REST (anon key), confirms email in auth.users (Dev/seed),
 *    then promotes role with superuser SQL.
 *
 * Required in .env:
 *   SUPABASE_DB_URL — Dashboard → Database → Connection string → URI (Direct, port 5432)
 *   PUBLIC_SUPABASE_URL
 *   PUBLIC_SUPABASE_ANON_KEY
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const ADMIN_EMAIL = 'oni@mail.com';
const ADMIN_PASSWORD = '11442233';
const ADMIN_NAME = 'Oni Admin';

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
const supabaseUrl = (process.env.PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

async function applyMigration() {
  if (!dbUrl) {
    throw new Error(
      'Set SUPABASE_DB_URL (or DATABASE_URL) to the direct Postgres URI from Supabase Dashboard (port 5432).',
    );
  }
  const p = postgres(dbUrl, {
    ssl: 'require',
    max: 1,
    connect_timeout: 30,
  });
  try {
    const migrationPath = path.join(root, 'supabase', 'migrations', '20260328000000_initial_schema.sql');
    const migrationSql = await fs.readFile(migrationPath, 'utf8');
    await p.unsafe(migrationSql);
    console.log('Migration applied:', migrationPath);
  } finally {
    await p.end({ timeout: 5 });
  }
}

async function signUpAuth() {
  if (!supabaseUrl || !anonKey) {
    throw new Error('Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY');
  }
  const res = await fetch(`${supabaseUrl}/auth/v1/signup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      data: { full_name: ADMIN_NAME },
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    console.log('Auth signup OK:', ADMIN_EMAIL);
    return;
  }
  const msg = body.msg ?? body.error_description ?? body.error ?? JSON.stringify(body);
  if (res.status === 422 || /already registered|already exists|User already/i.test(String(msg))) {
    console.log('Auth signup skipped (user may already exist):', msg);
    return;
  }
  throw new Error(`Auth signup failed (${res.status}): ${msg}`);
}

/** Supabase anon signUp does not set email_confirmed_at when "Confirm email" is enabled. */
async function confirmAuthEmail() {
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL required to confirm email');
  }
  const p = postgres(dbUrl, { ssl: 'require', max: 1, connect_timeout: 30 });
  try {
    const rows = await p`
      UPDATE auth.users
      SET email_confirmed_at = NOW()
      WHERE email = ${ADMIN_EMAIL}
      RETURNING id
    `;
    if (rows.length === 0) {
      throw new Error(`No auth.users row for ${ADMIN_EMAIL}. Run signup first.`);
    }
    console.log('Email confirmed (seed):', ADMIN_EMAIL);
  } finally {
    await p.end({ timeout: 5 });
  }
}

async function promoteAdmin() {
  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL required to promote admin role');
  }
  const p = postgres(dbUrl, { ssl: 'require', max: 1, connect_timeout: 30 });
  try {
    const rows = await p`
      UPDATE public.user_roles
      SET role = 'admin'
      WHERE user_id = (SELECT id FROM auth.users WHERE email = ${ADMIN_EMAIL} LIMIT 1)
      RETURNING user_id
    `;
    if (rows.length === 0) {
      throw new Error(
        `No user_roles row updated for ${ADMIN_EMAIL}. Ensure the user exists (signup or create in dashboard).`,
      );
    }
    console.log('Promoted to admin:', ADMIN_EMAIL, rows[0].user_id);
  } finally {
    await p.end({ timeout: 5 });
  }
}

const migrationOnly = process.argv.includes('--no-seed');
const seedOnly = process.argv.includes('--seed-only');

try {
  if (!seedOnly) {
    await applyMigration();
  }
  if (!migrationOnly) {
    await signUpAuth();
    await confirmAuthEmail();
    await promoteAdmin();
  }
  console.log('Done.');
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
