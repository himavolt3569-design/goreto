import { describe, expect, it } from "vitest";
import { arAssetFormSchema, formatSuitsMode, parseArAssetPath, readCalibration, toCalibration } from "./ar-forms";

const PRODUCT = "11111111-1111-4111-8111-111111111111";
const FILE = "22222222-2222-4222-8222-222222222222";

const valid = {
  productId: PRODUCT,
  variantId: "",
  mode: "live_2d",
  placement: "ear",
  assetPath: `products/${PRODUCT}/${FILE}.png`,
  anchor: "ear_lobe",
  scale: "1",
  offsetX: "0",
  offsetY: "-0.02",
  rotationDeg: "0",
  isActive: "on",
};

describe("arAssetFormSchema", () => {
  it("parses a complete form", () => {
    const parsed = arAssetFormSchema.parse(valid);
    expect(parsed.variantId).toBeNull();
    expect(parsed.isActive).toBe(true);
    expect(toCalibration(parsed)).toEqual({ anchor: "ear_lobe", scale: 1, offset_x: 0, offset_y: -0.02, rotation_deg: 0 });
  });

  it("refuses an anchor from another placement", () => {
    const result = arAssetFormSchema.safeParse({ ...valid, anchor: "nose_bridge" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["anchor"]);
  });

  it.each([
    ["scale", "0"],
    ["scale", "9"],
    ["offsetX", "1.5"],
    ["rotationDeg", "270"],
    ["scale", "abc"],
  ])("refuses %s = %s", (field, value) => {
    expect(arAssetFormSchema.safeParse({ ...valid, [field]: value }).success).toBe(false);
  });

  it("requires a file and a product", () => {
    expect(arAssetFormSchema.safeParse({ ...valid, assetPath: "" }).success).toBe(false);
    expect(arAssetFormSchema.safeParse({ ...valid, productId: "" }).success).toBe(false);
  });
});

describe("formatSuitsMode", () => {
  it("pairs images with 2D and photo modes and models with 3D", () => {
    expect(formatSuitsMode("live_2d", "png")).toBe(true);
    expect(formatSuitsMode("photo_ai", "webp")).toBe(true);
    expect(formatSuitsMode("live_3d", "glb")).toBe(true);
    expect(formatSuitsMode("live_3d", "png")).toBe(false);
    expect(formatSuitsMode("live_2d", "usdz")).toBe(false);
  });
});

describe("parseArAssetPath", () => {
  it("accepts only server-issued keys", () => {
    expect(parseArAssetPath(`products/${PRODUCT}/${FILE}.glb`)).toEqual({ productId: PRODUCT, format: "glb" });
    expect(parseArAssetPath("ar/pearl-drop/overlay.png")).toBeNull();
    expect(parseArAssetPath(`products/${PRODUCT}/${FILE}.gltf`)).toBeNull();
    expect(parseArAssetPath(`products/new-${PRODUCT}/${FILE}.png`)).toBeNull();
  });
});

describe("readCalibration", () => {
  it("fills what a stored object lacks with the placement defaults", () => {
    expect(readCalibration("neck", { scale: 1.05 })).toEqual({ anchor: "collarbone_center", scale: 1.05, offset_x: 0, offset_y: 0, rotation_deg: 0 });
    expect(readCalibration("face", null).anchor).toBe("nose_bridge");
  });
});
