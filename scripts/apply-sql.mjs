/**
 * Menjalankan satu file SQL ke Postgres Supabase (direct connection, port 5432).
 *
 * Usage:
 *   node scripts/apply-sql.mjs supabase/migrations/20260329120000_membership_expires_at.sql
 *
 * .env: SUPABASE_DB_URL (atau DATABASE_URL)
 */
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const rel = process.argv[2];
if (!rel) {
  console.error('Usage: node scripts/apply-sql.mjs <path-relative-to-project.sql>');
  process.exit(1);
}

const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('Set SUPABASE_DB_URL (or DATABASE_URL) in .env');
  process.exit(1);
}

const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
const sql = await fs.readFile(abs, 'utf8');
const p = postgres(dbUrl, { ssl: 'require', max: 1, connect_timeout: 30 });
try {
  await p.unsafe(sql);
  console.log('OK:', abs);
} finally {
  await p.end({ timeout: 5 });
}
