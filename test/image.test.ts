import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolvePath, imageToDataUrl, SUPPORTED_IMAGE_EXT } from "../src/image.js";

let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vision-mcp-test-"));
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("resolvePath", () => {
  it("rejects missing files", async () => {
    await expect(resolvePath("/nonexistent/definitely-missing.png")).rejects.toThrow(/not found/i);
  });

  it("resolves relative paths against cwd", async () => {
    const f = path.join(tmpDir, "x.png");
    await fs.writeFile(f, "dummy");
    const abs = await resolvePath("x.png", tmpDir);
    expect(abs).toBe(f);
  });

  it("expands ~", async () => {
    try {
      await resolvePath("~/definitely-missing-xyz.png");
      throw new Error("should have rejected");
    } catch (e) {
      // The path resolves to a file under home, but since it doesn't exist,
      // the not-found error should reference the expanded path.
      expect(String((e as Error).message)).toContain(os.homedir());
    }
  });
});

describe("imageToDataUrl", () => {
  it("produces a base64 jpeg data URL from a real image", async () => {
    // 1x1 red pixel PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const f = path.join(tmpDir, "pixel.png");
    await fs.writeFile(f, png);
    const url = await imageToDataUrl(f);
    expect(url.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(100);
  });
});

describe("supported extensions", () => {
  it("includes common image formats", () => {
    expect(SUPPORTED_IMAGE_EXT.has(".png")).toBe(true);
    expect(SUPPORTED_IMAGE_EXT.has(".webp")).toBe(true);
    expect(SUPPORTED_IMAGE_EXT.has(".gif")).toBe(true);
  });
});
