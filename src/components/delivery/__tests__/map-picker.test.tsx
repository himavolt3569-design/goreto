import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { NepalAddressData } from "@/features/delivery/nepal-address";
import { NepalAddressFields, type NepalAddressFieldValues } from "../nepal-address-fields";

// The Leaflet map can't run in jsdom: a stand-in reports a pick at Thamel, or
// the map centre, like a click would.
vi.mock("@/components/store/map/location-map", () => ({
  LocationMap: ({
    onPick,
    onReady,
  }: {
    onPick?: (latitude: number, longitude: number) => void;
    onReady?: (controls: { centre: () => { latitude: number; longitude: number } }) => void;
  }) => {
    onReady?.({ centre: () => ({ latitude: 28.2096, longitude: 83.9589 }) });
    return (
      <button type="button" onClick={() => onPick?.(27.7154, 85.3123)}>
        Tap Thamel on the map
      </button>
    );
  },
}));

const data: NepalAddressData = {
  provinces: [{ code: "bagmati", name: "Bagmati Province" }],
  districts: [{ code: "kathmandu", provinceCode: "bagmati", name: "Kathmandu" }],
  municipalities: [
    { code: "kathmandu-metropolitan-city", districtCode: "kathmandu", name: "Kathmandu Metropolitan City", wardCount: 32, postalCode: "44600" },
  ],
};

const empty: NepalAddressFieldValues = {
  provinceCode: "",
  districtCode: "",
  municipalityCode: "",
  ward: "",
  streetLandmark: "",
  postalCode: "",
};

const probe: { getValues?: () => NepalAddressFieldValues } = {};

function Harness({ onLocationPicked }: { onLocationPicked?: (latitude: number, longitude: number) => void }) {
  const form = useForm<NepalAddressFieldValues>({ defaultValues: empty });
  useEffect(() => {
    probe.getValues = form.getValues;
  }, [form]);
  return (
    <FormProvider {...form}>
      <NepalAddressFields data={data} onLocationPicked={onLocationPicked} />
    </FormProvider>
  );
}

function mockLookup(body: object, status = 200) {
  const fetchMock = vi.fn(async () => Response.json(body, { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const openPicker = () => fireEvent.click(screen.getByRole("button", { name: "Pick on map" }));
const dialog = () => screen.getByRole("dialog", { name: "Pick your location", hidden: true });

describe("Pick on map", () => {
  it("fills province, district, municipality and ward from a map tap and keeps the point", async () => {
    const fetchMock = mockLookup({
      provinceCode: "bagmati",
      districtCode: "kathmandu",
      municipalityCode: "kathmandu-metropolitan-city",
      ward: 26,
      postalCode: "44600",
    });
    const onLocationPicked = vi.fn();
    render(<Harness onLocationPicked={onLocationPicked} />);

    openPicker();
    const use = within(dialog()).getByRole("button", { name: "Use this location", hidden: true });
    expect(use).toBeDisabled();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Tap Thamel on the map", hidden: true }));
    expect(await within(dialog()).findByText("Ward 26 · Kathmandu Metropolitan City · Kathmandu · Bagmati Province")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/geocode/reverse?lat=27.7154&lng=85.3123", expect.anything());

    await act(async () => fireEvent.click(use));
    expect(probe.getValues!()).toMatchObject({
      provinceCode: "bagmati",
      districtCode: "kathmandu",
      municipalityCode: "kathmandu-metropolitan-city",
      ward: "26",
      postalCode: "44600",
    });
    expect(onLocationPicked).toHaveBeenCalledWith(27.7154, 85.3123);
    expect(screen.getByText(/Filled in from the map/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: /Street \/ Landmark/ })).toHaveFocus());
  });

  it("leaves the ward for the shopper where the map has no ward boundary", async () => {
    mockLookup({ provinceCode: "bagmati", districtCode: "kathmandu", municipalityCode: "kathmandu-metropolitan-city", ward: null, postalCode: null });
    render(<Harness />);

    openPicker();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Tap Thamel on the map", hidden: true }));
    expect(await within(dialog()).findByText(/you'll choose the ward/)).toBeInTheDocument();
    await act(async () => fireEvent.click(within(dialog()).getByRole("button", { name: "Use this location", hidden: true })));

    expect(probe.getValues!()).toMatchObject({ municipalityCode: "kathmandu-metropolitan-city", ward: "" });
    expect(screen.getByText(/Choose your ward/)).toBeInTheDocument();
  });

  it("explains a spot outside Nepal and keeps Use this location off", async () => {
    mockLookup({ error: "outside_nepal" }, 422);
    render(<Harness />);

    openPicker();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Place pin at centre", hidden: true }));
    expect(await within(dialog()).findByText(/outside Nepal/)).toBeInTheDocument();
    expect(within(dialog()).getByRole("button", { name: "Use this location", hidden: true })).toBeDisabled();
    expect(probe.getValues!().provinceCode).toBe("");
  });

  it("treats denied location access as a message, not an error", async () => {
    const getCurrentPosition = vi.fn((_success: PositionCallback, failure?: PositionErrorCallback | null) =>
      failure?.({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: "denied" } as GeolocationPositionError),
    );
    Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
    render(<Harness />);

    openPicker();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Use my current location", hidden: true }));
    expect(await within(dialog()).findByText(/Location access is off/)).toBeInTheDocument();
  });
});
