import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetSaved,
  INITIAL_WISHLIST,
  rememberPendingSave,
  setSaved,
  syncWishlistUser,
  useWishlistStore,
  type WishlistApi,
} from "./store";

function fakeApi(saved: string[] = []): WishlistApi & { [K in keyof WishlistApi]: ReturnType<typeof vi.fn> } {
  return {
    load: vi.fn(async () => saved),
    save: vi.fn(async () => ({ ok: true as const })),
    remove: vi.fn(async () => ({ ok: true as const })),
  };
}

const slugs = () => [...useWishlistStore.getState().slugs].sort();

beforeEach(() => {
  useWishlistStore.setState(INITIAL_WISHLIST, true);
});

describe("syncWishlistUser", () => {
  it("loads a user's saved slugs once", async () => {
    const api = fakeApi(["aviator-sunglasses", "white-lace-sundress"]);
    await syncWishlistUser("user_a", api);
    await syncWishlistUser("user_a", api);
    expect(api.load).toHaveBeenCalledTimes(1);
    expect(useWishlistStore.getState().status).toBe("ready");
    expect(slugs()).toEqual(["aviator-sunglasses", "white-lace-sundress"]);
  });

  it("clears the slugs on sign-out and reloads for the next user", async () => {
    await syncWishlistUser("user_a", fakeApi(["aviator-sunglasses"]));
    await syncWishlistUser(null, fakeApi());
    expect(slugs()).toEqual([]);
    await syncWishlistUser("user_b", fakeApi(["tote-bag"]));
    expect(slugs()).toEqual(["tote-bag"]);
  });

  it("finishes a save started while signed out", async () => {
    rememberPendingSave("tote-bag");
    const api = fakeApi(["aviator-sunglasses"]);
    await syncWishlistUser("user_a", api);
    expect(api.save).toHaveBeenCalledWith("tote-bag");
    expect(slugs()).toEqual(["aviator-sunglasses", "tote-bag"]);
    expect(useWishlistStore.getState().pendingSlug).toBeNull();
  });

  it("records a failed load and retries on the next sync", async () => {
    const api = fakeApi();
    api.load.mockRejectedValueOnce(new Error("offline"));
    await syncWishlistUser("user_a", api);
    expect(useWishlistStore.getState().status).toBe("error");
    await syncWishlistUser("user_a", api);
    expect(useWishlistStore.getState().status).toBe("ready");
  });
});

describe("setSaved", () => {
  it("updates optimistically and keeps the change on success", async () => {
    const api = fakeApi();
    expect(await setSaved("tote-bag", true, api)).toEqual({ ok: true });
    expect(slugs()).toEqual(["tote-bag"]);
    await setSaved("tote-bag", false, api);
    expect(slugs()).toEqual([]);
  });

  it("rolls back when the server refuses or the request fails", async () => {
    const api = fakeApi();
    api.save.mockResolvedValueOnce({ ok: false, message: "Your wishlist is full." });
    expect(await setSaved("tote-bag", true, api)).toEqual({ ok: false, message: "Your wishlist is full." });
    expect(slugs()).toEqual([]);

    api.save.mockRejectedValueOnce(new Error("offline"));
    const result = await setSaved("tote-bag", true, api);
    expect(result.ok).toBe(false);
    expect(slugs()).toEqual([]);
  });

  it("does nothing when the state already matches", async () => {
    const api = fakeApi();
    await setSaved("tote-bag", false, api);
    expect(api.remove).not.toHaveBeenCalled();
  });
});

it("forgetSaved drops a slug removed on the wishlist page", async () => {
  await syncWishlistUser("user_a", fakeApi(["tote-bag"]));
  forgetSaved("tote-bag");
  expect(slugs()).toEqual([]);
});
