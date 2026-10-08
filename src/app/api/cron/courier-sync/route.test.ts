// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const processPendingInbox = vi.fn();
const syncDueShipments = vi.fn();
const syncOpenSupportCases = vi.fn();
const autoBookPending = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/courier/provider-sync", () => ({ autoBookPending, processPendingInbox, syncDueShipments, syncOpenSupportCases }));

const { GET } = await import("./route");

const SECRET = "a-long-cron-secret-value";
const request = (authorization?: string) =>
  new Request("https://goreto.test/api/cron/courier-sync", { headers: authorization ? { authorization } : {} }) as NextRequest;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("CRON_SECRET", SECRET);
  processPendingInbox.mockResolvedValue(2);
  syncDueShipments.mockResolvedValue([{ shipmentId: "a", ok: true }, { shipmentId: "b", ok: false, error: "NETWORK" }]);
  syncOpenSupportCases.mockResolvedValue(1);
  autoBookPending.mockResolvedValue({ booked: 1, failed: 0 });
});

describe("GET /api/cron/courier-sync", () => {
  it("needs a configured secret and the right bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(request(`Bearer ${SECRET}`))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", SECRET);
    expect((await GET(request())).status).toBe(401);
    expect((await GET(request("Bearer wrong"))).status).toBe(401);
    expect(syncDueShipments).not.toHaveBeenCalled();
  });

  it("syncs the inbox, shipments and support cases, and books automatically", async () => {
    const response = await GET(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ inboxProcessed: 2, shipmentsSynced: 1, shipmentsFailed: 1, supportCasesUpdated: 1, autoBooked: 1, autoBookFailed: 0 });
    expect(syncDueShipments).toHaveBeenCalledWith({ limit: 25, staleMinutes: 10 });
  });

  it("reports failures as 500 without details", async () => {
    syncDueShipments.mockRejectedValue(new Error("db"));
    const response = await GET(request(`Bearer ${SECRET}`));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Sync failed");
  });
});
