import { describe, expect, it } from "vitest";
import { districtsIn, findMunicipality, municipalitiesIn, wardOptions, type NepalAddressData } from "./nepal-address";

const data: NepalAddressData = {
  provinces: [
    { code: "bagmati", name: "Bagmati Province" },
    { code: "gandaki", name: "Gandaki Province" },
  ],
  districts: [
    { code: "kathmandu", provinceCode: "bagmati", name: "Kathmandu" },
    { code: "lalitpur", provinceCode: "bagmati", name: "Lalitpur" },
    { code: "kaski", provinceCode: "gandaki", name: "Kaski" },
  ],
  municipalities: [
    { code: "kathmandu-metro", districtCode: "kathmandu", name: "Kathmandu Metropolitan City", wardCount: 32, postalCode: "44600" },
    { code: "pokhara-metro", districtCode: "kaski", name: "Pokhara Metropolitan City", wardCount: 33, postalCode: "33700" },
  ],
};

describe("Nepal address cascade", () => {
  it("narrows districts by province and municipalities by district", () => {
    expect(districtsIn(data, "bagmati").map((district) => district.code)).toEqual(["kathmandu", "lalitpur"]);
    expect(municipalitiesIn(data, "kaski").map((municipality) => municipality.code)).toEqual(["pokhara-metro"]);
    expect(municipalitiesIn(data, "lalitpur")).toEqual([]);
    expect(findMunicipality(data, "kathmandu-metro")?.wardCount).toBe(32);
  });

  it("offers every ward of a municipality", () => {
    const wards = wardOptions(3);
    expect(wards).toEqual([
      { value: "1", label: "Ward No. 1" },
      { value: "2", label: "Ward No. 2" },
      { value: "3", label: "Ward No. 3" },
    ]);
    expect(wardOptions(0)).toEqual([]);
  });
});
