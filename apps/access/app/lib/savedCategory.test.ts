import { describe, expect, it } from "vitest";
import { inferSavedCategory } from "./savedCategory";

describe("inferSavedCategory", () => {
  it("classifies hotels by name", () => {
    expect(inferSavedCategory("Holiday Inn Eindhoven")).toBe("hotel");
    expect(inferSavedCategory("NH Hotel")).toBe("hotel");
  });

  it("classifies restaurants and venues as other", () => {
    expect(inferSavedCategory("Restaurant De Dijk")).toBe("other");
    expect(inferSavedCategory("Van Abbe Museum")).toBe("other");
  });

  it("defaults accommodations to stay", () => {
    expect(inferSavedCategory("The Match")).toBe("stay");
    expect(inferSavedCategory("City Apartments")).toBe("stay");
  });
});
