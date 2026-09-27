import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ArAssetFormValues, ArProduct } from "@/features/admin/queries/ar-editor";
import type { PickerProduct } from "@/features/admin/queries/collection-editor";
import { defaultCalibration } from "@/features/admin/ar-forms";
import { ArAssetForm } from "../ar-asset-form";
import { MediaUpload } from "../media-upload";

// Server Actions are server-only; the forms need references they can call.
const searchArProductsAction = vi.fn<(query: unknown) => Promise<{ ok: true; products: PickerProduct[] }>>();
const fetchArProductAction = vi.fn<(id: unknown) => Promise<{ ok: true; product: ArProduct }>>();
vi.mock("@/features/admin/actions/ar", () => ({
  saveArAssetAction: vi.fn(),
  createArAssetUploadAction: vi.fn(),
  searchArProductsAction: (query: unknown) => searchArProductsAction(query),
  fetchArProductAction: (id: unknown) => fetchArProductAction(id),
}));
const searchMediaProductsAction = vi.fn<(query: unknown) => Promise<{ ok: true; products: PickerProduct[] }>>();
vi.mock("@/features/admin/actions/media", () => ({
  searchMediaProductsAction: (query: unknown) => searchMediaProductsAction(query),
  cleanUpStorageAction: vi.fn(),
}));
vi.mock("@/features/admin/actions/products", () => ({ createProductMediaUploadAction: vi.fn(), attachProductMediaAction: vi.fn() }));

const EARRINGS: ArProduct = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "Pearl Drop Earrings",
  status: "active",
  thumbnail: null,
  variants: [{ id: "00000000-0000-4000-8000-0000000000a1", label: "Gold (GRT-PDE-GLD)" }],
};
const PICKED: PickerProduct = { id: EARRINGS.id, title: EARRINGS.title, status: "active", thumbnail: null };

const values = (change: Partial<ArAssetFormValues> = {}): ArAssetFormValues => ({
  productId: EARRINGS.id,
  variantId: "",
  mode: "live_2d",
  placement: "ear",
  assetPath: "",
  calibration: defaultCalibration("ear"),
  isActive: true,
  ...change,
});

const fileInput = (container: HTMLElement) => container.querySelector<HTMLInputElement>('input[type="file"]')!;

beforeEach(() => {
  searchArProductsAction.mockReset();
  fetchArProductAction.mockReset();
  searchMediaProductsAction.mockReset();
});

describe("ArAssetForm", () => {
  it("accepts overlay images for live 2D and models for live 3D", () => {
    const { container, unmount } = render(<ArAssetForm assetId={null} initialProduct={EARRINGS} values={values()} format="" fileUrl={null} updatedLabel={null} />);
    expect(fileInput(container).accept).toContain("image/png");
    expect(fileInput(container).accept).not.toContain("model/gltf-binary");
    unmount();

    const three = render(<ArAssetForm assetId={null} initialProduct={EARRINGS} values={values({ mode: "live_3d" })} format="" fileUrl={null} updatedLabel={null} />);
    expect(fileInput(three.container).accept).toContain("model/gltf-binary");
    expect(fileInput(three.container).accept).toContain(".usdz");
    expect(fileInput(three.container).accept).not.toContain("image/png");
  });

  it("keeps calibration collapsed with defaults", () => {
    const { container } = render(<ArAssetForm assetId={null} initialProduct={EARRINGS} values={values()} format="" fileUrl={null} updatedLabel={null} />);
    const details = container.querySelector("details")!;
    expect(details.open).toBe(false);
    expect(screen.getByLabelText(/^Scale/)).toHaveValue(1);
  });

  it("needs a product before a file can be uploaded, then loads its variants", async () => {
    searchArProductsAction.mockResolvedValue({ ok: true, products: [PICKED] });
    fetchArProductAction.mockResolvedValue({ ok: true, product: EARRINGS });
    render(<ArAssetForm assetId={null} initialProduct={null} values={values({ productId: "" })} format="" fileUrl={null} updatedLabel={null} />);

    expect(screen.getByRole("button", { name: /Upload file/ })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText("Search products"), { target: { value: "pearl" } });
    fireEvent.click(await screen.findByRole("button", { name: /Choose Pearl Drop Earrings/ }));

    await waitFor(() => expect(fetchArProductAction).toHaveBeenCalledWith(EARRINGS.id));
    await waitFor(() => expect(screen.getByRole("button", { name: /Upload file/ })).toBeEnabled());
    expect(screen.getByText("Pearl Drop Earrings")).toBeInTheDocument();
  });

  it("warns when the current file doesn't suit the mode", () => {
    render(
      <ArAssetForm
        assetId="00000000-0000-4000-8000-0000000000f1"
        initialProduct={EARRINGS}
        values={values({ mode: "live_3d", assetPath: "ar/pearl-drop-earrings/overlay.png" })}
        format="png"
        fileUrl={null}
        updatedLabel="1 Oct 2026"
      />,
    );
    expect(screen.getByText(/Live 3D model needs a GLB or USDZ file/)).toBeInTheDocument();
    expect(screen.getByText(/never uploaded here/)).toBeInTheDocument();
  });
});

describe("MediaUpload", () => {
  it("uploads only once a product and photos are chosen", async () => {
    searchMediaProductsAction.mockResolvedValue({ ok: true, products: [PICKED] });
    const { container } = render(<MediaUpload />);
    expect(screen.getByRole("button", { name: "Upload" })).toBeDisabled();

    fireEvent.change(fileInput(container), { target: { files: [new File(["x"], "topi.jpg", { type: "image/jpeg" })] } });
    expect(screen.getByText("topi.jpg")).toBeInTheDocument();
    expect(screen.getByText("Choose a product to upload to.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload 1 photo" })).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText("Search products"), { target: { value: "pearl" } });
    fireEvent.click(await screen.findByRole("button", { name: /Choose Pearl Drop Earrings/ }));
    expect(screen.getByRole("button", { name: "Upload 1 photo" })).toBeEnabled();
  });
});
