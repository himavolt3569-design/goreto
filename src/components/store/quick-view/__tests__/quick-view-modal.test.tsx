import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { QuickViewModal } from "../quick-view-modal";

const back = vi.fn();
let pathname = "/products/pearl-choker";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back }),
  usePathname: () => pathname,
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

function renderModal() {
  return render(
    <QuickViewModal href="/products/pearl-choker">
      <h2 id="quick-view-title">Pearl Choker</h2>
      <button type="button">Add to Cart</button>
    </QuickViewModal>,
  );
}

describe("QuickViewModal", () => {
  beforeEach(() => {
    back.mockClear();
    pathname = "/products/pearl-choker";
  });

  it("opens as a dialog named by the product title", () => {
    renderModal();
    const dialog = screen.getByRole("dialog", { name: "Pearl Choker" });
    expect(dialog).toHaveProperty("open", true);
  });

  it("goes back in history once, however many times it is closed", () => {
    renderModal();
    const dialog = screen.getByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Close quick view" }));
    expect(back).toHaveBeenCalledTimes(1);

    // Only one history step, however many times the user tries to close.
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    fireEvent.click(dialog);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and on a backdrop click", () => {
    const { unmount } = renderModal();
    const cancel = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), cancel);
    expect(back).toHaveBeenCalledTimes(1);
    // The router closes it, not the browser.
    expect(cancel.defaultPrevented).toBe(true);
    unmount();

    renderModal();
    fireEvent.click(screen.getByRole("dialog"));
    expect(back).toHaveBeenCalledTimes(2);
  });

  it("stays open on clicks inside the content", () => {
    renderModal();
    fireEvent.click(screen.getByRole("button", { name: "Add to Cart" }));
    fireEvent.click(screen.getByRole("heading", { name: "Pearl Choker" }));
    expect(back).not.toHaveBeenCalled();
  });

  it("renders nothing once the URL is no longer the product", () => {
    pathname = "/cart";
    renderModal();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("returns focus to the element that opened it", () => {
    const opener = document.createElement("a");
    opener.href = "/products/pearl-choker";
    document.body.append(opener);
    opener.focus();

    const { unmount } = renderModal();
    screen.getByRole("button", { name: "Add to Cart" }).focus();
    unmount();

    expect(opener).toHaveFocus();
    opener.remove();
  });
});
