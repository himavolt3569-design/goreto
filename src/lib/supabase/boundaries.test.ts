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
const BROWSER_CLIENT = join("lib", "supabase", "browser.ts");
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

  it("keeps the Supabase clients server-only, except the one browser client", () => {
    const clients = appFiles.filter((file) => /[\\/]lib[\\/]supabase[\\/]/.test(file) && relative(SRC, file) !== BROWSER_CLIENT);
    for (const path of clients) {
      expect(readFileSync(path, "utf8"), relative(SRC, path)).toMatch(/^import "server-only";/);
    }
  });

  it("builds the browser client from the anon key and the Clerk session token only", () => {
    const source = readFileSync(join(SRC, BROWSER_CLIENT), "utf8");
    expect(source).toMatch(/^"use client";/);
    expect(source).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    expect(source).toContain("accessToken: async () => (await session.getToken())");
    expect(source).not.toMatch(/SERVICE|SECRET|server-only/);
  });
});
