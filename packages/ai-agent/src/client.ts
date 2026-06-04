import OpenAI from "openai";

/**
 * AI provider configuration.
 *
 * Works with any OpenAI-compatible endpoint:
 *   - OpenAI (default)
 *   - Ollama:   baseURL = "http://localhost:11434/v1", apiKey = "ollama"
 *   - LM Studio: baseURL = "http://localhost:1234/v1", apiKey = "lm-studio"
 *   - Llamafile: baseURL = "http://localhost:8080/v1",  apiKey = "llamafile"
 */
export interface AiConfig {
  /** Base URL of the OpenAI-compatible API. Defaults to the official OpenAI endpoint. */
  baseURL?: string;
  /** API key. Use any non-empty string for local providers. */
  apiKey: string;
  /** Model used for vision (photo) analysis. Default: "gpt-4o". */
  visionModel?: string;
  /** Model used for text-only gap-fill. Default: "gpt-4o". */
  textModel?: string;
}

export interface ResolvedAiClient {
  client: OpenAI;
  visionModel: string;
  textModel: string;
  /** True when talking to a local provider (non-OpenAI baseURL). */
  isLocal: boolean;
}

export function createAiClient(config: AiConfig): ResolvedAiClient {
  const isLocal = !!config.baseURL;
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  return {
    client,
    visionModel: config.visionModel ?? "gpt-4o",
    textModel: config.textModel ?? "gpt-4o",
    isLocal,
  };
}

/**
 * Extract JSON from a model response, tolerating markdown fences that some
 * local models emit despite being asked not to.
 */
export function extractJson(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end !== -1) return raw.slice(start, end + 1);
  return raw;
}
