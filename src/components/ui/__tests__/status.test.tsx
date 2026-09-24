import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "../badge";
import { ProgressBar } from "../progress-bar";
import { OrderStatusPill, StatusIndicator } from "../status";

describe("status communication", () => {
  it("StatusIndicator always renders readable text", () => {
    render(
      <>
        <StatusIndicator status="in_stock" />
        <StatusIndicator status="low_stock" label="Only 3 left" />
        <StatusIndicator status="sold_out" />
      </>,
    );
    expect(screen.getByText("In Stock")).toBeInTheDocument();
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
    expect(screen.getByText("Sold Out")).toBeInTheDocument();
  });

  it("OrderStatusPill maps internal statuses to labels", () => {
    render(
      <>
        <OrderStatusPill status="pending_confirmation" />
        <OrderStatusPill status="canceled" />
      </>,
    );
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Canceled")).toBeInTheDocument();
  });

  it("Badge renders its text", () => {
    render(<Badge tone="ar-ready">AR Ready</Badge>);
    expect(screen.getByText("AR Ready")).toBeInTheDocument();
  });
});

describe("ProgressBar", () => {
  it("exposes progress semantics and clamps the value", () => {
    render(<ProgressBar label="Uploading product media" value={135} />);
    const bar = screen.getByRole("progressbar", { name: "Uploading product media" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("100% complete")).toBeInTheDocument();
  });
});
