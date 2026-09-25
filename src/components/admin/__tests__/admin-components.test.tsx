import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CubeIcon } from "@/components/ui/icons";
import type { ActionResult } from "@/features/admin/auth";
import { ActionMessage, ToggleForm } from "../action-forms";
import { KpiCard } from "../kpi-card";
import { Menu, MenuButton, MenuLink } from "../menu";
import { OrderActions } from "../order-actions";
import { DateRangePicker } from "../range-controls";
import { SidebarNav } from "../sidebar-nav";

let pathname = "/admin/orders/GT2609241234";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

// Server Actions are server-only; the components only need references.
vi.mock("@/features/admin/actions/orders", () => ({
  transitionOrderAction: vi.fn(),
  assignCourierAction: vi.fn(),
  addShipmentEventAction: vi.fn(),
  markRefundedAction: vi.fn(),
}));

const noopAction = async (): Promise<ActionResult> => ({ ok: true });

describe("SidebarNav", () => {
  it("shows only allowed items, grouped, and marks the current section", () => {
    pathname = "/admin/orders/GT2609241234";
    render(<SidebarNav allowedHrefs={["/admin", "/admin/orders", "/admin/payments", "/admin/support"]} />);
    const nav = screen.getByRole("navigation", { name: "Admin" });
    expect(within(nav).getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard", "Orders", "Payments", "Support"]);
    expect(within(nav).getByRole("list", { name: "Sales" })).toBeInTheDocument();
    expect(within(nav).queryByRole("list", { name: "Catalog" })).not.toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Orders" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current");
  });

  it("marks the dashboard only on /admin itself", () => {
    pathname = "/admin";
    render(<SidebarNav allowedHrefs={["/admin", "/admin/orders"]} />);
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
  });
});

describe("Menu", () => {
  function renderMenu(onSelect = vi.fn()) {
    render(
      <Menu trigger="Actions" triggerLabel="Actions">
        <MenuLink href="/admin/orders">Orders</MenuLink>
        <MenuButton onClick={onSelect}>Archive</MenuButton>
      </Menu>,
    );
    return onSelect;
  }

  it("opens, moves focus with arrow keys, and closes on Escape back to the trigger", () => {
    renderMenu();
    const trigger = screen.getByRole("button", { name: "Actions" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const items = screen.getAllByRole("menuitem");
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: "ArrowDown" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1]!, { key: "ArrowDown" });
    expect(items[0]).toHaveFocus();
    fireEvent.keyDown(items[0]!, { key: "End" });
    expect(items[1]).toHaveFocus();
    fireEvent.keyDown(items[1]!, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("runs a button item and closes", () => {
    const onSelect = renderMenu();
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("KpiCard", () => {
  it("states the change in text, not only colour", () => {
    render(
      <KpiCard label="Orders" value="1,428" icon={CubeIcon} change={{ kind: "change", direction: "down", percent: 4.2 }} compareLabel="vs last month" trend={[1, 3, 2]} />,
    );
    expect(screen.getByRole("heading", { name: "Orders" })).toBeInTheDocument();
    expect(screen.getByText("1,428")).toBeInTheDocument();
    expect(screen.getByText("down 4.2% vs last month")).toBeInTheDocument();
  });
});

describe("ToggleForm", () => {
  it("exposes a switch with its state and submits the opposite value", () => {
    const { container } = render(<ToggleForm action={noopAction} id="c1b9a8e2-0000-4000-8000-000000000001" checked label="Pathao active" />);
    const toggle = screen.getByRole("switch", { name: "Pathao active" });
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(container.querySelector('input[name="value"]')).toHaveValue("false");
  });
});

describe("ActionMessage", () => {
  it("announces errors as alerts and successes as status", () => {
    const { rerender } = render(<ActionMessage state={{ ok: false, message: "Stock cannot go below zero" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Stock cannot go below zero");
    rerender(<ActionMessage state={{ ok: true, message: "Saved." }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
  });
});

describe("OrderActions", () => {
  const base = { orderId: "e63365dd-2c34-5efa-88d6-f4c99a6badf0", couriers: [{ id: "c1", name: "Pathao" }], currentCourierId: null, currentTracking: null };

  it("offers only the next step, courier assignment and cancel for a packed order", () => {
    render(<OrderActions {...base} status="packed" paymentStatus="pending" hasCourier={false} />);
    expect(screen.getByRole("button", { name: "Mark shipped" })).toBeDisabled();
    expect(screen.getByText("Assign a courier before marking the order shipped.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign courier" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel order" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add tracking update" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark refunded" })).not.toBeInTheDocument();
  });

  it("allows tracking updates while shipped and refunds only after collection", () => {
    const { rerender } = render(<OrderActions {...base} status="shipped" paymentStatus="pending" hasCourier />);
    expect(screen.getByRole("button", { name: "Mark delivered" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Add tracking update" })).toBeInTheDocument();
    rerender(<OrderActions {...base} status="delivered" paymentStatus="collected" hasCourier />);
    expect(screen.getByRole("button", { name: "Mark refunded" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel order" })).not.toBeInTheDocument();
  });

  it("says when nothing is left to do", () => {
    render(<OrderActions {...base} status="canceled" paymentStatus="failed" hasCourier={false} />);
    expect(screen.getByText("This order is complete. There are no further steps.")).toBeInTheDocument();
  });
});

describe("DateRangePicker", () => {
  it("lists presets as links with the selected one marked, and keeps other params in the custom form", () => {
    const { container } = render(
      <DateRangePicker
        label="Sep 1, 2026 – Sep 30, 2026"
        from="2026-09-01"
        to="2026-09-30"
        preserved={{ revenue: "90d" }}
        presets={[
          { label: "This month", href: "/admin?from=2026-09-01&to=2026-09-30", selected: true },
          { label: "Last month", href: "/admin?from=2026-08-01&to=2026-08-31", selected: false },
        ]}
      />,
    );
    const trigger = screen.getByRole("button", { name: /Date range:\s*Sep 1, 2026 – Sep 30, 2026/ });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "This month" })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: "Last month" })).toHaveAttribute("href", "/admin?from=2026-08-01&to=2026-08-31");
    expect(container.querySelector('input[type="hidden"][name="revenue"]')).toHaveValue("90d");
    expect(screen.getByLabelText("From")).toHaveValue("2026-09-01");
  });
});
