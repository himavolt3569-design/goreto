import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordCourierHandoffAction } from "@/features/admin/actions/orders";
import { CourierHandoffPanel } from "../courier-handoff-panel";

vi.mock("@/features/admin/actions/orders", () => ({
  recordCourierHandoffAction: vi.fn(async () => ({ ok: true, message: "Marked as sent to the courier." })),
}));

const props = {
  orderId: "e63365dd-2c34-5efa-88d6-f4c99a6badf0",
  courierName: "Pathao",
  courierEditHref: "/admin/delivery/couriers/c1/edit",
  whatsappHref: "https://wa.me/9779812345678?text=New%20delivery",
  message: "New delivery from Goreto.store\nOrder #GT260927123456",
  handoff: null,
  acceptedAutomatically: false,
  canSend: true,
};

beforeEach(() => vi.mocked(recordCourierHandoffAction).mockClear());

describe("CourierHandoffPanel", () => {
  it("offers the WhatsApp link for an unsent handoff and records the click", async () => {
    render(<CourierHandoffPanel {...props} acceptedAutomatically />);
    expect(screen.getByText(/Accepted automatically\. Ready to send to Pathao\. Not sent yet\./)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Send to Pathao on WhatsApp/ });
    expect(link).toHaveAttribute("href", props.whatsappHref);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    fireEvent.click(link);
    await waitFor(() => expect(recordCourierHandoffAction).toHaveBeenCalledWith(props.orderId));
    expect(await screen.findByRole("status")).toHaveTextContent("Marked as sent to the courier.");
  });

  it("shows who opened it and offers to send again, without claiming delivery", () => {
    render(<CourierHandoffPanel {...props} handoff={{ attempts: 2, lastSentLabel: "Sep 27, 2026, 10:42 AM", lastSentByName: "Anita" }} />);
    expect(screen.getByText(/Opened in WhatsApp for Pathao · Sep 27, 2026, 10:42 AM by Anita · 2 times/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Send again on WhatsApp/ })).toBeInTheDocument();
    expect(screen.queryByText(/delivered/i)).not.toBeInTheDocument();
  });

  it("asks for a dispatch number when the courier has none, and still shows the message", () => {
    render(<CourierHandoffPanel {...props} whatsappHref={null} />);
    expect(screen.queryByRole("link", { name: /on WhatsApp/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add it to the courier" })).toHaveAttribute("href", props.courierEditHref);
    expect(screen.getByRole("button", { name: /Copy message/ })).toBeInTheDocument();
    expect(screen.getByText(/Order #GT260927123456/)).toBeInTheDocument();
  });

  it("hides sending from staff who can only read orders", () => {
    render(<CourierHandoffPanel {...props} canSend={false} />);
    expect(screen.queryByRole("link", { name: /on WhatsApp/ })).not.toBeInTheDocument();
  });
});
