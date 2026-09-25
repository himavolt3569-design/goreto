/**
 * Runs Supabase CLI database commands against the project in .env.local
 * without putting the connection string on a command line you can see.
 *
 *   npm run db:push            apply supabase/migrations to SUPABASE_DB_URL
 *   npm run db:types           regenerate src/types/database.ts from the hosted
 *                              project (Management API: needs SUPABASE_ACCESS_TOKEN
 *                              or a prior `npx supabase login`; no Docker)
 *   npm run db:types -- --db-url   generate from SUPABASE_DB_URL instead (needs Docker)
 *   add --local to either      use `supabase start` instead (needs Docker)
 */
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const cli = resolve(dirname(createRequire(import.meta.url).resolve("supabase/package.json")), "dist/supabase.js");

const [command] = process.argv.slice(2);
const local = process.argv.includes("--local");

function target(): string[] {
  if (local) return ["--local"];
  const url = process.env.SUPABASE_DB_URL;
  if (!url) throw new Error("SUPABASE_DB_URL is not set. Add it to .env.local, or pass --local.");
  return ["--db-url", url];
}

/** `https://<ref>.supabase.co` -> `<ref>`. */
function projectRef(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local.");
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(new URL(url).host);
  if (!match) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a hosted project URL; pass --db-url or --local.");
  return match[1];
}

function typesTarget(): string[] {
  if (local || process.argv.includes("--db-url")) return target();
  return ["--project-id", projectRef()];
}

function run(args: string[], capture: boolean): string {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["inherit", "pipe", "inherit"] : "inherit",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`supabase ${args[0]} ${args[1] ?? ""} failed (exit ${result.status ?? "signal"})`);
  }
  return result.stdout ?? "";
}

function main(): void {
  switch (command) {
    case "push":
      run(
        ["db", "push", ...target(), ...(process.argv.includes("--dry-run") ? ["--dry-run"] : ["--yes"])],
        false,
      );
      break;
    case "types": {
      const types = run(["gen", "types", "typescript", ...typesTarget(), "--schema", "public"], true);
      if (!types.includes("export type Database")) throw new Error("Type generation returned no Database type");
      writeFileSync(resolve(root, "src/types/database.ts"), types.replace(/\r\n/g, "\n"));
      console.log("Wrote src/types/database.ts");
      break;
    }
    default:
      throw new Error(`Unknown command "${command ?? ""}". Use "push" or "types".`);
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
