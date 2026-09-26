import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActionResult } from "@/features/admin/auth";
import { emptyCouponValues } from "@/features/admin/queries/coupon-editor";
import type { CourierServiceValues, ProvinceDistricts, RateOptions } from "@/features/admin/queries/delivery-editor";
import { CouponForm } from "../coupon-form";
import { CourierServices } from "../courier-services";
import { DistrictPicker } from "../district-picker";
import { RateForm } from "../rate-form";

type Action = (previous: ActionResult | null, formData: FormData) => Promise<ActionResult>;

// Server Actions are server-only; the forms need references they can call.
const saveCouponAction = vi.fn<Action>();
const saveCourierServiceAction = vi.fn<Action>();
vi.mock("@/features/admin/actions/coupons", () => ({
  saveCouponAction: (previous: ActionResult | null, formData: FormData) => saveCouponAction(previous, formData),
}));
vi.mock("@/features/admin/actions/delivery", () => ({
  saveCourierServiceAction: (previous: ActionResult | null, formData: FormData) => saveCourierServiceAction(previous, formData),
  deleteCourierServiceAction: vi.fn(),
  saveRateAction: vi.fn(),
}));
// The coupon editor module is server-only; only its pure empty-values helper is used here.
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ getUserSupabase: vi.fn() }));

// jsdom has no modal dialogs.
Object.assign(HTMLDialogElement.prototype, {
  showModal(this: HTMLDialogElement) {
    this.open = true;
  },
  close(this: HTMLDialogElement) {
    this.open = false;
  },
});

const ZONE = "7d9f6b1e-8c1a-4d6e-9b2f-3a4c5d6e7f80";
const OTHER_ZONE = "00000000-0000-4000-8000-00000000000a";
const COURIER = "00000000-0000-4000-8000-00000000000c";

beforeEach(() => {
  saveCouponAction.mockReset();
  saveCourierServiceAction.mockReset();
});

function submitted(action: ReturnType<typeof vi.fn<Action>>): Record<string, string> {
  const formData = action.mock.calls.at(-1)![1];
  return Object.fromEntries([...formData.entries()].map(([key, value]) => [key, String(value)]));
}

describe("CouponForm", () => {
  it("submits only the chosen discount type's fields and previews the discount", async () => {
    saveCouponAction.mockResolvedValue({ ok: true, message: "Coupon saved." });
    render(<CouponForm couponId={null} values={emptyCouponValues(new Date("2026-10-20T03:15:00Z"))} orderCount={0} timesUsed={0} updatedLabel={null} />);

    fireEvent.change(screen.getByLabelText(/Coupon code/), { target: { value: "tihar 15" } });
    expect(screen.getByLabelText<HTMLInputElement>(/Coupon code/).value).toBe("TIHAR15");
    fireEvent.change(screen.getByLabelText(/Percent off/), { target: { value: "15" } });
    expect(screen.getByText(/15% off on any order/)).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/Fixed amount/));
    expect(screen.queryByLabelText(/Percent off/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Amount off/), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText(/Minimum order/), { target: { value: "2000" } });
    expect(screen.getByText("Rs. 200 off on orders from Rs. 2,000")).toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Create coupon" })));
    const values = submitted(saveCouponAction);
    expect(values).toMatchObject({ code: "TIHAR15", type: "fixed", amountOff: "200", minOrder: "2000", startsAt: "2026-10-20T09:00" });
    expect(values).not.toHaveProperty("percentOff");
  });

  it("locks the code and type once orders used the coupon", () => {
    render(<CouponForm couponId={ZONE} values={{ ...emptyCouponValues(), code: "WELCOME10", percentOff: "10" }} orderCount={3} timesUsed={3} updatedLabel="today" />);
    expect(screen.getByLabelText<HTMLInputElement>(/Coupon code/).readOnly).toBe(true);
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByText(/Used by 3 orders/)).toBeInTheDocument();
  });

  it("keeps typed values and shows field errors from the server", async () => {
    saveCouponAction.mockResolvedValue({ ok: false, message: "Another coupon already uses this code", fieldErrors: { code: "Another coupon already uses this code" } });
    render(<CouponForm couponId={null} values={emptyCouponValues()} orderCount={0} timesUsed={0} updatedLabel={null} />);
    fireEvent.change(screen.getByLabelText(/Coupon code/), { target: { value: "DASHAIN25" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Create coupon" })));
    expect(await screen.findAllByText("Another coupon already uses this code")).not.toHaveLength(0);
    expect(screen.getByLabelText<HTMLInputElement>(/Coupon code/).value).toBe("DASHAIN25");
  });
});

describe("DistrictPicker", () => {
  const groups: ProvinceDistricts[] = [
    {
      code: "bagmati",
      name: "Bagmati",
      districts: [
        { code: "kathmandu", name: "Kathmandu", zone: { id: OTHER_ZONE, name: "Kathmandu Valley" } },
        { code: "dhading", name: "Dhading", zone: null },
        { code: "nuwakot", name: "Nuwakot", zone: { id: ZONE, name: "This zone" } },
      ],
    },
    { code: "gandaki", name: "Gandaki", districts: [{ code: "kaski", name: "Kaski", zone: null }] },
  ];

  function hidden(container: HTMLElement) {
    return container.querySelector<HTMLInputElement>('input[name="districtCodes"]')!.value;
  }

  it("disables districts in other zones and selects the rest of a province", () => {
    const { container } = render(<DistrictPicker groups={groups} zoneId={ZONE} defaultSelected={["nuwakot"]} />);
    expect(screen.getByRole("checkbox", { name: /Kathmandu/ })).toBeDisabled();
    expect(screen.getByText("In Kathmandu Valley")).toBeInTheDocument();
    expect(hidden(container)).toBe("nuwakot");

    fireEvent.click(screen.getByRole("button", { name: "Select all in Bagmati" }));
    expect(hidden(container)).toBe("dhading,nuwakot");
    expect(screen.getByText("2 districts selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear in Bagmati" }));
    expect(hidden(container)).toBe("");
  });

  it("filters districts by name", () => {
    render(<DistrictPicker groups={groups} zoneId={null} defaultSelected={[]} />);
    fireEvent.change(screen.getByLabelText("Find a district"), { target: { value: "kas" } });
    expect(screen.getByRole("checkbox", { name: /Kaski/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Dhading/ })).not.toBeInTheDocument();
  });
});

describe("RateForm", () => {
  const options: RateOptions = {
    zones: [
      { id: ZONE, name: "Kathmandu Valley", isActive: true },
      { id: OTHER_ZONE, name: "Rest of Nepal", isActive: true },
    ],
    services: [{ id: COURIER, name: "Standard", code: "PTH-STD", courierName: "Pathao", isActive: true, minDays: 2, maxDays: 4 }],
    existing: { [`${ZONE}:${COURIER}`]: "00000000-0000-4000-8000-0000000000aa" },
  };

  it("links to the existing rate for a taken zone and service pair", () => {
    render(<RateForm rateId={null} values={{ zoneId: ZONE, serviceId: COURIER, price: "", minDays: "", maxDays: "", minOrder: "", minWeight: "", maxWeight: "", isActive: true }} options={options} updatedLabel={null} />);
    expect(screen.getByRole("link", { name: "Edit that rate" })).toHaveAttribute("href", "/admin/delivery/rates/00000000-0000-4000-8000-0000000000aa/edit");
    expect(screen.getByText(/service's estimate \(2–4 days\)/)).toBeInTheDocument();
  });

  it("doesn't flag the rate being edited", () => {
    render(
      <RateForm
        rateId="00000000-0000-4000-8000-0000000000aa"
        values={{ zoneId: ZONE, serviceId: COURIER, price: "100", minDays: "", maxDays: "", minOrder: "", minWeight: "", maxWeight: "", isActive: true }}
        options={options}
        updatedLabel="today"
      />,
    );
    expect(screen.queryByRole("link", { name: "Edit that rate" })).not.toBeInTheDocument();
  });
});

describe("CourierServices", () => {
  const used: CourierServiceValues = {
    id: "00000000-0000-4000-8000-0000000000b1",
    name: "Express",
    serviceCode: "PTH-EXP",
    level: "express",
    description: "",
    minDays: 1,
    maxDays: 2,
    isActive: true,
    rateCount: 2,
    useCount: 10,
  };

  it("offers delete only for unused services and opens an empty form for a new one", async () => {
    saveCourierServiceAction.mockResolvedValue({ ok: true, message: "Standard added." });
    render(<CourierServices courierId={COURIER} courierName="Pathao" services={[used, { ...used, id: "00000000-0000-4000-8000-0000000000b2", name: "Standard", serviceCode: "PTH-STD", useCount: 0 }]} />);

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]!).queryByRole("button", { name: /Delete/ })).not.toBeInTheDocument();
    expect(within(rows[2]!).getByRole("button", { name: /Delete/ })).toBeInTheDocument();

    fireEvent.click(within(rows[1]!).getByRole("button", { name: /Edit/ }));
    expect(screen.getByLabelText<HTMLInputElement>(/Service name/).value).toBe("Express");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Add service" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText<HTMLInputElement>(/Service name/).value).toBe("");
    fireEvent.change(within(dialog).getByLabelText(/Service name/), { target: { value: "Standard" } });
    fireEvent.change(within(dialog).getByLabelText(/Service code/), { target: { value: "pth std" } });
    await act(async () => fireEvent.click(within(dialog).getByRole("button", { name: "Add service" })));

    expect(submitted(saveCourierServiceAction)).toMatchObject({ courierId: COURIER, name: "Standard", serviceCode: "PTH-STD", level: "standard" });
    expect(submitted(saveCourierServiceAction)).not.toHaveProperty("serviceId");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Standard added.")).toBeInTheDocument();
  });
});
