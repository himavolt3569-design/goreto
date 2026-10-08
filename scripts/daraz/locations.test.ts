// @vitest-environment node
import { describe, expect, it } from "vitest";
import { matchLocations, normaliseName, parseCsv, type Municipality } from "./locations.ts";

const MUNICIPALITIES: Municipality[] = [
  { code: "pokhara-metropolitan-city", name: "Pokhara Metropolitan City", districtCode: "kaski" },
  { code: "machhapuchchhre-rural-municipality", name: "Machhapuchchhre Rural Municipality", districtCode: "kaski" },
  { code: "kathmandu-metropolitan-city", name: "Kathmandu Metropolitan City", districtCode: "kathmandu" },
];

describe("parseCsv", () => {
  it("handles quotes, commas and CRLF", () => {
    expect(parseCsv('a,b\r\n"x, y","say ""hi"""\r\n\r\n')).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
    ]);
  });
});

describe("normaliseName", () => {
  it("ignores municipality kinds and punctuation", () => {
    expect(normaliseName("Pokhara Metropolitan City")).toBe("pokhara");
    expect(normaliseName("pokhara mahanagarpalika")).toBe("pokhara");
    expect(normaliseName("Machhapuchchhre RM")).toBe("machhapuchchhre");
  });
});

describe("matchLocations", () => {
  it("maps by municipality code", () => {
    const report = matchLocations("municipality_code,daraz_address_id,daraz_city\npokhara-metropolitan-city,R100,Pokhara\nnowhere,R200,X\n", MUNICIPALITIES);
    expect(report.rows).toEqual([{ municipality_code: "pokhara-metropolitan-city", daraz_address_id: "R100", daraz_city: "Pokhara" }]);
    expect(report.unmatched).toEqual([{ line: 3, text: "nowhere,R200,X", reason: "unknown municipality_code" }]);
  });

  it("maps by district and municipality names, and reports what it can't match", () => {
    const report = matchLocations(
      "District,Municipality,Daraz_Address_ID\nKaski District,Pokhara Mahanagarpalika,R100\nKathmandu,Kathmandu Metropolitan City,R300\nKaski,Unknown Town,R400\nKaski,Pokhara,bad id!\n",
      MUNICIPALITIES,
    );
    expect(report.rows.map((row) => [row.municipality_code, row.daraz_address_id])).toEqual([
      ["pokhara-metropolitan-city", "R100"],
      ["kathmandu-metropolitan-city", "R300"],
    ]);
    expect(report.unmatched.map((item) => [item.line, item.reason])).toEqual([
      [4, "no municipality with that name in that district"],
      [5, "missing or invalid daraz_address_id"],
    ]);
  });

  it("refuses a file without the needed columns", () => {
    expect(matchLocations("name,id\nx,y\n", MUNICIPALITIES).unmatched[0]!.reason).toMatch(/header needs/);
  });
});
