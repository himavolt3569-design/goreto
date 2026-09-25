import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Field } from "../field";
import { Select, type SelectOption } from "../select";

const options: SelectOption[] = [
  { value: "jewelry", label: "Jewelry" },
  { value: "earrings", label: "Earrings", depth: 1, context: "Jewelry" },
  { value: "rings", label: "Rings", depth: 1, context: "Jewelry", disabled: true },
  { value: "necklaces", label: "Necklaces", depth: 1, context: "Jewelry" },
  { value: "sunglasses", label: "Sunglasses" },
];

function renderSelect(props: Partial<Parameters<typeof Select>[0]> = {}) {
  const onValueChange = vi.fn();
  const utils = render(
    <form data-testid="form">
      <Field label="Category">
        {(control) => <Select {...control} name="category" options={options} onValueChange={onValueChange} {...props} />}
      </Field>
    </form>,
  );
  const trigger = screen.getByRole("combobox", { name: "Category" });
  const formValue = () => new FormData(screen.getByTestId("form") as HTMLFormElement).get("category");
  return { ...utils, trigger, onValueChange, formValue };
}

describe("Select", () => {
  it("defaults to the first option like a native select and submits it", () => {
    const { trigger, formValue } = renderSelect();
    expect(trigger).toHaveTextContent("Jewelry");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(formValue()).toBe("jewelry");
  });

  it("shows the parent as context for a nested option", () => {
    const { trigger } = renderSelect({ defaultValue: "earrings" });
    expect(trigger).toHaveTextContent("Jewelry › Earrings");
  });

  it("opens on click, marks the selected option and chooses on click", () => {
    const { trigger, onValueChange, formValue } = renderSelect({ defaultValue: "earrings" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("option", { name: "Earrings" })).toHaveAttribute("aria-selected", "true");
    expect(trigger).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Earrings" }).id);

    fireEvent.click(screen.getByRole("option", { name: "Sunglasses" }));
    expect(onValueChange).toHaveBeenCalledWith("sunglasses");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(formValue()).toBe("sunglasses");
  });

  it("moves with arrow keys, skips disabled options, and commits with Enter", () => {
    const { trigger, onValueChange } = renderSelect({ defaultValue: "earrings" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Necklaces" }).id);
    fireEvent.keyDown(trigger, { key: "End" });
    expect(trigger).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Sunglasses" }).id);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("sunglasses");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("closes on Escape without changing the value", () => {
    const { trigger, onValueChange } = renderSelect();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(trigger).toHaveTextContent("Jewelry");
  });

  it("jumps by typed letters", () => {
    const { trigger } = renderSelect();
    fireEvent.keyDown(trigger, { key: "n" });
    expect(trigger).toHaveAttribute("aria-activedescendant", screen.getByRole("option", { name: "Necklaces" }).id);
  });

  it("shows a placeholder and keeps native required validation", () => {
    const { trigger, formValue } = renderSelect({ placeholder: "Choose a category", required: true });
    expect(trigger).toHaveTextContent("Choose a category");
    expect(formValue()).toBe("");
    expect((screen.getByTestId("form") as HTMLFormElement).checkValidity()).toBe(false);
  });

  it("restores the initial value on form reset", () => {
    const { trigger } = renderSelect({ defaultValue: "earrings" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Sunglasses" }));
    expect(trigger).toHaveTextContent("Sunglasses");
    fireEvent.reset(screen.getByTestId("form"));
    expect(trigger).toHaveTextContent("Jewelry › Earrings");
  });
});
