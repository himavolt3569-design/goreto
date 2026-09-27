import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { z } from "zod";

/*
 * Nepal phone numbers (AGENTS §15.3): typed with or without +977, stored as
 * E.164. libphonenumber does the validation, never an ad-hoc regex.
 */

/** E.164 for a valid Nepal number, otherwise null. */
export function toNepalE164(value: string): string | null {
  const phone = parsePhoneNumberFromString(value.trim(), "NP");
  return phone?.isValid() && phone.country === "NP" ? phone.number : null;
}

/** "+9779841234567" → "+977 984-1234567"; other values unchanged. */
export function formatNepalPhone(e164: string): string {
  const phone = parsePhoneNumberFromString(e164, "NP");
  return phone?.isValid() ? phone.formatInternational() : e164;
}

/** Optional field: "" becomes null. */
export const nepalPhoneSchema = z
  .string()
  .trim()
  .transform((value, context) => {
    if (value === "") return null;
    const e164 = toNepalE164(value);
    if (!e164) {
      context.addIssue({ code: "custom", message: "Enter a valid Nepal phone number" });
      return z.NEVER;
    }
    return e164;
  });

/** Required field. */
export const requiredNepalPhoneSchema = z
  .string()
  .trim()
  .min(1, "Enter your phone number")
  .transform((value, context) => {
    const e164 = toNepalE164(value);
    if (!e164) {
      context.addIssue({ code: "custom", message: "Enter a valid Nepal mobile or landline number" });
      return z.NEVER;
    }
    return e164;
  });
