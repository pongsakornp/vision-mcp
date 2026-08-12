/**
 * Configuration & environment handling.
 * Keys are read from env vars; no config file required.
 */

export interface BackendConfig {
  /** Base64 data URL of the image to analyze (or null for text-only). */
  imageDataUrl: string | null;
  /** The user prompt (or default). */
  prompt: string;
}

export interface VisionConfig {
  geminiKey: string | null;
  grokKey: string | null;
  openrouterKey: string | null;
  /** Optional override for the model name used by a specific provider. */
  geminiModel: string;
  grokModel: string;
  openrouterModel: string;
  /** Per-request timeout in ms. */
  timeoutMs: number;
}

export const DEFAULTS = {
  geminiModel: "gemini-flash-latest",
  grokModel: "grok-4.5",
  openrouterModel: "google/gemini-2.5-flash",
  timeoutMs: 20000,
} as const;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): VisionConfig {
  return {
    geminiKey: env.GEMINI_API_KEY || null,
    grokKey: env.XAI_API_KEY || null,
    openrouterKey: env.OPENROUTER_API_KEY || null,
    geminiModel: env.VISION_GEMINI_MODEL || DEFAULTS.geminiModel,
    grokModel: env.VISION_GROK_MODEL || DEFAULTS.grokModel,
    openrouterModel: env.VISION_OPENROUTER_MODEL || DEFAULTS.openrouterModel,
    timeoutMs: Number(env.VISION_TIMEOUT_MS || DEFAULTS.timeoutMs),
  };
}

export function hasAnyKey(config: VisionConfig): boolean {
  return Boolean(config.geminiKey || config.grokKey || config.openrouterKey);
}

export function configuredBackends(config: VisionConfig): string[] {
  const out: string[] = [];
  if (config.geminiKey) out.push("gemini");
  if (config.grokKey) out.push("grok");
  if (config.openrouterKey) out.push("openrouter");
  return out;
}
