import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import { getFieldLabel, DEFAULT_LOCALE } from "@wikitraveler/i18n";
import { normalizeBooleanValue } from "@wikitraveler/core";
import type { FieldScope, ValueType } from "@prisma/client";

export interface FieldDefinitionDto {
  fieldName: string;
  scope: FieldScope;
  valueType: ValueType;
  enumValues: string[];
  label: string;
  labels: Record<string, string>;
  unit: string | null;
  nodeId: string | null;
  searchFilter: boolean;
  custom: boolean;
}

/** Custom room types are slugified labels (e.g. twin_room_disability_access). */
const CUSTOM_ROOM_TYPE_ID = /^[a-z][a-z0-9_]{0,47}$/;

export function isAllowedRoomTypeToken(token: string, enumValues: string[]): boolean {
  if (enumValues.includes(token)) return true;
  return CUSTOM_ROOM_TYPE_ID.test(token);
}

export function canonicalizeFactValue(
  def: FieldDefinitionDto,
  value: string
): { value: string; error: string | null } {
  const trimmed = value.trim();
  if (!trimmed) return { value: trimmed, error: "Value is required" };

  switch (def.valueType) {
    case "BOOLEAN": {
      const canonical = normalizeBooleanValue(trimmed);
      if (!canonical) {
        return { value: trimmed, error: "Boolean fields must be yes, no, partial, or n/a" };
      }
      return { value: canonical, error: null };
    }
    case "NUMBER":
      if (Number.isNaN(Number(trimmed))) return { value: trimmed, error: "Must be a number" };
      return { value: trimmed, error: null };
    case "TIME":
      if (!/^\d{2}:\d{2}$/.test(trimmed)) return { value: trimmed, error: "Time must be HH:MM" };
      return { value: trimmed, error: null };
    case "ENUM":
      if (def.fieldName === "room_types_available") {
        const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
        if (parts.length === 0) return { value: trimmed, error: "Select at least one room type" };
        for (const part of parts) {
          if (!isAllowedRoomTypeToken(part, def.enumValues)) {
            return { value: trimmed, error: `Unknown room type: ${part}` };
          }
        }
        return { value: parts.join(","), error: null };
      }
      if (def.enumValues.length > 0 && !def.enumValues.includes(trimmed)) {
        return { value: trimmed, error: `Value must be one of: ${def.enumValues.join(", ")}` };
      }
      return { value: trimmed, error: null };
    default:
      return { value: trimmed, error: null };
  }
}

export function validateFactValue(
  def: FieldDefinitionDto,
  value: string
): string | null {
  return canonicalizeFactValue(def, value).error;
}

export function factValuesMatch(
  def: FieldDefinitionDto | undefined,
  a: string,
  b: string
): boolean {
  if (def?.valueType === "BOOLEAN") {
    const left = normalizeBooleanValue(a);
    const right = normalizeBooleanValue(b);
    return left != null && left === right;
  }
  return a.trim() === b.trim();
}

export async function listFieldDefinitions(locale = DEFAULT_LOCALE): Promise<FieldDefinitionDto[]> {
  const rows = await prisma.fieldDefinition.findMany({
    where: { active: true },
    orderBy: [{ scope: "asc" }, { fieldName: "asc" }],
  });

  return rows.map((row) => {
    const labels = row.labels as Record<string, string>;
    return {
      fieldName: row.fieldName,
      scope: row.scope,
      valueType: row.valueType,
      enumValues: row.enumValues,
      label: labels[locale] ?? getFieldLabel(row.fieldName, locale),
      labels,
      unit: row.unit,
      nodeId: row.nodeId,
      searchFilter: row.searchFilter,
      custom: row.nodeId != null,
    };
  });
}

export async function getFieldRegistryMap(locale = DEFAULT_LOCALE): Promise<Map<string, FieldDefinitionDto>> {
  const defs = await listFieldDefinitions(locale);
  return new Map(defs.map((d) => [d.fieldName, d]));
}

export type AuditFactInput = {
  fieldName: string;
  value: string;
  scopeKey?: string;
  confirm?: boolean;
};

export async function validateAuditFacts(
  facts: AuditFactInput[],
  locale = DEFAULT_LOCALE
): Promise<{ ok: true; facts: AuditFactInput[] } | { ok: false; message: string }> {
  const registry = await getFieldRegistryMap(locale);
  const normalized: AuditFactInput[] = [];

  for (const fact of facts) {
    const def = registry.get(fact.fieldName);
    if (!def) {
      if (fact.fieldName.startsWith(`custom:${NODE_ID}:`)) {
        normalized.push({ ...fact, value: fact.value.trim() });
        continue;
      }
      return { ok: false, message: `Unknown field: ${fact.fieldName}` };
    }

    const scopeKey = fact.scopeKey ?? "property";
    if (def.scope === "ROOM" && scopeKey === "property") {
      return { ok: false, message: `${fact.fieldName} requires a room scopeKey` };
    }
    if (def.scope === "PROPERTY" && scopeKey !== "property") {
      return { ok: false, message: `${fact.fieldName} is a property-level field` };
    }

    const result = canonicalizeFactValue(def, fact.value);
    if (result.error) return { ok: false, message: `${fact.fieldName}: ${result.error}` };
    normalized.push({ ...fact, value: result.value, scopeKey });
  }

  return { ok: true, facts: normalized };
}

export async function getSearchFilterFields(locale = DEFAULT_LOCALE): Promise<Array<{ key: string; label: string }>> {
  const defs = await listFieldDefinitions(locale);
  return defs
    .filter((d) => d.searchFilter && d.valueType === "BOOLEAN")
    .map((d) => ({ key: d.fieldName, label: d.label }));
}
