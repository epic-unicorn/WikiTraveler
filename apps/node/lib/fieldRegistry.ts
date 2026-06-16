import { prisma } from "@/lib/prisma";
import { NODE_ID } from "@/lib/nodeInfo";
import { getFieldLabel, DEFAULT_LOCALE } from "@wikitraveler/i18n";
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

export function validateFactValue(
  def: FieldDefinitionDto,
  value: string
): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Value is required";

  switch (def.valueType) {
    case "BOOLEAN":
      if (trimmed !== "yes" && trimmed !== "no") return "Boolean fields must be yes or no";
      return null;
    case "NUMBER":
      if (Number.isNaN(Number(trimmed))) return "Must be a number";
      return null;
    case "TIME":
      if (!/^\d{2}:\d{2}$/.test(trimmed)) return "Time must be HH:MM";
      return null;
    case "ENUM":
      if (def.fieldName === "room_types_available") {
        const parts = trimmed.split(",").map((p) => p.trim()).filter(Boolean);
        if (parts.length === 0) return "Select at least one room type";
        for (const part of parts) {
          if (def.enumValues.length > 0 && !def.enumValues.includes(part)) {
            return `Unknown room type: ${part}`;
          }
        }
        return null;
      }
      if (def.enumValues.length > 0 && !def.enumValues.includes(trimmed)) {
        return `Value must be one of: ${def.enumValues.join(", ")}`;
      }
      return null;
    default:
      return null;
  }
}

export async function validateAuditFacts(
  facts: Array<{ fieldName: string; value: string; scopeKey?: string }>,
  locale = DEFAULT_LOCALE
): Promise<{ ok: true } | { ok: false; message: string }> {
  const registry = await getFieldRegistryMap(locale);

  for (const fact of facts) {
    const def = registry.get(fact.fieldName);
    if (!def) {
      if (fact.fieldName.startsWith(`custom:${NODE_ID}:`)) continue;
      return { ok: false, message: `Unknown field: ${fact.fieldName}` };
    }

    const scopeKey = fact.scopeKey ?? "property";
    if (def.scope === "ROOM" && scopeKey === "property") {
      return { ok: false, message: `${fact.fieldName} requires a room scopeKey` };
    }
    if (def.scope === "PROPERTY" && scopeKey !== "property") {
      return { ok: false, message: `${fact.fieldName} is a property-level field` };
    }

    const err = validateFactValue(def, fact.value);
    if (err) return { ok: false, message: `${fact.fieldName}: ${err}` };
  }

  return { ok: true };
}

export async function getSearchFilterFields(locale = DEFAULT_LOCALE): Promise<Array<{ key: string; label: string }>> {
  const defs = await listFieldDefinitions(locale);
  return defs
    .filter((d) => d.searchFilter && d.valueType === "BOOLEAN")
    .map((d) => ({ key: d.fieldName, label: d.label }));
}
