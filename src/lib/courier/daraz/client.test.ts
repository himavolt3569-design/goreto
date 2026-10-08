// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { signRequest } from "./sign";

vi.mock("server-only", () => ({}));
const { darazCall, describeDarazError } = await import("./client");

const CONFIG = { appKey: "123456", appSecret: "secret", apiUrl: "https://api.daraz.com.np/rest" };
const NOW = 1_791_000_000_000;

function respond(body: unknown, status = 200) {
  return vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status }));
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("darazCall", () => {
  it("signs system + business parameters, sends objects as JSON strings, and parses string booleans", async () => {
    const fetchImpl = respond({ code: "0", success: "true", retryable: "false", traceId: "t-1", data: { packageCode: "FU1" } });
    const result = await darazCall(CONFIG, "/logistics/epis/packages", { dangerousGood: false, items: [{ name: "Kurta" }], skip: undefined }, z.object({ packageCode: z.string() }), {
      fetchImpl,
      now: () => NOW,
    });
    expect(result).toEqual({ ok: true, data: { packageCode: "FU1" }, traceId: "t-1", durationMs: 0 });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.origin + url.pathname).toBe("https://api.daraz.com.np/rest/logistics/epis/packages");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ app_key: "123456", timestamp: String(NOW), sign_method: "sha256" });
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({ dangerousGood: "false", items: '[{"name":"Kurta"}]' });
    const expected = signRequest(
      "/logistics/epis/packages",
      { app_key: "123456", timestamp: String(NOW), sign_method: "sha256", dangerousGood: "false", items: '[{"name":"Kurta"}]' },
      "secret",
    );
    expect(url.searchParams.get("sign")).toBe(expected);
    expect(init.method).toBe("POST");
  });

  it("puts business parameters in the query for GET", async () => {
    const fetchImpl = respond({ code: "0", success: true, data: { url: "https://label" } });
    await darazCall(CONFIG, "/logistics/epis/packages/awb", { packageCode: "FU1", type: "pdf" }, z.object({ url: z.string() }), { method: "GET", fetchImpl, now: () => NOW });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.searchParams.get("packageCode")).toBe("FU1");
    expect(init.body).toBeUndefined();
  });

  it("reports signature problems from the gateway clearly", async () => {
    const result = await darazCall(CONFIG, "/x", {}, z.unknown(), {
      fetchImpl: respond({ type: "ISV", code: "IncompleteSignature", message: "The request signature does not conform", request_id: "r-9" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ code: "SIGNATURE", traceId: "r-9", retryable: false });
    expect(result.error.message).toMatch(/DARAZ_APP_KEY/);
  });

  it("keeps Daraz's field errors for staff", async () => {
    const result = await darazCall(CONFIG, "/x", {}, z.unknown(), {
      fetchImpl: respond({
        code: "0",
        success: "false",
        retryable: "false",
        traceId: "t-2",
        errorCode: "BAD_REQUEST",
        errorMessage: "Bad request",
        errors: [{ field: "$.destination.phone", errorMessage: "phone is invalid" }],
      }),
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({ code: "BAD_REQUEST", traceId: "t-2", fieldErrors: [{ field: "$.destination.phone", message: "phone is invalid" }] });
    expect(describeDarazError(result.error)).toBe("Bad request · destination.phone: phone is invalid");
  });

  it("separates unreachable, unreadable and unexpected replies", async () => {
    const network = await darazCall(CONFIG, "/x", {}, z.unknown(), { fetchImpl: vi.fn(async () => Promise.reject(new Error("ECONNRESET"))) });
    expect(network.ok || network.error.code).toBe("NETWORK");
    const html = await darazCall(CONFIG, "/x", {}, z.unknown(), { fetchImpl: respond("<html>bad gateway</html>", 502) });
    expect(html.ok || html.error).toMatchObject({ code: "HTTP_502", retryable: true });
    const shape = await darazCall(CONFIG, "/x", {}, z.object({ url: z.string() }), { fetchImpl: respond({ code: "0", success: true, data: null }) });
    expect(shape.ok || shape.error.code).toBe("UNEXPECTED_DATA");
  });

  it("never logs the payload", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await darazCall(CONFIG, "/x", { destination: { phone: "9812345678" } }, z.unknown(), {
      fetchImpl: respond({ code: "0", success: false, errorCode: "BAD_REQUEST", errorMessage: "Bad" }),
    });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/9812345678/);
  });
});
