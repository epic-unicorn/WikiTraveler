import OpenAI from "openai";
import { GAPFILL_SYSTEM_PROMPT } from "./prompts";
import type { AgentFact } from "./types";

/**
 * Use GPT-4o to estimate accessibility facts for fields not yet covered by
 * any existing data, using just the property name and location.
 *
 * @param propertyName       Human-readable hotel name.
 * @param location           City / address string.
 * @param existingFieldNames Fields that already have OFFICIAL or better data
 *                           — the model is instructed to skip these entirely.
 * @param apiKey             OpenAI API key.
 */
export async function gapFill(
  propertyName: string,
  location: string,
  existingFieldNames: string[],
  apiKey: string
): Promise<AgentFact[]> {
  const client = new OpenAI({ apiKey });

  const userMessage = [
    `Hotel: ${propertyName}`,
    `Location: ${location}`,
    existingFieldNames.length
      ? `Existing fields — DO NOT re-estimate these: ${existingFieldNames.join(", ")}`
      : "No existing accessibility data is available.",
  ].join("\n");

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    max_tokens: 800,
    messages: [
      { role: "system", content: GAPFILL_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";

  let parsed: { facts?: unknown };
  try {
    parsed = JSON.parse(raw) as { facts?: unknown };
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.facts)) return [];

  return parsed.facts.flatMap((item: unknown): AgentFact[] => {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).fieldName !== "string" ||
      typeof (item as Record<string, unknown>).value !== "string"
    ) {
      return [];
    }
    const f = item as Record<string, unknown>;
    return [
      {
        fieldName: f.fieldName as string,
        value: f.value as string,
        // Gap-fill is always low confidence
        confidence: "low" as const,
        evidence: typeof f.evidence === "string" ? f.evidence : "",
      },
    ];
  });
}
