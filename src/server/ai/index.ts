import { AnthropicReader } from "./anthropic";
import { OpenRouterReader } from "./openrouter";
import type { DocumentReader } from "./types";

let override: DocumentReader | null | undefined;

/** Tests can inject a fake reader. */
export function setReaderForTests(reader: DocumentReader | null | undefined) {
  override = reader;
}

/**
 * Picks the reader from env: AI_PROVIDER=anthropic (default) | openrouter | none.
 * Returns null when no key is configured — uploads then open an empty draft for manual entry.
 */
export function getReader(env: Record<string, string | undefined> = process.env): DocumentReader | null {
  if (override !== undefined) return override;
  const provider = (env.AI_PROVIDER ?? "anthropic").toLowerCase();
  if (provider === "none") return null;
  if (provider === "openrouter") {
    return env.OPENROUTER_API_KEY ? new OpenRouterReader(env.OPENROUTER_API_KEY, env.OPENROUTER_MODEL || undefined) : null;
  }
  return env.ANTHROPIC_API_KEY ? new AnthropicReader(env.ANTHROPIC_API_KEY, env.ANTHROPIC_MODEL || undefined) : null;
}

export function aiEnabled(): boolean {
  return getReader() !== null;
}
