/**
 * Vision backend clients — Gemini, Grok (xAI), OpenRouter.
 * All speak OpenAI-compatible chat-completions (Gemini also supports it
 * via its v1beta openai-compat endpoint) with image_url content parts.
 */
import { VisionConfig } from "./config.js";

export interface VisionResult {
  provider: string;
  model: string;
  text: string;
}

export interface AnalyzeRequest {
  imageDataUrl: string;
  prompt: string;
}

async function chatCompletion(
  url: string,
  apiKey: string,
  model: string,
  req: AnalyzeRequest,
  timeoutMs: number,
): Promise<{ provider: string; model: string; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: req.prompt },
              {
                type: "image_url",
                image_url: { url: req.imageDataUrl },
              },
            ],
          },
        ],
        max_tokens: 2048,
      }),
      signal: controller.signal,
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      throw new Error(`${resp.status} ${resp.statusText}: ${body.slice(0, 300)}`);
    }
    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (data.error?.message) throw new Error(data.error.message);
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty response from model");
    return { provider: "gemini", model, text };
  } finally {
    clearTimeout(timer);
  }
}

export function geminiBackend(config: VisionConfig) {
  return async (req: AnalyzeRequest): Promise<VisionResult> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
    const res = await chatCompletion(url, config.geminiKey!, config.geminiModel, req, config.timeoutMs);
    return { ...res, provider: "gemini" };
  };
}

export function grokBackend(config: VisionConfig) {
  return async (req: AnalyzeRequest): Promise<VisionResult> => {
    const url = `https://api.x.ai/v1/chat/completions`;
    const res = await chatCompletion(url, config.grokKey!, config.grokModel, req, config.timeoutMs);
    return { ...res, provider: "grok" };
  };
}

export function openrouterBackend(config: VisionConfig) {
  return async (req: AnalyzeRequest): Promise<VisionResult> => {
    const url = `https://openrouter.ai/api/v1/chat/completions`;
    const res = await chatCompletion(url, config.openrouterKey!, config.openrouterModel, req, config.timeoutMs);
    return { ...res, provider: "openrouter" };
  };
}

export type VisionBackend = (req: AnalyzeRequest) => Promise<VisionResult>;

/**
 * Build the ordered backend list from config (only configured keys).
 * Order: Gemini → Grok → OpenRouter.
 */
export function buildBackends(config: VisionConfig): VisionBackend[] {
  const out: VisionBackend[] = [];
  if (config.geminiKey) out.push(geminiBackend(config));
  if (config.grokKey) out.push(grokBackend(config));
  if (config.openrouterKey) out.push(openrouterBackend(config));
  return out;
}

/**
 * Run all backends in parallel; first success wins, remaining cancelled.
 * If all fail, return the first error for context.
 */
export async function analyzeWithFallback(
  backends: VisionBackend[],
  req: AnalyzeRequest,
): Promise<VisionResult> {
  if (backends.length === 0) {
    throw new Error(
      "No vision backend configured. Set GEMINI_API_KEY, XAI_API_KEY, or OPENROUTER_API_KEY.",
    );
  }
  const results = await Promise.allSettled(backends.map((b) => b(req)));
  for (const r of results) {
    if (r.status === "fulfilled") return r.value;
  }
  const errors = results
    .map((r) => (r.status === "rejected" ? String(r.reason) : ""))
    .filter(Boolean);
  throw new Error(`All vision backends failed: ${errors.join(" | ")}`);
}
