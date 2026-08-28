import { describe, expect, it } from "vitest";
import { isStandardRoomType, mergeKnownCustomRoomTypes } from "./roomTypes";

describe("mergeKnownCustomRoomTypes", () => {
  it("keeps custom ids after they leave the selected list", () => {
    expect(
      mergeKnownCustomRoomTypes(
        ["twin_room_disability_access", "double"],
        ["suite"],
        ["twin_room_disability_access"]
      )
    ).toEqual(["twin_room_disability_access"]);
  });

  it("drops blanks and standard types", () => {
    expect(mergeKnownCustomRoomTypes(["", "twin", "  "], ["family"])).toEqual([]);
  });
});

describe("isStandardRoomType", () => {
  it("recognizes catalogue ids", () => {
    expect(isStandardRoomType("twin")).toBe(true);
    expect(isStandardRoomType("twin_room_disability_access")).toBe(false);
  });
});
