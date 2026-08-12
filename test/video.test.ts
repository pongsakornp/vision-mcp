import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { extractKeyframes, analyzeVideoFrames } from "../src/video.js";

const execFileP = promisify(execFile);
let tmpDir: string;
let videoPath: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vision-mcp-video-"));
  // Generate a 3-second test video with ffmpeg (solid color + timestamp)
  videoPath = path.join(tmpDir, "test.mp4");
  await execFileP("ffmpeg", [
    "-v", "error",
    "-f", "lavfi",
    "-i", "testsrc=duration=3:size=320x240:rate=10",
    "-f", "lavfi",
    "-i", "anullsrc=r=44100:cl=stereo",
    "-t", "3",
    "-c:v", "libx264",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-y", videoPath,
  ]);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe("extractKeyframes", () => {
  it("extracts frames with valid data URLs", async () => {
    const { dataUrls, timestamps } = await extractKeyframes(videoPath);
    expect(dataUrls.length).toBeGreaterThanOrEqual(1);
    expect(dataUrls.length).toBeLessThanOrEqual(8);
    expect(timestamps.length).toBe(dataUrls.length);
    for (const url of dataUrls) {
      expect(url.startsWith("data:image/jpeg;base64,")).toBe(true);
    }
  });
});

describe("analyzeVideoFrames", () => {
  it("builds a prompt listing timestamps", async () => {
    const { frameDataUrls, prompt } = await analyzeVideoFrames({
      filePath: videoPath,
      prompt: "Describe this video.",
    });
    expect(frameDataUrls.length).toBeGreaterThanOrEqual(1);
    expect(prompt).toContain("Extracted");
    expect(prompt).toContain("Describe this video.");
  });
});
