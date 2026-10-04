import { fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import type { CheckoutFormValues } from "@/features/checkout/schemas";
import type { NepalAddressData } from "@/features/delivery/nepal-address";
import { AddressSection } from "./address-section";

vi.mock("@/components/store/map/location-map", () => ({ LocationMap: () => <div data-testid="map" /> }));

const data: NepalAddressData = {
  provinces: [
    { code: "bagmati", name: "Bagmati Province" },
    { code: "gandaki", name: "Gandaki Province" },
  ],
  districts: [
    { code: "kathmandu", provinceCode: "bagmati", name: "Kathmandu" },
    { code: "kaski", provinceCode: "gandaki", name: "Kaski" },
  ],
  municipalities: [
    { code: "kathmandu-metro", districtCode: "kathmandu", name: "Kathmandu Metropolitan City", wardCount: 32, postalCode: "44600" },
    { code: "pokhara-metro", districtCode: "kaski", name: "Pokhara Metropolitan City", wardCount: 33, postalCode: "33700" },
  ],
};

const empty: CheckoutFormValues = {
  fullName: "",
  email: "",
  phone: "",
  provinceCode: "",
  districtCode: "",
  municipalityCode: "",
  ward: "",
  streetLandmark: "",
  postalCode: "",
  latitude: null,
  longitude: null,
  courierServiceId: "",
  couponCode: "",
  note: "",
};

const probe: { getValues?: () => CheckoutFormValues } = {};
const values = () => probe.getValues!();

function Harness({ defaults = empty }: { defaults?: CheckoutFormValues }) {
  const form = useForm<CheckoutFormValues>({ defaultValues: defaults });
  useEffect(() => {
    probe.getValues = form.getValues;
  }, [form]);
  return (
    <FormProvider {...form}>
      <AddressSection data={data} />
    </FormProvider>
  );
}

function choose(label: string, option: string) {
  fireEvent.click(screen.getByRole("combobox", { name: new RegExp(label) }));
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: option }));
}

describe("AddressSection", () => {
  it("cascades Province → District → Municipality → Ward and fills the postal code", () => {
    render(<Harness />);
    expect(screen.getByRole("combobox", { name: /District/ })).toBeDisabled();

    choose("Province", "Bagmati Province");
    choose("District", "Kathmandu");
    choose("Municipality", "Kathmandu Metropolitan City");
    choose("Ward", "Ward No. 26");

    expect(values()).toMatchObject({
      provinceCode: "bagmati",
      districtCode: "kathmandu",
      municipalityCode: "kathmandu-metro",
      ward: "26",
      postalCode: "44600",
    });
  });

  it("clears the lower levels when a higher level changes", () => {
    render(
      <Harness
        defaults={{ ...empty, provinceCode: "bagmati", districtCode: "kathmandu", municipalityCode: "kathmandu-metro", ward: "4" }}
      />,
    );
    choose("Province", "Gandaki Province");
    expect(values()).toMatchObject({ provinceCode: "gandaki", districtCode: "", municipalityCode: "", ward: "" });
  });

  it("treats denied location access as a normal message and keeps manual entry", async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, failure?: PositionErrorCallback | null) =>
      failure?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "denied" } as GeolocationPositionError),
    );
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Use Current Location" }));

    expect(await screen.findByText(/Location access is off/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /Province/ })).toBeEnabled();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
  });

  it("fills the area and ward from the location and shows the map", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: 27.7154, longitude: 85.3123 } } as GeolocationPosition),
    );
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    const fetchMock = vi.fn(async () =>
      Response.json({ provinceCode: "bagmati", districtCode: "kathmandu", municipalityCode: "kathmandu-metro", ward: 26, postalCode: "44600" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Use Current Location" }));

    expect(await screen.findByText(/check the area and ward, then add your street/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/geocode/reverse?lat=27.7154&lng=85.3123", expect.anything());
    expect(screen.getByTestId("map")).toBeInTheDocument();
    expect(values()).toMatchObject({ municipalityCode: "kathmandu-metro", ward: "26", latitude: 27.7154, longitude: 85.3123 });
    vi.unstubAllGlobals();
  });

  it("asks for the ward when the location has no ward boundary", async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({ coords: { latitude: 27.7154, longitude: 85.3123 } } as GeolocationPosition),
    );
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ provinceCode: "bagmati", districtCode: "kathmandu", municipalityCode: "kathmandu-metro", ward: null, postalCode: null })),
    );

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Use Current Location" }));

    expect(await screen.findByText(/choose your ward and add your street/)).toBeInTheDocument();
    expect(values()).toMatchObject({ municipalityCode: "kathmandu-metro", ward: "" });
    vi.unstubAllGlobals();
  });
});
