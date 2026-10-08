import "server-only";

/*
 * Daraz Open Platform credentials (server-only; AGENTS §17, §26.6). The
 * integration is off until both the app key and secret are set; nothing
 * calls Daraz without them. In development DARAZ_API_URL may point at the
 * local mock (scripts/daraz/mock-server.ts) over plain http.
 */

export const DARAZ_NEPAL_API_URL = "https://api.daraz.com.np/rest";

export type DarazConfig = { appKey: string; appSecret: string; apiUrl: string };

export function darazConfig(env: NodeJS.ProcessEnv = process.env): DarazConfig | null {
  const appKey = env.DARAZ_APP_KEY?.trim();
  const appSecret = env.DARAZ_APP_SECRET?.trim();
  if (!appKey || !appSecret) return null;
  const apiUrl = (env.DARAZ_API_URL?.trim() || DARAZ_NEPAL_API_URL).replace(/\/+$/, "");
  const localMock = env.NODE_ENV === "development" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(apiUrl);
  if (!/^https:\/\//.test(apiUrl) && !localMock) {
    throw new Error("DARAZ_API_URL must start with https:// (http://localhost is allowed only in development)");
  }
  return { appKey, appSecret, apiUrl };
}

/** Whether the app talks to Daraz's live gateway, for labels in the admin. */
export function isLiveDaraz(config: DarazConfig): boolean {
  return config.apiUrl === DARAZ_NEPAL_API_URL;
}
