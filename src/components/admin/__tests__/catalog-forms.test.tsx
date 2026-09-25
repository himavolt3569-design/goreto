import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/features/admin/auth";
import type { PickerProduct } from "@/features/admin/queries/collection-editor";
import { useState } from "react";
import type { InlineCategoryResult } from "@/features/admin/actions/categories";
import type { CategoryOption } from "@/features/admin/queries/catalog";
import { CategoryForm, CategorySelect } from "../category-form";
import { CollectionProducts } from "../collection-products";
import { NameSlugFields } from "../slug-field";

// Server Actions are server-only; the forms need references they can call.
const saveCategoryAction = vi.fn<(previous: ActionResult | null, formData: FormData) => Promise<ActionResult>>();
const createCategoryInlineAction = vi.fn<(previous: InlineCategoryResult | null, formData: FormData) => Promise<InlineCategoryResult>>();
vi.mock("@/features/admin/actions/categories", () => ({
  saveCategoryAction: (previous: ActionResult | null, formData: FormData) => saveCategoryAction(previous, formData),
  createCategoryInlineAction: (previous: InlineCategoryResult | null, formData: FormData) => createCategoryInlineAction(previous, formData),
}));

// jsdom has no modal dialogs.
Object.assign(HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) {
    this.open = true;
  },
  close(this: HTMLDialogElement) {
    this.open = false;
  },
});
const searchCollectionProductsAction = vi.fn<(query: unknown) => Promise<{ ok: true; products: PickerProduct[] }>>();
vi.mock("@/features/admin/actions/collections", () => ({
  searchCollectionProductsAction: (query: unknown) => searchCollectionProductsAction(query),
}));
vi.mock("@/features/admin/actions/catalog-images", () => ({ createCatalogImageUploadAction: vi.fn() }));
vi.mock("@/features/admin/actions/products", () => ({ createProductMediaUploadAction: vi.fn() }));

const STAGING_ID = "3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const PARENT_ID = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";

const product = (id: string, title: string): PickerProduct => ({ id, title, status: "active", thumbnail: null });
const EARRINGS = product("00000000-0000-4000-8000-000000000001", "Pearl Drop Earrings");
const TOTE = product("00000000-0000-4000-8000-000000000002", "Canvas Tote");
const SCARF = product("00000000-0000-4000-8000-000000000003", "Pashmina Scarf");

beforeEach(() => {
  saveCategoryAction.mockReset();
  createCategoryInlineAction.mockReset();
  searchCollectionProductsAction.mockReset();
});

describe("NameSlugFields", () => {
  function renderFields(savedSlug: string | null = null) {
    return render(
      <form>
        <NameSlugFields
          nameLabel="Category name"
          namePlaceholder=""
          nameMaxLength={80}
          basePath="/categories"
          defaultTitle={savedSlug ? "Bags" : ""}
          defaultSlug={savedSlug ?? ""}
          savedSlug={savedSlug}
          errors={{}}
        />
      </form>,
    );
  }

  it("follows the name until the slug is typed, then Generate from name switches back", () => {
    renderFields();
    const name = screen.getByLabelText(/Category name/);
    const slug = screen.getByLabelText(/URL slug/);
    fireEvent.change(name, { target: { value: "Festive Wear & Saris" } });
    expect(slug).toHaveValue("festive-wear-saris");
    expect(screen.getByText(/Auto from name/)).toBeInTheDocument();

    fireEvent.change(slug, { target: { value: "Dashain Picks" } });
    expect(slug).toHaveValue("dashain-picks");
    expect(screen.getByText(/Custom/)).toBeInTheDocument();
    fireEvent.change(name, { target: { value: "Something Else" } });
    expect(slug).toHaveValue("dashain-picks");

    fireEvent.click(screen.getByRole("button", { name: "Generate from name" }));
    expect(slug).toHaveValue("something-else");
  });

  it("shows an inline rule error after leaving the slug, and warns when a saved slug changes", () => {
    renderFields("bags");
    const slug = screen.getByLabelText(/URL slug/);
    fireEvent.change(slug, { target: { value: "ab" } });
    fireEvent.blur(slug);
    expect(screen.getByText("Use at least 3 characters")).toBeInTheDocument();
    expect(screen.getByText(/breaks links people already shared to \/categories\/bags/)).toBeInTheDocument();
  });
});

describe("CategoryForm", () => {
  function renderForm(hasChildren = false) {
    return render(
      <CategoryForm
        categoryId={null}
        values={{ title: "", slug: "", parentId: PARENT_ID, description: "", imagePath: "", isActive: true, sortOrder: 0 }}
        imageUrl={null}
        parents={[{ id: PARENT_ID, title: "Jewelry", parentId: null }]}
        hasChildren={hasChildren}
        saved={null}
        stagingId={STAGING_ID}
      />,
    );
  }

  it("submits the fields as FormData and shows server field errors inline", async () => {
    saveCategoryAction.mockResolvedValue({ ok: false, message: "Check the form.", fieldErrors: { slug: "Another category already uses this URL slug" } });
    renderForm();
    fireEvent.change(screen.getByLabelText(/Category name/), { target: { value: "Earrings" } });
    fireEvent.click(screen.getByRole("button", { name: "Create category" }));

    await waitFor(() => expect(saveCategoryAction).toHaveBeenCalledTimes(1));
    const formData = saveCategoryAction.mock.calls[0]![1];
    expect(Object.fromEntries(formData.entries())).toMatchObject({
      title: "Earrings",
      slug: "earrings",
      parentId: PARENT_ID,
      stagingId: STAGING_ID,
      isActive: "on",
      sortOrder: "0",
      imagePath: "",
    });
    expect(await screen.findByText("Another category already uses this URL slug")).toBeInTheDocument();
    // The typed name survives the failed submit.
    expect(screen.getByLabelText(/Category name/)).toHaveValue("Earrings");
  });

  it("explains why a category with subcategories stays top-level", () => {
    renderForm(true);
    expect(screen.getByText(/has subcategories, so it stays top-level/)).toBeInTheDocument();
  });
});

describe("CollectionProducts", () => {
  const productIds = (container: HTMLElement) => (container.querySelector('input[name="productIds"]') as HTMLInputElement).value;

  it("reorders and removes products, keeping the hidden field in order", () => {
    const { container } = render(<CollectionProducts initial={[EARRINGS, TOTE, SCARF]} />);
    fireEvent.click(screen.getByRole("button", { name: "Move Pashmina Scarf earlier" }));
    expect(productIds(container)).toBe([EARRINGS.id, SCARF.id, TOTE.id].join(","));
    expect(screen.getByRole("button", { name: "Move Pearl Drop Earrings earlier" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Remove Canvas Tote" }));
    expect(productIds(container)).toBe([EARRINGS.id, SCARF.id].join(","));
    expect(screen.getByText("Canvas Tote removed.")).toBeInTheDocument();
  });

  it("searches after a pause, hides products already listed, and adds a result", async () => {
    vi.useFakeTimers();
    try {
      searchCollectionProductsAction.mockResolvedValue({ ok: true, products: [EARRINGS, TOTE] });
      const { container } = render(<CollectionProducts initial={[EARRINGS]} />);
      fireEvent.change(screen.getByLabelText("Add products"), { target: { value: "ea" } });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(searchCollectionProductsAction).toHaveBeenCalledWith("ea");

      const results = screen.getByRole("list", { name: "Search results" });
      expect(within(results).queryByText("Pearl Drop Earrings")).not.toBeInTheDocument();
      fireEvent.click(within(results).getByRole("button", { name: "Add Canvas Tote" }));
      expect(productIds(container)).toBe([EARRINGS.id, TOTE.id].join(","));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps products the viewer can't see", () => {
    const { container } = render(<CollectionProducts initial={[{ id: SCARF.id, title: null, status: null, thumbnail: null }]} />);
    expect(screen.getByText(/can't see this product's details/)).toBeInTheDocument();
    expect(productIds(container)).toBe(SCARF.id);
  });
});

describe("CategorySelect with + Create new category", () => {
  const CATEGORIES: CategoryOption[] = [
    { id: PARENT_ID, title: "Jewelry", parentId: null },
    { id: "0c6a1d2e-3f4a-4b5c-8d6e-7f8a9b0c1d2e", title: "Earrings", parentId: PARENT_ID },
  ];
  const NEW_PARENT_ID = "11111111-2222-4333-8444-555555555555";
  const NEW_ID = "66666666-7777-4888-8999-000000000000";

  function Harness({ onOuterSubmit }: { onOuterSubmit: () => void }) {
    const [value, setValue] = useState("");
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onOuterSubmit();
        }}
      >
        <input aria-label="Product name" defaultValue="Canvas Tote" />
        <CategorySelect mode="category" categories={CATEGORIES} value={value} onValueChange={setValue} name="categoryId" aria-describedby={undefined} placeholder="Choose a category" />
        <output data-testid="value">{value}</output>
      </form>
    );
  }

  function choose(trigger: HTMLElement, option: string) {
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: option }));
  }

  it("creates a parent and then a category in pop-ups, selects it, and leaves the outer form alone", async () => {
    const onOuterSubmit = vi.fn();
    createCategoryInlineAction
      .mockResolvedValueOnce({ ok: true, message: "Festive Wear created.", category: { id: NEW_PARENT_ID, title: "Festive Wear", parentId: null } })
      .mockResolvedValueOnce({ ok: true, message: "Saris created.", category: { id: NEW_ID, title: "Saris", parentId: NEW_PARENT_ID, parent: { id: NEW_PARENT_ID, title: "Festive Wear" } } });
    render(<Harness onOuterSubmit={onOuterSubmit} />);

    choose(screen.getAllByRole("combobox")[0]!, "+ Create new category");
    const categoryDialog = screen.getByRole("dialog", { name: "New category" });
    expect(screen.getByTestId("value")).toHaveTextContent("");

    // Parent field -> "+ Create new parent category" opens a second pop-up without a parent field.
    choose(within(categoryDialog).getByRole("combobox", { name: /Parent category/ }), "+ Create new parent category");
    const parentDialog = screen.getByRole("dialog", { name: "New parent category" });
    expect(within(parentDialog).queryByText("Parent category")).not.toBeInTheDocument();
    fireEvent.change(within(parentDialog).getByLabelText(/Category name/), { target: { value: "Festive Wear" } });
    fireEvent.click(within(parentDialog).getByRole("button", { name: "Create category" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "New parent category" })).not.toBeInTheDocument());
    expect(Object.fromEntries(createCategoryInlineAction.mock.calls[0]![1].entries())).toMatchObject({ title: "Festive Wear", slug: "festive-wear" });
    expect(createCategoryInlineAction.mock.calls[0]![1].has("parentId")).toBe(false);
    expect(within(categoryDialog).getByRole("combobox", { name: /Parent category/ })).toHaveTextContent("Festive Wear");

    fireEvent.change(within(categoryDialog).getByLabelText(/Category name/), { target: { value: "Saris" } });
    fireEvent.click(within(categoryDialog).getByRole("button", { name: "Create category" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(createCategoryInlineAction.mock.calls[1]![1].get("parentId")).toBe(NEW_PARENT_ID);

    expect(screen.getByTestId("value")).toHaveTextContent(NEW_ID);
    expect(screen.getAllByRole("combobox")[0]).toHaveTextContent("Festive Wear › Saris");
    expect(screen.getByLabelText("Product name")).toHaveValue("Canvas Tote");
    expect(onOuterSubmit).not.toHaveBeenCalled();
  });

  it("keeps the pop-up open with the error when creating fails, and Cancel closes it", async () => {
    createCategoryInlineAction.mockResolvedValue({ ok: false, message: "Check the form.", fieldErrors: { slug: "Another category already uses this URL slug" } });
    render(<Harness onOuterSubmit={vi.fn()} />);
    choose(screen.getAllByRole("combobox")[0]!, "+ Create new category");
    const dialog = screen.getByRole("dialog", { name: "New category" });
    fireEvent.change(within(dialog).getByLabelText(/Category name/), { target: { value: "Earrings" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create category" }));
    expect(await within(dialog).findByText("Another category already uses this URL slug")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("value")).toHaveTextContent("");
  });
});
