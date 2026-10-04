import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuickCreateResult } from "@/features/admin/actions/products";
import { BulkProductsForm } from "../bulk-products-form";

// Server Actions are server-only; the page needs references it can call.
const quickCreateProductAction = vi.fn<(input: unknown, staged: unknown) => Promise<QuickCreateResult>>();
const discardStagedMediaAction = vi.fn<(input: unknown) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));
vi.mock("@/features/admin/actions/products", () => ({
  quickCreateProductAction: (input: unknown, staged: unknown) => quickCreateProductAction(input, staged),
  discardStagedMediaAction: (input: unknown) => discardStagedMediaAction(input),
}));

// Uploads go to Storage from the browser; here each file "uploads" to a staged path by its name.
let uploadCount = 0;
vi.mock("../../product-form/upload-photo", () => ({
  ACCEPTED_IMAGE_TYPES: "image/jpeg",
  ACCEPTED_VIDEO_TYPES: "video/mp4",
  uploadMediaFile: async (target: { stagingId: string }, file: File) => {
    if (file.name.endsWith(".mov")) return { ok: false, message: "MOV videos don't play in most browsers. Export it as MP4 and try again." };
    const kind = file.name.endsWith(".mp4") ? "video" : "image";
    const id = `00000000-0000-4000-8000-${String(uploadCount++).padStart(12, "0")}`;
    return { ok: true, kind, path: `products/new-${target.stagingId}/${id}.${kind === "video" ? "mp4" : "jpg"}` };
  },
}));
Object.assign(URL, { createObjectURL: () => "blob:preview", revokeObjectURL: () => undefined });

const CATEGORY_ID = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";
const categories = [{ value: CATEGORY_ID, label: "Earrings" }];

const cards = () => Array.from(screen.getByRole("list", { name: "Products to add" }).querySelectorAll<HTMLElement>(":scope > li"));

function fill(card: HTMLElement, { title, price }: { title?: string; price?: string }) {
  if (title !== undefined) fireEvent.change(within(card).getByLabelText(/Product name/), { target: { value: title } });
  if (price !== undefined) fireEvent.change(within(card).getByLabelText(/^Price/), { target: { value: price } });
}

async function chooseCategory(card: HTMLElement) {
  fireEvent.click(within(card).getByRole("combobox", { name: /Category/ }));
  fireEvent.click(await screen.findByRole("option", { name: "Earrings" }));
}

async function addFiles(card: HTMLElement, names: string[]) {
  const input = within(card).getByLabelText(/photos or videos for/, { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files: names.map((name) => new File(["x"], name, { type: name.endsWith(".mp4") ? "video/mp4" : "image/jpeg" })) } });
  });
}

beforeEach(() => {
  quickCreateProductAction.mockReset();
  discardStagedMediaAction.mockClear();
  uploadCount = 0;
});

describe("BulkProductsForm", () => {
  it("starts with one card and adds another at the end, focused, with the same category", async () => {
    render(<BulkProductsForm categories={categories} />);
    expect(cards()).toHaveLength(1);
    await chooseCategory(cards()[0]!);

    fireEvent.click(screen.getByRole("button", { name: "Add another product" }));
    expect(cards()).toHaveLength(2);
    const second = cards()[1]!;
    await waitFor(() => expect(within(second).getByLabelText(/Product name/)).toHaveFocus());
    expect(within(second).getByRole("combobox", { name: /Category/ })).toHaveTextContent("Earrings");
  });

  it("stages photos and videos, with the cover first and the count shown", async () => {
    render(<BulkProductsForm categories={categories} />);
    const card = cards()[0]!;
    await addFiles(card, ["front.jpg", "clip.mp4", "side.jpg", "clip.mov"]);

    expect(within(card).getByText("2/7 photos")).toBeInTheDocument();
    expect(within(card).getByText("1/3 videos")).toBeInTheDocument();
    expect(within(card).getByText("Cover")).toBeInTheDocument();
    expect(within(card).getByText(/Export it as MP4/)).toBeInTheDocument();
  });

  it("creates valid cards one by one and flags the invalid ones without blocking the rest", async () => {
    quickCreateProductAction.mockImplementation(async (input) => ({
      ok: true,
      id: "0c6a1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e",
      slug: (input as { title: string }).title.toLowerCase().replaceAll(" ", "-"),
      published: false,
      mediaAdded: 1,
      mediaRejected: 0,
    }));
    render(<BulkProductsForm categories={categories} />);
    await chooseCategory(cards()[0]!);
    fill(cards()[0]!, { title: "Silver Hoop", price: "1,200" });
    await addFiles(cards()[0]!, ["front.jpg", "clip.mp4"]);

    fireEvent.click(screen.getByRole("button", { name: "Add another product" }));
    fill(cards()[1]!, { title: "Gold Hoop" }); // no price

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create 2 products" }));
    });

    await waitFor(() => expect(quickCreateProductAction).toHaveBeenCalledOnce());
    const [input, staged] = quickCreateProductAction.mock.calls[0]!;
    expect(input).toMatchObject({ title: "Silver Hoop", price: "1,200", categoryId: CATEGORY_ID });
    expect((staged as { media: { path: string }[] }).media.map((item) => item.path.slice(-3))).toEqual(["jpg", "mp4"]);

    expect(await screen.findByText("Created as draft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open in editor" })).toHaveAttribute("href", "/admin/products/0c6a1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e/edit");
    expect(screen.getByText("Enter a price")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 product created, 1 needs attention");

    // Fix the flagged card and retry: only it is sent.
    fill(cards()[1]!, { price: "1,500" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    await waitFor(() => expect(quickCreateProductAction).toHaveBeenCalledTimes(2));
    expect(quickCreateProductAction.mock.calls[1]![0]).toMatchObject({ title: "Gold Hoop", price: "1,500" });
  });

  it("keeps a failed product editable with the server's message", async () => {
    quickCreateProductAction.mockResolvedValue({ ok: false, message: "Check the highlighted fields.", fieldErrors: { title: "Use at most 120 characters" } });
    render(<BulkProductsForm categories={categories} />);
    await chooseCategory(cards()[0]!);
    fill(cards()[0]!, { title: "Silver Hoop", price: "1,200" });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create product" }));
    });
    expect(await screen.findByText("Use at most 120 characters")).toBeInTheDocument();
    expect(within(cards()[0]!).getByText("Needs attention")).toBeInTheDocument();
    expect(within(cards()[0]!).getByLabelText(/Product name/)).toBeEnabled();
  });

  it("only allows publishing once the product has a photo", async () => {
    render(<BulkProductsForm categories={categories} />);
    const card = cards()[0]!;
    expect(within(card).getByRole("switch", { name: /Publish now/ })).toBeDisabled();
    await addFiles(card, ["front.jpg"]);
    const toggle = within(card).getByRole("switch", { name: /Publish now/ });
    expect(toggle).toBeEnabled();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("discards a removed card's uploads", async () => {
    render(<BulkProductsForm categories={categories} />);
    await addFiles(cards()[0]!, ["front.jpg"]);
    fireEvent.click(screen.getByRole("button", { name: "Add another product" }));
    fireEvent.click(within(cards()[0]!).getByRole("button", { name: /^Remove Product 1/ }));
    expect(cards()).toHaveLength(1);
    expect(discardStagedMediaAction).toHaveBeenCalledOnce();
  });
});
