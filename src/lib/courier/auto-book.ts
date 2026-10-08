import "server-only";
import { after } from "next/server";
import { autoBookPending } from "./provider-sync";

/**
 * After an order is placed or accepted: book any accepted Daraz orders when
 * the store turned auto-book on (docs/couriers/daraz.md §10). Runs after the
 * response so customers and staff never wait on Daraz; does nothing when
 * Daraz isn't configured or auto-book is off. The scheduled sync retries
 * anything this misses.
 */
export function scheduleAutoBooking(): void {
  if (!process.env.DARAZ_APP_KEY || !process.env.DARAZ_APP_SECRET) return;
  after(async () => {
    try {
      await autoBookPending();
    } catch (error) {
      console.error("[daraz auto-book] failed:", error instanceof Error ? error.message : "unknown error");
    }
  });
}
