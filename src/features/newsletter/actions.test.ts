import { describe, expect, it } from "vitest";
import { subscribeToNewsletter } from "./actions";
import { initialNewsletterState, NEWSLETTER_UNAVAILABLE_MESSAGE } from "./schema";

function form(email?: string) {
  const data = new FormData();
  if (email !== undefined) data.set("email", email);
  return data;
}

describe("subscribeToNewsletter", () => {
  it("rejects a missing email", async () => {
    const state = await subscribeToNewsletter(initialNewsletterState, form());
    expect(state.status).toBe("error");
  });

  it("rejects an invalid email and echoes it back for correction", async () => {
    const state = await subscribeToNewsletter(initialNewsletterState, form("abc"));
    expect(state).toMatchObject({ status: "error", email: "abc" });
  });

  it("accepts a valid email without claiming it was stored", async () => {
    const state = await subscribeToNewsletter(
      initialNewsletterState,
      form("  you@example.com "),
    );
    expect(state).toEqual({ status: "success", message: NEWSLETTER_UNAVAILABLE_MESSAGE });
  });
});
