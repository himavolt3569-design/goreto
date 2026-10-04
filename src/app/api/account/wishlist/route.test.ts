// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getCurrentProfile: vi.fn(), fetchWishlistSlugs: vi.fn() }));
vi.mock("@/lib/auth/profile", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/features/wishlist/queries", () => ({ fetchWishlistSlugs: mocks.fetchWishlistSlugs }));

const { GET } = await import("./route");

beforeEach(() => {
  mocks.getCurrentProfile.mockReset();
  mocks.fetchWishlistSlugs.mockReset();
});

describe("GET /api/account/wishlist", () => {
  it("is 401 when signed out and never cached", async () => {
    mocks.getCurrentProfile.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(mocks.fetchWishlistSlugs).not.toHaveBeenCalled();
  });

  it("returns the signed-in profile's slugs", async () => {
    mocks.getCurrentProfile.mockResolvedValue({ id: "profile-1" });
    mocks.fetchWishlistSlugs.mockResolvedValue(["tote-bag"]);
    const response = await GET();
    expect(mocks.fetchWishlistSlugs).toHaveBeenCalledWith("profile-1");
    expect(await response.json()).toEqual({ slugs: ["tote-bag"] });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("is 503 when the read fails", async () => {
    mocks.getCurrentProfile.mockResolvedValue({ id: "profile-1" });
    mocks.fetchWishlistSlugs.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET()).status).toBe(503);
  });
});
