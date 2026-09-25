// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Guards the server/client and test/app boundaries (AGENTS §26.6): the
 * service-role key is for scripts only, and fixtures never ship in the app.
 */

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
  it("never references the service-role key from src/", () => {
    const offenders = appFiles.filter((path) => readFileSync(path, "utf8").includes("SERVICE_ROLE"));
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
