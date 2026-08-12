import { describe, it, expect } from "vitest";
import {
  buildBackends,
  analyzeWithFallback,
  type VisionBackend,
  type AnalyzeRequest,
} from "../src/backends.js";
import { loadConfig } from "../src/config.js";

const req: AnalyzeRequest = { imageDataUrl: "data:image/jpeg;base64,AAA", prompt: "what is this" };

function backendThat(behavior: "ok" | "fail", text = "seen"): VisionBackend {
  return async () => {
    if (behavior === "fail") throw new Error("provider down");
    return { provider: "test", model: "m", text };
  };
}

describe("buildBackends", () => {
  it("returns empty when no keys", () => {
    expect(buildBackends(loadConfig({} as NodeJS.ProcessEnv))).toEqual([]);
  });

  it("builds one backend per configured key in order", () => {
    const cfg = loadConfig({
      GEMINI_API_KEY: "g",
      OPENROUTER_API_KEY: "o",
      XAI_API_KEY: "x",
    } as NodeJS.ProcessEnv);
    const b = buildBackends(cfg);
    expect(b.length).toBe(3);
  });
});

describe("analyzeWithFallback", () => {
  it("throws a helpful error with zero backends", async () => {
    await expect(analyzeWithFallback([], req)).rejects.toThrow(/No vision backend configured/);
  });

  it("returns first success when multiple succeed", async () => {
    const b: VisionBackend[] = [
      backendThat("ok", "from-first"),
      backendThat("ok", "from-second"),
    ];
    const r = await analyzeWithFallback(b, req);
    expect(r.text).toBe("from-first");
  });

  it("falls through when earlier backend fails", async () => {
    const b: VisionBackend[] = [
      backendThat("fail"),
      backendThat("ok", "from-second"),
    ];
    const r = await analyzeWithFallback(b, req);
    expect(r.text).toBe("from-second");
  });

  it("reports all errors when everything fails", async () => {
    const b: VisionBackend[] = [backendThat("fail"), backendThat("fail")];
    await expect(analyzeWithFallback(b, req)).rejects.toThrow(/All vision backends failed/);
  });
});
