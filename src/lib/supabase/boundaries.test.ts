// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Guards the server/client and test/app boundaries (AGENTS §26.6): in src/
 * the service-role key lives in one server-only module with one importer
 * (the Clerk -> profiles sync), and fixtures never ship in the app.
 */

const SERVICE_ROLE_MODULE = join("lib", "supabase", "admin.ts");
const ADMIN_CLIENT_IMPORTERS = [join("lib", "auth", "profile-sync.ts")];

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

const isTestCode = (path: string) =>
  /\.test\.tsx?$/.test(path) || /[\\/]__tests__[\\/]/.test(path) || /[\\/]src[\\/]test[\\/]/.test(path);

const appFiles = sourceFiles(SRC).filter((path) => !isTestCode(path));

describe("source boundaries", () => {
  it("references the service-role key only from lib/supabase/admin.ts", () => {
    const offenders = appFiles.filter((path) => readFileSync(path, "utf8").includes("SERVICE_ROLE"));
    expect(offenders.map((path) => relative(SRC, path))).toEqual([SERVICE_ROLE_MODULE]);
  });

  it("imports the admin client only from the profile sync", () => {
    const importers = appFiles.filter((path) =>
      /from ["'](@\/lib\/supabase\/admin|\.\/admin|\.\.\/supabase\/admin)["']/.test(readFileSync(path, "utf8")),
    );
    expect(importers.map((path) => relative(SRC, path))).toEqual(ADMIN_CLIENT_IMPORTERS);
  });

  it("never exposes the service-role key as a public env var", () => {
    const offenders = appFiles.filter((path) => /NEXT_PUBLIC_[A-Z_]*SERVICE/.test(readFileSync(path, "utf8")));
    expect(offenders.map((path) => relative(SRC, path))).toEqual([]);
  });

  it("never imports test fixtures from app code", () => {
    const offenders = appFiles.filter((path) => /from ["']@\/test\//.test(readFileSync(path, "utf8")));
    expect(offenders.map((path) => relative(SRC, path))).toEqual([]);
  });

  it("keeps the Supabase clients server-only", () => {
    for (const path of appFiles.filter((file) => /[\\/]lib[\\/]supabase[\\/]/.test(file))) {
      expect(readFileSync(path, "utf8"), relative(SRC, path)).toMatch(/^import "server-only";/);
    }
  });
});
