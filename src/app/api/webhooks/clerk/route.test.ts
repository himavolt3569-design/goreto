// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const verifyWebhook = vi.fn();
const syncClerkProfile = vi.fn();
const markClerkProfileDeleted = vi.fn();

vi.mock("@clerk/nextjs/webhooks", () => ({ verifyWebhook }));
vi.mock("@/lib/auth/profile-sync", () => ({ syncClerkProfile, markClerkProfileDeleted }));

const { POST } = await import("./route");

const request = () => new Request("https://goreto.test/api/webhooks/clerk", { method: "POST" }) as NextRequest;

const userData = {
  id: "user_123",
  first_name: "Asha",
  last_name: null,
  primary_email_address_id: "idn_1",
  email_addresses: [{ id: "idn_1", email_address: "asha@example.com", verification: { status: "verified" } }],
  primary_phone_number_id: null,
  phone_numbers: [],
  updated_at: 1_790_000_000_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  syncClerkProfile.mockResolvedValue("profile-id");
  markClerkProfileDeleted.mockResolvedValue(undefined);
});

describe("POST /api/webhooks/clerk", () => {
  it("rejects an unverifiable request without touching the database", async () => {
    verifyWebhook.mockRejectedValue(new Error("bad signature"));
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(syncClerkProfile).not.toHaveBeenCalled();
    expect(markClerkProfileDeleted).not.toHaveBeenCalled();
  });

  it.each(["user.created", "user.updated"])("syncs the profile on %s", async (type) => {
    verifyWebhook.mockResolvedValue({ type, data: userData });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(syncClerkProfile).toHaveBeenCalledWith({
      clerkUserId: "user_123",
      email: "asha@example.com",
      fullName: "Asha",
      phoneE164: null,
      clerkUpdatedAt: new Date(1_790_000_000_000),
    });
  });

  it("rejects a user payload with an unexpected shape", async () => {
    verifyWebhook.mockResolvedValue({ type: "user.updated", data: { id: "user_123" } });
    const response = await POST(request());
    expect(response.status).toBe(400);
    expect(syncClerkProfile).not.toHaveBeenCalled();
  });

  it("anonymizes the profile on user.deleted", async () => {
    verifyWebhook.mockResolvedValue({ type: "user.deleted", data: { id: "user_123", deleted: true, object: "user" } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(markClerkProfileDeleted).toHaveBeenCalledWith("user_123");
  });

  it("rejects user.deleted without an id", async () => {
    verifyWebhook.mockResolvedValue({ type: "user.deleted", data: { deleted: true, object: "user" } });
    expect((await POST(request())).status).toBe(400);
    expect(markClerkProfileDeleted).not.toHaveBeenCalled();
  });

  it("asks Clerk to retry when the database write fails", async () => {
    verifyWebhook.mockResolvedValue({ type: "user.created", data: userData });
    syncClerkProfile.mockRejectedValue(new Error("connection reset"));
    expect((await POST(request())).status).toBe(500);
  });

  it("acknowledges events it doesn't handle", async () => {
    verifyWebhook.mockResolvedValue({ type: "session.created", data: { id: "sess_1" } });
    expect((await POST(request())).status).toBe(200);
    expect(syncClerkProfile).not.toHaveBeenCalled();
  });
});
