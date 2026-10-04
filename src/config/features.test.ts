import { describe, expect, it } from "vitest";
import { showUnfinishedFeatures } from "./features";
import { siteConfig, visibleLinks } from "./site";

const allOn = { arTryOn: true, offers: true, infoPages: true };
const allOff = { arTryOn: false, offers: false, infoPages: false };

describe("showUnfinishedFeatures", () => {
  it("shows unfinished features in next dev and Vercel previews", () => {
    expect(showUnfinishedFeatures({ nodeEnv: "development" })).toBe(true);
    expect(showUnfinishedFeatures({ nodeEnv: "production", vercelEnv: "preview" })).toBe(true);
  });

  it("hides them in every production build, even with no Vercel variable", () => {
    expect(showUnfinishedFeatures({ nodeEnv: "production", vercelEnv: "production" })).toBe(false);
    expect(showUnfinishedFeatures({ nodeEnv: "production" })).toBe(false);
    expect(showUnfinishedFeatures({})).toBe(false);
  });
});

describe("visibleLinks", () => {
  it("drops links to unfinished pages when their feature is off", () => {
    expect(visibleLinks(siteConfig.mainNav, allOff).map((link) => link.href)).toEqual(["/categories", "/search?sort=newest", "/collections"]);
    expect(visibleLinks(siteConfig.footerNav, allOff).map((link) => link.href)).toEqual(["/search", "/categories"]);
    expect(visibleLinks(siteConfig.legalNav, allOff)).toEqual([]);
  });

  it("keeps every link when the features are on", () => {
    expect(visibleLinks(siteConfig.mainNav, allOn)).toHaveLength(siteConfig.mainNav.length);
    expect(visibleLinks(siteConfig.footerNav, allOn)).toHaveLength(siteConfig.footerNav.length);
    expect(visibleLinks(siteConfig.legalNav, allOn)).toHaveLength(siteConfig.legalNav.length);
  });

  it("controls only one feature at a time", () => {
    const hrefs = visibleLinks(siteConfig.mainNav, { ...allOff, offers: true }).map((link) => link.href);
    expect(hrefs).toContain("/offers");
    expect(hrefs).not.toContain("/try-on");
  });
});
