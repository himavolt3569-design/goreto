"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/profile";
import { getUserSupabase } from "@/lib/supabase/server";
import { addressFailureFromError, addressFormSchema, type AddressFailure, type AddressFormValues } from "./address-schema";

/*
 * Saved-address Server Actions (AGENTS §4.9, §11.6). Public POST endpoints:
 * input is parsed here, and the account_* functions (security invoker, own
 * rows only) do the writes, so the default swap happens in one transaction.
 */

const ADDRESSES_PATH = "/account/addresses";
const SIGNED_OUT: AddressFailure = { ok: false, message: "Your session has ended. Sign in again to manage addresses." };
const idSchema = z.uuid();

export type AddressActionResult = { ok: true } | AddressFailure;

function logUnexpected(what: string, error: { code?: string; message: string }): void {
  if (!["54000", "P0002", "23514", "22023"].includes(error.code ?? "")) console.error(`${what} failed`, error.code, error.message);
}

/** Adds (id null) or updates an address, then returns to the list. */
export async function saveAddressAction(id: string | null, values: AddressFormValues): Promise<AddressActionResult> {
  if (id !== null && !idSchema.safeParse(id).success) return addressFailureFromError({ code: "P0002", message: "" });
  const parsed = addressFormSchema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: AddressFailure["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof AddressFormValues;
      fieldErrors[field] ??= issue.message;
    }
    return { ok: false, message: "Check the highlighted fields.", fieldErrors };
  }
  if (!(await getCurrentProfile())) return SIGNED_OUT;

  const address = parsed.data;
  const { error } = await getUserSupabase().rpc("account_save_address", {
    // Null means "insert"; the generated types can't express a nullable argument.
    p_id: id as string,
    p_label: address.label,
    p_recipient_name: address.recipientName,
    p_phone_e164: address.phone,
    p_province_code: address.provinceCode,
    p_district_code: address.districtCode,
    p_municipality_code: address.municipalityCode,
    p_ward: address.ward,
    p_street_landmark: address.streetLandmark,
    p_postal_code: address.postalCode,
    p_make_default: address.makeDefault,
    p_latitude: address.latitude ?? undefined,
    p_longitude: address.longitude ?? undefined,
  });
  if (error) {
    logUnexpected("account_save_address", error);
    return addressFailureFromError(error);
  }
  revalidatePath(ADDRESSES_PATH);
  redirect(ADDRESSES_PATH);
}

export async function setDefaultAddressAction(id: string): Promise<AddressActionResult> {
  if (!idSchema.safeParse(id).success) return addressFailureFromError({ code: "P0002", message: "" });
  if (!(await getCurrentProfile())) return SIGNED_OUT;
  const { error } = await getUserSupabase().rpc("account_set_default_address", { p_id: id });
  if (error) {
    logUnexpected("account_set_default_address", error);
    return addressFailureFromError(error);
  }
  revalidatePath(ADDRESSES_PATH);
  return { ok: true };
}

export async function deleteAddressAction(id: string): Promise<AddressActionResult> {
  if (!idSchema.safeParse(id).success) return addressFailureFromError({ code: "P0002", message: "" });
  if (!(await getCurrentProfile())) return SIGNED_OUT;
  const { error } = await getUserSupabase().rpc("account_delete_address", { p_id: id });
  if (error) {
    logUnexpected("account_delete_address", error);
    return error.code === "P0002" ? { ok: true } : addressFailureFromError(error);
  }
  revalidatePath(ADDRESSES_PATH);
  return { ok: true };
}
