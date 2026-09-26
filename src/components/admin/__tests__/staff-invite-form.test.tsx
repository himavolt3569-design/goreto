import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/features/admin/auth";
import { StaffInviteForm } from "../staff-invite-form";

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

// Server Actions are server-only; the form needs a reference it can call.
const inviteStaffAction = vi.fn<Action>();
vi.mock("@/features/admin/actions/staff", () => ({
  inviteStaffAction: (previous: ActionResult | null, formData: FormData) => inviteStaffAction(previous, formData),
}));

beforeEach(() => inviteStaffAction.mockReset());

describe("StaffInviteForm", () => {
  it("starts with no permissions ticked and submits every ticked permission", async () => {
    inviteStaffAction.mockResolvedValue({ ok: true, message: "Invitation sent." });
    render(<StaffInviteForm />);

    const boxes = screen.getAllByRole("checkbox");
    expect(boxes).toHaveLength(14);
    expect(boxes.every((box) => !(box as HTMLInputElement).checked)).toBe(true);

    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByLabelText("View orders"));
    fireEvent.click(screen.getByLabelText("Fulfil orders"));
    fireEvent.click(screen.getByRole("button", { name: /Send invitation/ }));

    await waitFor(() => expect(inviteStaffAction).toHaveBeenCalledOnce());
    const formData = inviteStaffAction.mock.calls[0]![1];
    expect(formData.get("email")).toBe("new@example.com");
    expect(formData.getAll("permissions")).toEqual(["orders.read", "orders.write"]);

    expect(await screen.findByRole("status")).toHaveTextContent("Invitation sent.");
    expect(screen.getByLabelText(/Email address/)).toHaveValue("");
    expect(screen.getByLabelText("View orders")).not.toBeChecked();
  });

  it("shows the email error inline and keeps what was typed", async () => {
    inviteStaffAction.mockResolvedValue({ ok: false, message: "Already on the team.", fieldErrors: { email: "Already on the team." } });
    render(<StaffInviteForm />);

    fireEvent.change(screen.getByLabelText(/Email address/), { target: { value: "owner@example.com" } });
    fireEvent.click(screen.getByLabelText("View analytics"));
    fireEvent.click(screen.getByRole("button", { name: /Send invitation/ }));

    const email = screen.getByLabelText(/Email address/);
    await waitFor(() => expect(email).toHaveAttribute("aria-invalid", "true"));
    expect(email).toHaveValue("owner@example.com");
    expect(email).toHaveAccessibleDescription(/Already on the team/);
    expect(screen.getByLabelText("View analytics")).toBeChecked();
  });
});
