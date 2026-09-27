import { z } from "zod";
import type { Database } from "@/types/database";
import type { ArFormat } from "./asset-signature";
import { checkbox } from "./catalog-forms";

/*
 * AR asset editor (prompts/goreto-admin-media-ar.md): the FormData schema
 * shared by the browser form and the Server Action, which file formats each
 * try-on mode takes, and the calibration fields (AGENTS §11.3: documented
 * transform/anchor metadata only). The database checks mode and format again.
 */

export type ArMode = Database["public"]["Enums"]["ar_mode"];
export type ArPlacement = Database["public"]["Enums"]["ar_placement"];

export const AR_MODES: readonly ArMode[] = ["live_2d", "live_3d", "photo_ai"];
export const AR_PLACEMENTS: readonly ArPlacement[] = ["ear", "face", "neck", "wrist", "hand", "upper_body", "full_body", "freeform"];

export const AR_MODE_LABELS: Record<ArMode, string> = {
  live_2d: "Live 2D overlay",
  live_3d: "Live 3D model",
  photo_ai: "Photo try-on (AI)",
};

export const AR_MODE_HINTS: Record<ArMode, string> = {
  live_2d: "A transparent PNG or WebP drawn over the camera, pinned to the anchor.",
  live_3d: "A GLB model (USDZ for iPhone Quick Look), pinned to the anchor.",
  photo_ai: "A flat garment image the photo try-on provider dresses the shopper in.",
};

/** The formats an upload may have for each mode (uploads never use multi-file glTF). */
export const AR_MODE_FORMATS: Record<ArMode, readonly ArFormat[]> = {
  live_2d: ["png", "webp"],
  live_3d: ["glb", "usdz"],
  photo_ai: ["png", "webp"],
};

/** Stored formats that suit a mode, including glTF on older rows (matches the database check). */
export function formatSuitsMode(mode: ArMode, format: string): boolean {
  return mode === "live_3d" ? ["glb", "gltf", "usdz"].includes(format) : ["png", "webp"].includes(format);
}

/**
 * Where the overlay or model is pinned. The names follow the seed data; the
 * storefront try-on maps them to camera landmarks.
 */
export const AR_ANCHORS: Record<ArPlacement, readonly string[]> = {
  ear: ["ear_lobe", "ear_helix"],
  face: ["nose_bridge", "eyes_center", "forehead"],
  neck: ["collarbone_center", "neck_base"],
  wrist: ["wrist_center"],
  hand: ["ring_finger_base", "index_finger_base", "palm_center"],
  upper_body: ["shoulders_center", "chest_center"],
  full_body: ["hips_center", "body_center"],
  freeform: ["center"],
};

export type ArCalibration = { anchor: string; scale: number; offset_x: number; offset_y: number; rotation_deg: number };

export const CALIBRATION_LIMITS = {
  scale: { min: 0.1, max: 5 },
  offset: { min: -1, max: 1 },
  rotation: { min: -180, max: 180 },
} as const;

export function defaultCalibration(placement: ArPlacement): ArCalibration {
  return { anchor: AR_ANCHORS[placement][0]!, scale: 1, offset_x: 0, offset_y: 0, rotation_deg: 0 };
}

/** A stored calibration object, or the placement's defaults for anything it lacks. */
export function readCalibration(placement: ArPlacement, stored: unknown): ArCalibration {
  const fallback = defaultCalibration(placement);
  const value = (stored && typeof stored === "object" ? stored : {}) as Record<string, unknown>;
  const number = (key: keyof ArCalibration, current: number) => (typeof value[key] === "number" ? (value[key] as number) : current);
  return {
    anchor: typeof value.anchor === "string" ? value.anchor : fallback.anchor,
    scale: number("scale", fallback.scale),
    offset_x: number("offset_x", fallback.offset_x),
    offset_y: number("offset_y", fallback.offset_y),
    rotation_deg: number("rotation_deg", fallback.rotation_deg),
  };
}

function bounded(label: string, min: number, max: number) {
  return z.coerce
    .number({ error: `Enter a ${label}` })
    .refine(Number.isFinite, `Enter a ${label}`)
    .refine((value) => value >= min && value <= max, `Use ${min} to ${max}`);
}

const id = z.uuid("Invalid choice");

export const arAssetFormSchema = z
  .object({
    productId: z.uuid("Choose a product"),
    variantId: z
      .string()
      .optional()
      .default("")
      .transform((value) => (value === "" ? null : value))
      .pipe(id.nullable()),
    mode: z.enum(AR_MODES as [ArMode, ...ArMode[]], { error: "Choose a try-on mode" }),
    placement: z.enum(AR_PLACEMENTS as [ArPlacement, ...ArPlacement[]], { error: "Choose where it's worn" }),
    assetPath: z.string().trim().min(1, "Upload a file"),
    anchor: z.string().trim(),
    scale: bounded("scale", CALIBRATION_LIMITS.scale.min, CALIBRATION_LIMITS.scale.max),
    offsetX: bounded("horizontal offset", CALIBRATION_LIMITS.offset.min, CALIBRATION_LIMITS.offset.max),
    offsetY: bounded("vertical offset", CALIBRATION_LIMITS.offset.min, CALIBRATION_LIMITS.offset.max),
    rotationDeg: bounded("rotation", CALIBRATION_LIMITS.rotation.min, CALIBRATION_LIMITS.rotation.max),
    isActive: checkbox,
  })
  .superRefine((values, context) => {
    if (!AR_ANCHORS[values.placement].includes(values.anchor)) {
      context.addIssue({ code: "custom", path: ["anchor"], message: "Choose an anchor for this placement" });
    }
  });

export type ArAssetInput = z.infer<typeof arAssetFormSchema>;

/** The calibration JSON saved with the asset: exactly the documented keys. */
export function toCalibration(values: ArAssetInput): ArCalibration {
  return { anchor: values.anchor, scale: values.scale, offset_x: values.offsetX, offset_y: values.offsetY, rotation_deg: values.rotationDeg };
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UPLOADED_PATH = new RegExp(`^products/(${UUID})/${UUID}\\.(png|webp|glb|usdz)$`);

/** An AR file uploaded through the admin (`products/<productId>/<uuid>.<ext>`), or null for seed or other keys. */
export function parseArAssetPath(path: string): { productId: string; format: ArFormat } | null {
  const match = UPLOADED_PATH.exec(path);
  return match ? { productId: match[1]!, format: match[2] as ArFormat } : null;
}
