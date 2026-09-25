import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

/*
 * In-process Postgres 17 (PGlite) running the real migrations and the full
 * development seed, so RLS can be tested per role without Docker or a hosted
 * project. The shims below stand in for the pieces Supabase provides: the
 * anon/authenticated/service_role roles with Cloud's permissive default
 * privileges, auth.jwt() reading the request claims PostgREST sets, and the
 * storage schema.
 */

const ROOT = resolve(import.meta.dirname, "../..");

const SUPABASE_SHIMS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema extensions;
  create schema auth;
  create schema storage;
  grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;
  -- Supabase Cloud's permissive defaults: migrations must narrow them explicitly.
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  grant execute on function auth.jwt() to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text
  );
  alter table storage.objects enable row level security;
  grant select, insert, update, delete on storage.objects to authenticated;
`;

type SeedMeta = { table_order: string[]; counts: Record<string, number> };

export async function createSeededDatabase(): Promise<{ db: PGlite; meta: SeedMeta }> {
  const db = await PGlite.create({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_SHIMS);

  const migrations = join(ROOT, "supabase/migrations");
  for (const file of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(migrations, file), "utf8"));
  }

  const lines = readFileSync(join(ROOT, "supabase/seed.ndjson"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as { table: string; data: Record<string, unknown> });
  const meta = lines.shift()!.data as unknown as SeedMeta;
  const byTable = new Map<string, Record<string, unknown>[]>();
  for (const line of lines) byTable.set(line.table, [...(byTable.get(line.table) ?? []), line.data]);

  for (const table of meta.table_order) {
    const rows = byTable.get(table) ?? [];
    const columns = Object.keys(rows[0]!).map((column) => `"${column}"`).join(", ");
    for (let start = 0; start < rows.length; start += 500) {
      await db.query(
        `insert into public.${table} (${columns})
         select ${columns} from jsonb_populate_recordset(null::public.${table}, $1::jsonb)`,
        [JSON.stringify(rows.slice(start, start + 500))],
      );
    }
  }
  return { db, meta };
}

export type Session =
  | { role: "anon" }
  | { role: "service_role" }
  | { role: "authenticated"; clerkUserId: string };

/**
 * Runs `sql` as the given role with Clerk-shaped claims, like a PostgREST
 * request, inside a transaction that is always rolled back. Returns the first
 * column of the first row, `affected:<n>` for writes without RETURNING, or
 * `error:<message>`.
 */
export async function runAs(db: PGlite, session: Session, sql: string): Promise<unknown> {
  const claims =
    session.role === "authenticated"
      ? JSON.stringify({ sub: session.clerkUserId, role: "authenticated" })
      : "";
  let outcome: unknown;
  await db
    .transaction(async (tx: Transaction) => {
      await tx.query("select set_config('request.jwt.claims', $1, true)", [claims]);
      await tx.exec(`set local role ${session.role}`);
      try {
        const result = await tx.query(sql);
        outcome = result.rows.length
          ? Object.values(result.rows[0] as Record<string, unknown>)[0]
          : `affected:${result.affectedRows ?? 0}`;
      } catch (error) {
        outcome = `error:${(error as Error).message}`;
      }
      await tx.rollback();
    })
    .catch(() => undefined);
  return outcome;
}
