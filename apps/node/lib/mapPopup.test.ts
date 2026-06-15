import { describe, expect, it } from "vitest";
import { buildPopup, formatFactStatus } from "./mapPopup";

describe("mapPopup", () => {
  it("uses text labels instead of emoji for yes/no", () => {
    expect(formatFactStatus("yes")).toBe("Yes");
    expect(formatFactStatus("no")).toBe("No");
    const html = buildPopup({
      id: "p1",
      name: "Test Hotel",
      location: "Eindhoven",
      lat: 51.4,
      lon: 5.5,
      facts: {
        ramp_present: { value: "yes", tier: "VERIFIED" },
        step_free_entrance: { value: "no", tier: "AI_GUESS" },
      },
    });
    expect(html).toContain("Ramp:");
    expect(html).toContain("Yes</span>");
    expect(html).toContain("No</span>");
    expect(html).not.toContain("✅");
    expect(html).not.toContain("❌");
  });
});
