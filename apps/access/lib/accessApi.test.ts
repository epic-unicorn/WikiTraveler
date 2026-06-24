import { describe, expect, it } from "vitest";
import { buildSearchParams } from "../app/lib/accessApi";
import { EMPTY_FILTERS } from "@wikitraveler/ui";

describe("buildSearchParams", () => {
  it("includes trimmed query", () => {
    const params = buildSearchParams("  hotel  ", EMPTY_FILTERS);
    expect(params.get("q")).toBe("hotel");
  });

  it("serializes feature and audited filters", () => {
    const params = buildSearchParams("", {
      ...EMPTY_FILTERS,
      features: ["step_free", "elevator"],
      audited: true,
      location: " Amsterdam ",
    });
    expect(params.get("feature")).toBe("step_free,elevator");
    expect(params.get("audited")).toBe("true");
    expect(params.get("location")).toBe("Amsterdam");
  });
});
