import { describe, expect, it } from "vitest";
import {
  canonicalizeFactValue,
  factValuesMatch,
  isAllowedRoomTypeToken,
  validateFactValue,
  type FieldDefinitionDto,
} from "./fieldRegistry";

function boolDef(fieldName = "ramp_present"): FieldDefinitionDto {
  return {
    fieldName,
    scope: "PROPERTY",
    valueType: "BOOLEAN",
    enumValues: [],
    label: fieldName,
    labels: {},
    unit: null,
    nodeId: null,
    searchFilter: true,
    custom: false,
  };
}

function roomTypesDef(): FieldDefinitionDto {
  return {
    fieldName: "room_types_available",
    scope: "PROPERTY",
    valueType: "ENUM",
    enumValues: ["single", "double", "twin", "suite", "family"],
    label: "Room types",
    labels: {},
    unit: null,
    nodeId: null,
    searchFilter: false,
    custom: false,
  };
}

describe("validateFactValue BOOLEAN", () => {
  it("accepts wizard tokens including partial and n/a", () => {
    expect(validateFactValue(boolDef(), "yes")).toBeNull();
    expect(validateFactValue(boolDef(), "no")).toBeNull();
    expect(validateFactValue(boolDef(), "partial")).toBeNull();
    expect(validateFactValue(boolDef("pool_lift"), "n/a")).toBeNull();
  });

  it("canonicalizes OSM true/false", () => {
    expect(canonicalizeFactValue(boolDef(), "true")).toEqual({ value: "yes", error: null });
    expect(canonicalizeFactValue(boolDef(), "false")).toEqual({ value: "no", error: null });
  });

  it("rejects unknown tokens", () => {
    expect(validateFactValue(boolDef(), "maybe")).toBe("Boolean fields must be yes, no, partial, or n/a");
  });
});

describe("room_types_available", () => {
  it("allows catalogue and custom slug ids", () => {
    expect(validateFactValue(roomTypesDef(), "twin")).toBeNull();
    expect(validateFactValue(roomTypesDef(), "twin,twin_room_disability_access")).toBeNull();
    expect(isAllowedRoomTypeToken("twin_room_disability_access", roomTypesDef().enumValues)).toBe(true);
  });

  it("rejects tokens that are not slugs", () => {
    expect(validateFactValue(roomTypesDef(), "Twin Room!")).toBe("Unknown room type: Twin Room!");
  });
});

describe("factValuesMatch", () => {
  it("treats true and yes as the same boolean", () => {
    expect(factValuesMatch(boolDef(), "true", "yes")).toBe(true);
    expect(factValuesMatch(boolDef(), "true", "no")).toBe(false);
  });
});
