/**
 * Image preprocessing — downscale to ≤1024px, re-encode as JPEG,
 * return a data URL suitable for vision APIs.
 */
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

export const MAX_DIMENSION = 1024;

export async function resolvePath(raw: string, cwd = process.cwd()): Promise<string> {
  let p = raw.trim().replace(/^["']|["']$/g, "");
  if (p.startsWith("~")) {
    p = path.join(process.env.HOME || "", p.slice(1));
  }
  if (!path.isAbsolute(p)) {
    p = path.resolve(cwd, p);
  }
  // Reject non-file paths defensively
  const stat = await fs.stat(p).catch(() => null);
  if (!stat || !stat.isFile()) {
    throw new Error(`File not found: ${p} (from input: ${raw})`);
  }
  return p;
}

export async function imageToDataUrl(filePath: string, maxDim = MAX_DIMENSION): Promise<string> {
  const buf = await sharp(filePath)
    .rotate() // honor EXIF orientation
    .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, progressive: true })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}

export const SUPPORTED_IMAGE_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif", ".avif", ".tiff",
]);

export const SUPPORTED_VIDEO_EXT = new Set([
  ".mp4", ".webm", ".mov", ".avi", ".mkv", ".flv", ".wmv", ".m4v",
]);
