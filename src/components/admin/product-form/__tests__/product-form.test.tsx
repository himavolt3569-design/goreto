import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/features/admin/auth";
import { emptyProductValues, type ProductFormValues } from "@/features/admin/product-form/schema";
import { ProductDangerZone } from "../delete-product";
import { ProductForm } from "../product-form";

// Server Actions are server-only; the form needs references it can call.
const saveProductAction = vi.fn<(id: string | null, input: unknown, staged?: unknown) => Promise<ActionResult>>();
vi.mock("@/features/admin/actions/products", () => ({
  saveProductAction: (id: string | null, input: unknown, staged?: unknown) => saveProductAction(id, input, staged),
  discardStagedMediaAction: vi.fn(async () => ({ ok: true })),
  deleteProductAction: vi.fn(),
}));
vi.mock("@/features/admin/actions/catalog", () => ({ setProductStatusAction: vi.fn() }));

// Uploads go to Storage from the browser; here each file "uploads" to a staged path.
const STAGING_ID = "3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
let uploadCount = 0;
vi.mock("../upload-photo", () => ({
  ACCEPTED_IMAGE_TYPES: "image/jpeg,image/png,image/webp,image/avif",
  uploadPhotoFile: async (_target: unknown, file: File) =>
    file.name.endsWith(".txt")
      ? { ok: false, message: "Not a JPEG, PNG, WebP or AVIF image." }
      : { ok: true, path: `products/new-${STAGING_ID}/00000000-0000-4000-8000-00000000000${uploadCount++}.jpg` },
}));
Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: () => undefined });

const CATEGORY_ID = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";
const VARIANT_ID = "5b1f0c2a-3d4e-4f5a-8b6c-7d8e9f0a1b2c";

function editValues(): ProductFormValues {
  return {
    ...emptyProductValues(5, true),
    title: "Canvas Tote",
    slug: "canvas-tote",
    categoryId: CATEGORY_ID,
    basePrice: "2499",
    options: [{ name: "Colour", values: [{ value: "tan", label: "Tan", swatchHex: "#C19A6B", locked: true }] }],
    variants: [
      { id: VARIANT_ID, sku: "GRT-CTO-TAN", title: "", optionValues: { Colour: "tan" }, price: "", weightGrams: "", isActive: true, initialStock: "0" },
    ],
  };
}

function renderForm(values: ProductFormValues, productId: string | null = "0c6a1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e", stagingId?: string) {
  return render(
    <ProductForm
      productId={productId}
      defaultValues={values}
      categories={[{ id: CATEGORY_ID, title: "Bags", parentId: null }]}
      collections={[]}
      linkedCollections={[]}
      variantInfo={{ [VARIANT_ID]: { stock: 7, ordered: true } }}
      saved={productId ? { slug: values.slug, status: "draft", version: "2026-09-25T00:00:00Z", updatedLabel: "Sep 25, 2026" } : null}
      stagingId={stagingId}
    />,
  );
}

beforeEach(() => saveProductAction.mockReset());

describe("ProductForm", () => {
  it("keeps unsaved edits when the page refreshes without a product save", () => {
    const props = {
      productId: "0c6a1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e",
      categories: [{ id: CATEGORY_ID, title: "Bags", parentId: null }],
      collections: [],
      linkedCollections: [],
      variantInfo: { [VARIANT_ID]: { stock: 7, ordered: true } },
    };
    const saved = (version: string) => ({ slug: "canvas-tote", status: "draft" as const, version, updatedLabel: "Sep 25, 2026" });
    const { rerender } = render(<ProductForm {...props} defaultValues={editValues()} saved={saved("v1")} />);
    fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: "Edited Tote" } });

    // A photo action refreshes the page: new values object, same saved version.
    rerender(<ProductForm {...props} defaultValues={editValues()} saved={saved("v1")} />);
    expect(screen.getByLabelText(/Product name/)).toHaveValue("Edited Tote");

    // A save bumps the version and loads the stored values.
    rerender(<ProductForm {...props} defaultValues={{ ...editValues(), title: "Stored Tote" }} saved={saved("v2")} />);
    expect(screen.getByLabelText(/Product name/)).toHaveValue("Stored Tote");
  });

  it("only says photos come after creating when photos can't be staged", () => {
    const { unmount } = renderForm(emptyProductValues(5, false), null);
    expect(screen.getByText(/add photos after creating/)).toBeInTheDocument();
    unmount();
    renderForm(emptyProductValues(5, false), null, STAGING_ID);
    expect(screen.queryByText(/add photos after creating/)).not.toBeInTheDocument();
  });

  it("fills the slug from the title for a new product", () => {
    renderForm(emptyProductValues(5, false), null);
    fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: "Pearl Drop Earrings" } });
    expect(screen.getByLabelText(/URL slug/)).toHaveValue("pearl-drop-earrings");
  });

  it("caps the auto slug at 8 words and shows the counts", () => {
    renderForm(emptyProductValues(5, false), null);
    fireEvent.change(screen.getByLabelText(/Product name/), { target: { value: "Hand Woven Dhaka Topi With Silver Pin For Festival Wear" } });
    expect(screen.getByLabelText(/URL slug/)).toHaveValue("hand-woven-dhaka-topi-with-silver-pin-for");
    expect(screen.getByText(/8\/8 words/)).toBeInTheDocument();
    expect(screen.getByText(/Auto from name/)).toBeInTheDocument();
  });

  it("switches to a custom slug when typed, and back with Generate from name", () => {
    renderForm(emptyProductValues(5, false), null);
    const name = screen.getByLabelText(/Product name/);
    const slug = screen.getByLabelText(/URL slug/);
    fireEvent.change(name, { target: { value: "Silk Scarf" } });
    fireEvent.change(slug, { target: { value: "Dhaka Topi Festival" } });
    expect(slug).toHaveValue("dhaka-topi-festival");
    expect(screen.getByText(/Custom/)).toBeInTheDocument();

    fireEvent.change(name, { target: { value: "Silk Scarf Blue" } });
    expect(slug).toHaveValue("dhaka-topi-festival");

    fireEvent.click(screen.getByRole("button", { name: "Generate from name" }));
    expect(slug).toHaveValue("silk-scarf-blue");
    expect(screen.getByText(/Auto from name/)).toBeInTheDocument();
  });

  it("stages photos on Add product and sends them, in order, with create", async () => {
    saveProductAction.mockResolvedValue({ ok: false, message: "stop" });
    const { container } = renderForm(
      { ...emptyProductValues(5, false), title: "Silk Scarf", slug: "silk-scarf", categoryId: CATEGORY_ID, basePrice: "999", variants: [{ ...emptyProductValues(5, false).variants[0]!, sku: "GRT-SSC-STD" }] },
      null,
      STAGING_ID,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const files = [new File(["a"], "front.jpg", { type: "image/jpeg" }), new File(["b"], "notes.txt", { type: "image/jpeg" }), new File(["c"], "back.jpg", { type: "image/jpeg" })];
    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });

    const list = await screen.findByRole("list", { name: "Photos to add" });
    await waitFor(() => expect(within(list).getAllByRole("listitem")).toHaveLength(2));
    expect(screen.getByText(/notes.txt/).closest("p")).toHaveTextContent("Not a JPEG");
    expect(within(list).getByText("Cover")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Move photo 2 earlier" }));
    fireEvent.change(screen.getByLabelText("Alt text for photo 1"), { target: { value: "Back of the scarf" } });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    });
    await waitFor(() => expect(saveProductAction).toHaveBeenCalledOnce());
    const staged = saveProductAction.mock.calls[0]![2] as { stagingId: string; photos: { path: string; altText: string }[] };
    expect(staged.stagingId).toBe(STAGING_ID);
    expect(staged.photos.map((photo) => photo.altText)).toEqual(["Back of the scarf", ""]);
    expect(staged.photos[0]!.path).toMatch(/1\.jpg$/);
  });

  it("shows existing stock read-only and never as an input", () => {
    renderForm(editValues());
    const table = screen.getByRole("region", { name: "Variants" });
    expect(within(table).getByText("7")).toBeInTheDocument();
    expect(within(table).queryByLabelText(/Starting stock/)).not.toBeInTheDocument();
    expect(within(table).getByText("Has orders")).toBeInTheDocument();
  });

  it("keeps existing variants and adds new combinations when variants are updated", async () => {
    renderForm(editValues());
    fireEvent.click(screen.getByRole("button", { name: "Add value" }));
    const newValue = screen.getByLabelText("Value 2");
    fireEvent.change(newValue, { target: { value: "Black" } });
    expect(await screen.findByText(/The options changed/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Update variants" }));
    const table = screen.getByRole("region", { name: "Variants" });
    await waitFor(() => expect(within(table).getByLabelText("SKU for Black")).toBeInTheDocument());
    expect(within(table).getByLabelText("SKU for Tan")).toHaveValue("GRT-CTO-TAN");
    expect(within(table).getByLabelText("SKU for Black")).toHaveValue("GRT-CTO-BLACK");
    expect(within(table).getByLabelText("Starting stock for Black")).toHaveValue("0");
    expect(screen.queryByText(/The options changed/)).not.toBeInTheDocument();
  });

  it("lists a removed saved variant, noting it has orders", async () => {
    const values = editValues();
    values.options[0]!.values.push({ value: "black", label: "Black", swatchHex: "", locked: true });
    values.variants.push({ ...values.variants[0]!, id: null, sku: "GRT-CTO-BLK", optionValues: { Colour: "black" } });
    renderForm(values);
    fireEvent.click(screen.getByRole("button", { name: "Remove variant Tan" }));
    expect(await screen.findByText(/Removed when you save/)).toBeInTheDocument();
    expect(screen.getByText(/GRT-CTO-TAN \(has orders/)).toBeInTheDocument();
  });

  it("shows server errors on the matching field", async () => {
    saveProductAction.mockResolvedValue({
      ok: false,
      message: "SKU GRT-CTO-TAN is already used by another variant",
      fieldErrors: { "variants.0.sku": "SKU GRT-CTO-TAN is already used by another variant" },
    });
    renderForm(editValues());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    await waitFor(() => expect(saveProductAction).toHaveBeenCalledOnce());
    const sku = screen.getByLabelText("SKU for Tan");
    await waitFor(() => expect(sku).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getAllByText(/already used by another variant/).length).toBeGreaterThan(0);
  });

  it("blocks submit with client errors and doesn't call the server", async () => {
    renderForm({ ...editValues(), basePrice: "12.345" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    });
    expect(await screen.findByText(/Enter an amount in rupees/)).toBeInTheDocument();
    expect(saveProductAction).not.toHaveBeenCalled();
  });
});

describe("ProductDangerZone", () => {
  it("offers Archive instead of Delete for ordered products", () => {
    render(<ProductDangerZone productId={VARIANT_ID} title="Canvas Tote" hasOrders archived={false} />);
    expect(screen.getByRole("button", { name: "Archive product" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete product" })).not.toBeInTheDocument();
  });

  it("offers Delete for products that were never ordered", () => {
    render(<ProductDangerZone productId={VARIANT_ID} title="Canvas Tote" hasOrders={false} archived={false} />);
    expect(screen.getAllByRole("button", { name: "Delete product" }).length).toBeGreaterThan(0);
  });
});
