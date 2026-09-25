import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "../field";
import { Input } from "../input";
import { Select } from "../select";

describe("Field", () => {
  it("associates the label with the control", () => {
    render(
      <Field label="Full name">
        {(control) => <Input {...control} placeholder="Your name" />}
      </Field>,
    );
    expect(screen.getByLabelText("Full name")).toHaveAttribute(
      "placeholder",
      "Your name",
    );
  });

  it("wires hint and error text and marks the control invalid", () => {
    render(
      <Field label="Phone" hint="10-digit mobile number" error="Enter a valid number">
        {(control) => <Input {...control} />}
      </Field>,
    );
    const input = screen.getByLabelText("Phone");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "10-digit mobile number Enter a valid number",
    );
  });

  it("does not mark a valid control invalid", () => {
    render(<Field label="Email">{(control) => <Input {...control} />}</Field>);
    const input = screen.getByLabelText("Email");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
  });

  it("works with Select", () => {
    render(
      <Field label="Sort by">
        {(control) => (
          <Select
            {...control}
            defaultValue="new"
            options={[
              { value: "relevant", label: "Most Relevant" },
              { value: "new", label: "Newest" },
            ]}
          />
        )}
      </Field>,
    );
    expect(screen.getByRole("combobox", { name: "Sort by" })).toHaveTextContent("Newest");
  });
});
