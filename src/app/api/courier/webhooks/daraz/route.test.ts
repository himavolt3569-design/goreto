// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";
import { webhookSignature } from "@/lib/courier/daraz/sign";

const recordWebhook = vi.fn();
const processInboxMessage = vi.fn();
const scheduled: (() => Promise<void>)[] = [];

vi.mock("server-only", () => ({}));
vi.mock("@/lib/courier/provider-sync", () => ({ recordWebhook, processInboxMessage }));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (task: () => Promise<void>) => scheduled.push(task),
}));

const { POST } = await import("./route");

const BODY = JSON.stringify({ seller_id: "1", message_type: 14, data: { trackingNumber: "NPDEX1001", status: "DELIVERED" } });

function request(body: string, signature: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature !== null) headers.set("authorization", signature);
  return new Request("https://goreto.test/api/courier/webhooks/daraz", { method: "POST", body, headers }) as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  scheduled.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("DARAZ_APP_KEY", "123456");
  vi.stubEnv("DARAZ_APP_SECRET", "secret");
  vi.stubEnv("DARAZ_API_URL", "");
  recordWebhook.mockResolvedValue("inbox-1");
  processInboxMessage.mockResolvedValue(undefined);
});

describe("POST /api/courier/webhooks/daraz", () => {
  it("is off until Daraz is configured", async () => {
    vi.stubEnv("DARAZ_APP_SECRET", "");
    expect((await POST(request(BODY, "x"))).status).toBe(503);
  });

  it("rejects missing or wrong signatures before touching anything", async () => {
    expect((await POST(request(BODY, null))).status).toBe(401);
    expect((await POST(request(BODY, webhookSignature("123456", BODY, "other")))).status).toBe(401);
    expect((await POST(request(BODY + " ", webhookSignature("123456", BODY, "secret")))).status).toBe(401);
    expect(scheduled).toHaveLength(0);
    expect(recordWebhook).not.toHaveBeenCalled();
  });

  it("acknowledges a signed message at once and stores and syncs it afterwards", async () => {
    const response = await POST(request(BODY, webhookSignature("123456", BODY, "secret")));
    expect(response.status).toBe(200);
    expect(recordWebhook).not.toHaveBeenCalled();
    expect(scheduled).toHaveLength(1);

    await scheduled[0]!();
    expect(recordWebhook).toHaveBeenCalledWith(BODY, JSON.parse(BODY));
    expect(processInboxMessage).toHaveBeenCalledWith("inbox-1");
  });

  it("acknowledges repeats without processing them twice", async () => {
    recordWebhook.mockResolvedValue(null);
    expect((await POST(request(BODY, webhookSignature("123456", BODY, "secret")))).status).toBe(200);
    await scheduled[0]!();
    expect(processInboxMessage).not.toHaveBeenCalled();
  });

  it("refuses invalid JSON and oversized bodies", async () => {
    expect((await POST(request("not json", webhookSignature("123456", "not json", "secret")))).status).toBe(400);
    const huge = JSON.stringify({ pad: "x".repeat(300 * 1024) });
    expect((await POST(request(huge, webhookSignature("123456", huge, "secret")))).status).toBe(413);
  });

  it("swallows processing errors after acknowledging", async () => {
    recordWebhook.mockRejectedValue(new Error("database down"));
    expect((await POST(request(BODY, webhookSignature("123456", BODY, "secret")))).status).toBe(200);
    await expect(scheduled[0]!()).resolves.toBeUndefined();
  });
});
