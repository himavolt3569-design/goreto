/*
 * Nepal address hierarchy for checkout (AGENTS §4.4, §15.5): Province →
 * District → Municipality → Ward, keyed by the stable codes in the
 * nepal_* tables. Client-safe helpers; the data comes from
 * nepal-address-data.ts on the server.
 */

export type NepalProvince = { code: string; name: string };
export type NepalDistrict = { code: string; provinceCode: string; name: string };
export type NepalMunicipality = {
  code: string;
  districtCode: string;
  name: string;
  wardCount: number;
  postalCode: string | null;
};

export type NepalAddressData = {
  provinces: NepalProvince[];
  districts: NepalDistrict[];
  municipalities: NepalMunicipality[];
};

export function districtsIn(data: NepalAddressData, provinceCode: string): NepalDistrict[] {
  return data.districts.filter((district) => district.provinceCode === provinceCode);
}

export function municipalitiesIn(data: NepalAddressData, districtCode: string): NepalMunicipality[] {
  return data.municipalities.filter((municipality) => municipality.districtCode === districtCode);
}

export function findMunicipality(data: NepalAddressData, code: string): NepalMunicipality | undefined {
  return data.municipalities.find((municipality) => municipality.code === code);
}

/** "1" … "<wardCount>" as select options. */
export function wardOptions(wardCount: number): { value: string; label: string }[] {
  return Array.from({ length: Math.max(0, wardCount) }, (_, index) => {
    const ward = String(index + 1);
    return { value: ward, label: `Ward No. ${ward}` };
  });
}

/** One-line display: "Thamel, Kathmandu Metropolitan City-26, Kathmandu, Bagmati Province". */
export function formatAddressLines(address: {
  streetLandmark: string;
  municipalityName: string;
  ward: number;
  districtName: string;
  provinceName: string;
  postalCode: string | null;
}): { line1: string; line2: string; line3: string; postal: string | null } {
  return {
    line1: address.streetLandmark,
    line2: `${address.municipalityName}, Ward No. ${address.ward}`,
    line3: `${address.districtName}, ${address.provinceName}`,
    postal: address.postalCode,
  };
}
