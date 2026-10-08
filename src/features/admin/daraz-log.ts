import "server-only";
import { describeDarazError, type DarazResult } from "@/lib/courier/daraz/client";
import { adminDb } from "./queries/shared";
import { PROVIDER } from "./queries/daraz";

/**
 * One row in courier_api_log for a staff-initiated Daraz call: action,
 * outcome, Daraz's trace id and duration. Never the payload (it holds
 * customer addresses and phones).
 */
export async function logDarazCall(action: string, orderId: string | null, result: DarazResult<unknown>): Promise<void> {
  const { error } = await adminDb().rpc("admin_log_courier_call", {
    p_provider: PROVIDER,
    p_action: action,
    p_order_id: orderId as string,
    p_success: result.ok,
    p_error_code: (result.ok ? null : result.error.code) as string,
    p_error_message: (result.ok ? null : describeDarazError(result.error)) as string,
    p_trace_id: (result.ok ? result.traceId : result.error.traceId) as string,
    p_duration_ms: Math.round(result.durationMs),
  });
  if (error) console.warn(`[daraz] couldn't write the API log (${error.code ?? ""})`);
}
