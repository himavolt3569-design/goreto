import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewsletterForm } from "../newsletter-form";

function submit(email: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Subscribe" }));
}

describe("NewsletterForm", () => {
  it("shows an inline, linked error for an invalid email", async () => {
    render(<NewsletterForm />);
    submit("abc");
    const error = await screen.findByText(/Enter a valid email address/);
    const input = screen.getByLabelText("Email address");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain(error.id);
  });

  it("confirms a valid email without claiming it was stored", async () => {
    render(<NewsletterForm />);
    submit("you@example.com");
    expect(await screen.findByText(/haven't stored your email yet/)).toBeInTheDocument();
  });
});
