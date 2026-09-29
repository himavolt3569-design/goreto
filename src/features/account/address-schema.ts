import { z } from "zod";
import { requiredNepalPhoneSchema } from "@/lib/validation/phone";

/*
 * Saved Nepal address form (AGENTS §4.9, §11.6, §15). The client form and the
 * Server Action parse the same schema; account_save_address and the address
 * validate trigger check the hierarchy and ward again in SQL.
 */

export const MAX_ADDRESSES = 10;
export const ADDRESS_LABELS = ["Home", "Work", "Other"] as const;

export const addressFormSchema = z.object({
  label: z.string().trim().min(1, "Enter a label, like Home or Work").max(40, "Use at most 40 characters"),
  recipientName: z.string().trim().min(2, "Enter the recipient's full name").max(100, "Use at most 100 characters"),
  phone: requiredNepalPhoneSchema,
  provinceCode: z.string().min(1, "Choose a province"),
  districtCode: z.string().min(1, "Choose a district"),
  municipalityCode: z.string().min(1, "Choose a municipality or city"),
  ward: z
    .string()
    .regex(/^[0-9]{1,2}$/, "Choose a ward")
    .transform(Number),
  streetLandmark: z.string().trim().min(2, "Enter a street or landmark").max(200, "Use at most 200 characters"),
  postalCode: z.string().trim().regex(/^([0-9]{5})?$/, "Postal codes have 5 digits"),
  /** Set by "Pick on map"; both or neither. */
  latitude: z.number().min(26).max(31).nullable(),
  longitude: z.number().min(80).max(89).nullable(),
  makeDefault: z.boolean(),
}).refine((value) => (value.latitude === null) === (value.longitude === null), { path: ["latitude"], message: "Pick the spot on the map again" });

export type AddressFormValues = z.input<typeof addressFormSchema>;
export type AddressFormData = z.output<typeof addressFormSchema>;

export const EMPTY_ADDRESS: AddressFormValues = {
  label: "Home",
  recipientName: "",
  phone: "",
  provinceCode: "",
  districtCode: "",
  municipalityCode: "",
  ward: "",
  streetLandmark: "",
  postalCode: "",
  latitude: null,
  longitude: null,
  makeDefault: false,
};

export type AddressFailure = { ok: false; message: string; fieldErrors?: Partial<Record<keyof AddressFormValues, string>> };

/** Friendly messages for the account address functions' error codes. */
export function addressFailureFromError(error: { code?: string; message: string }): AddressFailure {
  switch (error.code) {
    case "54000":
      return { ok: false, message: `You can save up to ${MAX_ADDRESSES} addresses. Delete one to add another.` };
    case "P0002":
      return { ok: false, message: "That address no longer exists. Refresh the page and try again." };
    case "23514":
      return {
        ok: false,
        message: "Check the area and ward: they don't match our Nepal address list.",
        fieldErrors: { ward: "Choose a ward in this municipality" },
      };
    case "22023":
      return { ok: false, message: "Check the label and try again.", fieldErrors: { label: "Use 1 to 40 characters" } };
    default:
      return { ok: false, message: "We couldn't save your address. Please try again." };
  }
}
