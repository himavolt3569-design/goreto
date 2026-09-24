import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { QuantityStepper } from "../quantity-stepper";

function Harness({ initial = 1, max = 3 }: { initial?: number; max?: number }) {
  const [value, setValue] = useState(initial);
  return <QuantityStepper value={value} onChange={setValue} max={max} />;
}

describe("QuantityStepper", () => {
  it("steps between min and max and disables the ends", () => {
    render(<Harness />);
    const input = screen.getByRole("spinbutton", { name: "Quantity" });
    const decrease = screen.getByRole("button", { name: "Decrease quantity" });
    const increase = screen.getByRole("button", { name: "Increase quantity" });

    expect(decrease).toBeDisabled();
    fireEvent.click(increase);
    fireEvent.click(increase);
    expect(input).toHaveValue(3);
    expect(increase).toBeDisabled();
    fireEvent.click(decrease);
    expect(input).toHaveValue(2);
  });

  it("clamps typed values on blur", () => {
    render(<Harness />);
    const input = screen.getByRole("spinbutton", { name: "Quantity" });
    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.blur(input);
    expect(input).toHaveValue(3);

    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input).toHaveValue(3);

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(input).toHaveValue(1);
  });

  it("rejects partial and fractional input instead of truncating it", () => {
    render(<Harness initial={1} />);
    const input = screen.getByRole("spinbutton", { name: "Quantity" });
    for (const typed of ["2abc", "2.5", "  "]) {
      fireEvent.change(input, { target: { value: typed } });
      fireEvent.blur(input);
      expect(input).toHaveValue(1);
    }
  });

  it("is labelled as a group", () => {
    render(<Harness />);
    expect(screen.getByRole("group", { name: "Quantity" })).toBeInTheDocument();
  });
});
