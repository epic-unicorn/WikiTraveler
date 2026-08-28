import { describe, expect, it } from "vitest";
import {
  buildAccessReturnUrl,
  filtersFromSearchParams,
  parseAccessTab,
  parseDiscoveryView,
} from "./navigationReturn";

describe("navigationReturn", () => {
  it("parses valid tabs and defaults unknown values to search", () => {
    expect(parseAccessTab("saved")).toBe("saved");
    expect(parseAccessTab("profile")).toBe("profile");
    expect(parseAccessTab("contribute")).toBe("contribute");
    expect(parseAccessTab("invalid")).toBe("search");
    expect(parseAccessTab(null)).toBe("search");
  });

  it("maps legacy tab ids onto the redesign IA", () => {
    expect(parseAccessTab("nearby")).toBe("search");
    expect(parseAccessTab("settings")).toBe("profile");
    expect(parseAccessTab("contribute")).toBe("contribute");
  });

  it("parses discovery view mode", () => {
    expect(parseDiscoveryView("map")).toBe("map");
    expect(parseDiscoveryView("list")).toBe("list");
    expect(parseDiscoveryView("both")).toBeNull();
  });

  it("builds filters from URL search params including empty location", () => {
    const params = new URLSearchParams("features=step_free,elevator&audited=1&room=1");
    expect(filtersFromSearchParams(params)).toEqual({
      features: ["step_free", "elevator"],
      audited: true,
      hasAccessibleRoom: true,
      location: "",
    });
  });

  it("builds a return URL that restores discovery state", () => {
    const url = buildAccessReturnUrl({
      tab: "search",
      q: "hotel",
      view: "list",
      filters: {
        features: ["elevator"],
        audited: true,
        hasAccessibleRoom: null,
      },
    });
    expect(url).toBe("/?q=hotel&view=list&audited=1&features=elevator");
  });

  it("includes tab=saved in the return URL", () => {
    expect(buildAccessReturnUrl({ tab: "saved" })).toBe("/?tab=saved");
  });
});
