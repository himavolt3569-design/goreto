import "server-only";
import { z } from "zod";
import type { DarazConfig } from "./config";
import { signRequest } from "./sign";

/*
 * One signed call to the Daraz Open Platform gateway. System parameters go
 * in the query string and business parameters in the form body, as the
 * official SDKs do; nested objects are sent as JSON strings. Logs carry the
 * path, error code and trace id only, never the payload (it holds customer
 * addresses and phones).
 */

export type DarazFieldError = { field: string; message: string };

export type DarazError = {
  /** "SIGNATURE" for key/secret problems, "NETWORK" when Daraz couldn't be reached. */
  code: string;
  message: string;
  fieldErrors: DarazFieldError[];
  retryable: boolean;
  traceId: string | null;
};

export type DarazResult<T> =
  | { ok: true; data: T; traceId: string | null; durationMs: number }
  | { ok: false; error: DarazError; durationMs: number };

const SIGNATURE_CODES = new Set(["IncompleteSignature", "InvalidSignature", "MissingParameter", "InvalidAppKey", "AppKeyNotExist", "InvalidApiPath"]);

/** "true"/"false" strings, as Daraz's examples show, or real booleans. */
const looseBoolean = z.union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")]);

const envelopeSchema = z.object({
  code: z.union([z.string(), z.number()]).optional(),
  type: z.string().optional(),
  message: z.string().optional(),
  success: looseBoolean.optional(),
  retryable: looseBoolean.optional(),
  errorCode: z.string().nullish(),
  errorMessage: z.string().nullish(),
  errors: z.array(z.object({ field: z.string().optional().default(""), errorMessage: z.string().optional().default("") })).nullish(),
  traceId: z.union([z.string(), z.boolean()]).nullish(),
  request_id: z.string().optional(),
  data: z.unknown().optional(),
});

type CallOptions = {
  method?: "GET" | "POST";
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
};

function encode(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export async function darazCall<T>(
  config: DarazConfig,
  apiPath: string,
  params: Readonly<Record<string, unknown>>,
  dataSchema: z.ZodType<T>,
  { method = "POST", fetchImpl = fetch, now = Date.now, timeoutMs = 15_000 }: CallOptions = {},
): Promise<DarazResult<T>> {
  const started = now();
  const business: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    const encoded = encode(value);
    if (encoded !== "") business[key] = encoded;
  }
  const system: Record<string, string> = { app_key: config.appKey, timestamp: String(started), sign_method: "sha256" };
  const sign = signRequest(apiPath, { ...system, ...business }, config.appSecret);

  const url = new URL(config.apiUrl + apiPath);
  for (const [key, value] of Object.entries({ ...system, sign })) url.searchParams.set(key, value);
  if (method === "GET") for (const [key, value] of Object.entries(business)) url.searchParams.set(key, value);

  const elapsed = () => Math.max(0, now() - started);
  const failure = (error: Omit<DarazError, "fieldErrors"> & { fieldErrors?: DarazFieldError[] }): DarazResult<T> => {
    console.warn(`[daraz] ${apiPath} failed: ${error.code}${error.traceId ? ` (trace ${error.traceId})` : ""}`);
    return { ok: false, error: { fieldErrors: [], ...error }, durationMs: elapsed() };
  };

  let body: unknown;
  try {
    const response = await fetchImpl(url, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" } : undefined,
      body: method === "POST" ? new URLSearchParams(business).toString() : undefined,
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
    body = await response.json().catch(() => null);
    if (body === null) {
      return failure({ code: `HTTP_${response.status}`, message: "Daraz sent an unreadable response.", retryable: response.status >= 500, traceId: null });
    }
  } catch {
    return failure({ code: "NETWORK", message: "Couldn't reach Daraz. Check the connection and try again.", retryable: true, traceId: null });
  }

  const envelope = envelopeSchema.safeParse(body);
  if (!envelope.success) {
    return failure({ code: "UNEXPECTED_RESPONSE", message: "Daraz sent a response we don't recognise.", retryable: false, traceId: null });
  }
  const result = envelope.data;
  const traceId = typeof result.traceId === "string" ? result.traceId : (result.request_id ?? null);

  // Gateway errors (signature, permissions, throttling) come as {type, code, message}.
  const gatewayCode = result.code === undefined ? "0" : String(result.code);
  if (gatewayCode !== "0") {
    const signature = SIGNATURE_CODES.has(gatewayCode);
    return failure({
      code: signature ? "SIGNATURE" : gatewayCode,
      message: signature
        ? "Daraz rejected the app key or secret. Check DARAZ_APP_KEY and DARAZ_APP_SECRET."
        : (result.message ?? "Daraz refused the request."),
      retryable: result.type === "ISP" || gatewayCode === "ApiCallLimit",
      traceId,
    });
  }

  if (result.success === false) {
    return failure({
      code: result.errorCode || "DARAZ_ERROR",
      message: result.errorMessage || "Daraz refused the request.",
      fieldErrors: (result.errors ?? []).map((error) => ({ field: error.field, message: error.errorMessage })),
      retryable: result.retryable ?? false,
      traceId,
    });
  }

  const data = dataSchema.safeParse(result.data);
  if (!data.success) {
    // Authenticated and accepted, but not the data we expected.
    return failure({ code: "UNEXPECTED_DATA", message: "Daraz's reply was missing expected details.", retryable: false, traceId });
  }
  return { ok: true, data: data.data, traceId, durationMs: elapsed() };
}

/** One line for staff: Daraz's message plus its field errors. */
export function describeDarazError(error: DarazError): string {
  const fields = error.fieldErrors
    .filter((item) => item.message)
    .map((item) => (item.field ? `${item.field.replace(/^\$\./, "")}: ${item.message}` : item.message));
  return [error.message, ...fields].join(" · ");
}
