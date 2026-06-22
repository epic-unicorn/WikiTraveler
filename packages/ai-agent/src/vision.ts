import { VISION_SYSTEM_PROMPT } from "./prompts";
import { createAiClient, extractJson } from "./client";
import { filterVisionFacts } from "./filterFacts";
import type { AiConfig } from "./client";
import type { AgentFact } from "./types";

/**
 * Analyse up to 3 hotel photos and return AI_GUESS accessibility facts.
 *
 * Works with any OpenAI-compatible vision model (GPT-4o, llama3.2-vision,
 * llava, moondream, etc.).
 *
 * @param photos  Array of base64 strings, data-URI strings, or HTTPS URLs (max 3).
 *   HTTPS URLs are passed directly — supported by OpenAI and most hosted providers.
 *   Local Ollama instances cannot fetch public URLs; use the base64 storage
 *   adapter (PHOTO_STORAGE_PROVIDER unset) when running AI locally.
 * @param config  AI provider configuration.
 */
export async function analyzePhotos(
  photos: string[],
  config: AiConfig
): Promise<AgentFact[]> {
  if (!photos.length) return [];

  const { client, visionModel, isLocal } = createAiClient(config);

  // Normalise photo references for the vision API:
  //   HTTPS URL  → passed as-is (OpenAI and hosted providers accept them directly)
  //   data: URI  → passed as-is
  //   plain base64 → wrapped in data:image/jpeg;base64,… for backward compat
  const imageContent = photos.slice(0, 3).map((photo) => ({
    type: "image_url" as const,
    image_url: {
      url: /^(data:|https?:\/\/)/.test(photo)
        ? photo
        : `data:image/jpeg;base64,${photo}`,
      detail: "auto" as const,
    },
  }));

  const response = await client.chat.completions.create({
    model: visionModel,
    // response_format is an OpenAI extension; local models ignore it gracefully.
    // We rely on the system prompt + extractJson() as the safety net.
    ...(!isLocal && { response_format: { type: "json_object" as const } }),
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
    parsed = JSON.parse(extractJson(raw)) as { facts?: unknown };
  } catch {
    return [];
  }

  if (!Array.isArray(parsed.facts)) return [];

  const rawFacts = parsed.facts.flatMap((item: unknown): AgentFact[] => {
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

  return filterVisionFacts(rawFacts);
}
