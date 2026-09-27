import { describe, expect, it } from "vitest";
import { arFormatForContentType, detectArFormat } from "./asset-signature";

const bytes = (...parts: (number[] | string)[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((char) => char.charCodeAt(0)) : part)));

/** A ZIP local file header with the given first entry name. */
function zipWith(name: string): Uint8Array {
  const header = new Array(30).fill(0);
  header.splice(0, 4, 0x50, 0x4b, 0x03, 0x04);
  header[26] = name.length & 0xff;
  header[27] = name.length >> 8;
  return bytes(header, name);
}

describe("detectArFormat", () => {
  it("recognises GLB version 2 only", () => {
    expect(detectArFormat(bytes("glTF", [2, 0, 0, 0], [0, 0, 0, 0]))).toBe("glb");
    expect(detectArFormat(bytes("glTF", [1, 0, 0, 0]))).toBeNull();
  });

  it("recognises USDZ by its first entry", () => {
    expect(detectArFormat(zipWith("model.usdc"))).toBe("usdz");
    expect(detectArFormat(zipWith("scene.usda"))).toBe("usdz");
    expect(detectArFormat(zipWith("word/document.xml"))).toBeNull();
  });

  it("accepts PNG and WebP overlays but not JPEG", () => {
    expect(detectArFormat(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(detectArFormat(bytes("RIFF", [0, 0, 0, 0], "WEBP"))).toBe("webp");
    expect(detectArFormat(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
  });

  it("rejects text renamed to a model", () => {
    expect(detectArFormat(bytes("hello world, not a model"))).toBeNull();
    expect(detectArFormat(new Uint8Array())).toBeNull();
  });
});

describe("arFormatForContentType", () => {
  it("maps the bucket's allowed types", () => {
    expect(arFormatForContentType("model/gltf-binary")).toBe("glb");
    expect(arFormatForContentType("MODEL/VND.USDZ+ZIP")).toBe("usdz");
    expect(arFormatForContentType("image/jpeg")).toBeNull();
  });
});
