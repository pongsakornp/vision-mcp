/**
 * Video preprocessing — extract up to 8 evenly-spaced keyframes via ffmpeg,
 * then compress each with sharp. Returns a list of data URLs + a plain-text
 * frame index for the prompt context.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { imageToDataUrl } from "./image.js";

const execFileP = promisify(execFile);
const MAX_KEYFRAMES = 8;

export interface VideoAnalysisInput {
  filePath: string;
  prompt: string;
}

async function getDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileP("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return parseFloat(stdout.trim()) || 0;
}

export async function extractKeyframes(filePath: string): Promise<{ dataUrls: string[]; timestamps: number[] }> {
  const duration = await getDuration(filePath);
  if (duration <= 0) {
    throw new Error(`Could not determine video duration: ${filePath}`);
  }
  const count = Math.min(MAX_KEYFRAMES, Math.max(1, Math.floor(duration / 1.5)));
  const timestamps: number[] = [];
  for (let i = 0; i < count; i++) {
    timestamps.push(Math.round((duration * (i + 0.5)) / count * 100) / 100);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "vision-mcp-"));
  const dataUrls: string[] = [];
  try {
    for (let i = 0; i < timestamps.length; i++) {
      const out = path.join(tmpDir, `frame_${i}.jpg`);
      await execFileP("ffmpeg", [
        "-v", "error",
        "-ss", String(timestamps[i]),
        "-i", filePath,
        "-vframes", "1",
        "-q:v", "2",
        "-y", out,
      ]);
      dataUrls.push(await imageToDataUrl(out));
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
  return { dataUrls, timestamps };
}

export async function analyzeVideoFrames(input: VideoAnalysisInput): Promise<{
  frameDataUrls: string[];
  prompt: string;
}> {
  const { dataUrls, timestamps } = await extractKeyframes(input.filePath);
  const t = timestamps.map((s) => `${s}s`).join(", ");
  const prompt = `${input.prompt}\n\n[Extracted ${dataUrls.length} keyframes at: ${t}. Describe what happens across these frames — actions, scene changes, UI flow, and any on-screen text.]`;
  return { frameDataUrls: dataUrls, prompt };
}
