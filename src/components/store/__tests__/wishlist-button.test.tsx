import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL_WISHLIST, useWishlistStore } from "@/features/wishlist/store";
import { WishlistButton } from "../wishlist-button";

const clerk = vi.hoisted(() => ({ auth: { isLoaded: true, isSignedIn: true, userId: "user_a" as string | null } }));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => clerk.auth,
  SignInButton: ({ children }: { children: ReactNode }) => <div data-testid="sign-in-modal-trigger">{children}</div>,
}));

const actions = vi.hoisted(() => ({
  saveToWishlistAction: vi.fn(),
  removeFromWishlistAction: vi.fn(),
}));
vi.mock("@/features/wishlist/actions", () => actions);

function mockSavedSlugs(slugs: string[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ slugs }), { status: 200, headers: { "Content-Type": "application/json" } })),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  useWishlistStore.setState(INITIAL_WISHLIST, true);
  clerk.auth = { isLoaded: true, isSignedIn: true, userId: "user_a" };
  actions.saveToWishlistAction.mockResolvedValue({ ok: true });
  actions.removeFromWishlistAction.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WishlistButton", () => {
  it("shows the saved state loaded for the signed-in user", async () => {
    mockSavedSlugs(["tote-bag"]);
    render(<WishlistButton slug="tote-bag" productTitle="Tote Bag" />);
    const heart = screen.getByRole("button", { name: "Save Tote Bag to wishlist" });
    await waitFor(() => expect(heart).toHaveAttribute("aria-pressed", "true"));
    expect(fetch).toHaveBeenCalledWith("/api/account/wishlist", { cache: "no-store" });
  });

  it("saves and removes, announcing each change", async () => {
    mockSavedSlugs([]);
    render(<WishlistButton slug="tote-bag" productTitle="Tote Bag" />);
    const heart = screen.getByRole("button", { name: "Save Tote Bag to wishlist" });
    await waitFor(() => expect(useWishlistStore.getState().status).toBe("ready"));

    await act(async () => fireEvent.click(heart));
    expect(actions.saveToWishlistAction).toHaveBeenCalledWith("tote-bag");
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Tote Bag saved to your wishlist.");

    await act(async () => fireEvent.click(heart));
    expect(actions.removeFromWishlistAction).toHaveBeenCalledWith("tote-bag");
    expect(heart).toHaveAttribute("aria-pressed", "false");
  });

  it("rolls back and explains when the save is refused", async () => {
    mockSavedSlugs([]);
    actions.saveToWishlistAction.mockResolvedValueOnce({ ok: false, message: "Your wishlist is full." });
    render(<WishlistButton slug="tote-bag" productTitle="Tote Bag" />);
    await waitFor(() => expect(useWishlistStore.getState().status).toBe("ready"));

    const heart = screen.getByRole("button", { name: "Save Tote Bag to wishlist" });
    await act(async () => fireEvent.click(heart));
    expect(heart).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("alert")).toHaveTextContent("Your wishlist is full.");
  });

  it("signed out, opens sign-in and remembers the product to save", () => {
    clerk.auth = { isLoaded: true, isSignedIn: false, userId: null };
    render(<WishlistButton slug="tote-bag" productTitle="Tote Bag" />);
    const heart = screen.getByRole("button", { name: "Save Tote Bag to wishlist" });
    expect(screen.getByTestId("sign-in-modal-trigger")).toContainElement(heart);
    expect(heart).not.toHaveAttribute("aria-pressed");

    fireEvent.click(heart);
    expect(useWishlistStore.getState().pendingSlug).toBe("tote-bag");
    expect(actions.saveToWishlistAction).not.toHaveBeenCalled();
  });
});
