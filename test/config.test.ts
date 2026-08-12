import { describe, it, expect } from "vitest";
import { loadConfig, hasAnyKey, configuredBackends, DEFAULTS } from "../src/config.js";

describe("loadConfig", () => {
  it("reads keys from env", () => {
    const cfg = loadConfig({
      GEMINI_API_KEY: "g",
      XAI_API_KEY: "x",
      OPENROUTER_API_KEY: "o",
    } as NodeJS.ProcessEnv);
    expect(cfg.geminiKey).toBe("g");
    expect(cfg.grokKey).toBe("x");
    expect(cfg.openrouterKey).toBe("o");
  });

  it("uses defaults when unset", () => {
    const cfg = loadConfig({} as NodeJS.ProcessEnv);
    expect(cfg.geminiKey).toBeNull();
    expect(cfg.geminiModel).toBe(DEFAULTS.geminiModel);
    expect(cfg.timeoutMs).toBe(DEFAULTS.timeoutMs);
  });

  it("parses custom model + timeout envs", () => {
    const cfg = loadConfig({
      VISION_GEMINI_MODEL: "gemini-2.5-pro",
      VISION_TIMEOUT_MS: "5000",
    } as NodeJS.ProcessEnv);
    expect(cfg.geminiModel).toBe("gemini-2.5-pro");
    expect(cfg.timeoutMs).toBe(5000);
  });
});

describe("hasAnyKey / configuredBackends", () => {
  it("false when no keys", () => {
    const cfg = loadConfig({} as NodeJS.ProcessEnv);
    expect(hasAnyKey(cfg)).toBe(false);
    expect(configuredBackends(cfg)).toEqual([]);
  });

  it("lists only configured backends in order", () => {
    const cfg = loadConfig({
      GEMINI_API_KEY: "g",
      OPENROUTER_API_KEY: "o",
    } as NodeJS.ProcessEnv);
    expect(hasAnyKey(cfg)).toBe(true);
    expect(configuredBackends(cfg)).toEqual(["gemini", "openrouter"]);
  });
});
