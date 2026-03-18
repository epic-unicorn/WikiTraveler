import OpenAI from "openai";
import { VISION_SYSTEM_PROMPT } from "./prompts";
import type { AgentFact } from "./types";

/**
 * Analyse up to 3 hotel photos with GPT-4o Vision and return AI_GUESS facts.
 *
 * @param photos  Array of base64 strings or full data-URI strings (max 3).
 * @param apiKey  OpenAI API key.
 */
export async function analyzePhotos(
  photos: string[],
  apiKey: string
): Promise<AgentFact[]> {
  if (!photos.length) return [];

  const client = new OpenAI({ apiKey });

  // Normalise to data-URI format that the OpenAI vision API expects.
  const imageContent = photos.slice(0, 3).map((photo) => ({
    type: "image_url" as const,
    image_url: {
      url: photo.startsWith("data:") ? photo : `data:image/jpeg;base64,${photo}`,
      detail: "auto" as const,
    },
  }));

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    max_tokens: 1000,
    messages: [
      { role: "system", content: VISION_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyse these hotel photos and return accessibility facts you can observe.",
          },
          ...imageContent,
        ],
      },
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

  // Validate & coerce each returned item so callers get a clean array.
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
        confidence: (f.confidence as AgentFact["confidence"]) ?? "medium",
        evidence: typeof f.evidence === "string" ? f.evidence : "",
      },
    ];
  });
}
