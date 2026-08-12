#!/usr/bin/env node
/**
 * vision-mcp — MCP server exposing analyze_image and analyze_video tools.
 *
 * Tools:
 *   analyze_image(path, prompt?)  — describe an image file
 *   analyze_video(path, prompt?)  — keyframes + describe a video file
 *
 * Backend fallback chain (first success wins, rest cancelled):
 *   Gemini → Grok (xAI) → OpenRouter
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "node:path";
import { realpathSync } from "node:fs";

import { loadConfig, hasAnyKey } from "./config.js";
import { buildBackends, analyzeWithFallback } from "./backends.js";
import { resolvePath, imageToDataUrl, SUPPORTED_IMAGE_EXT, SUPPORTED_VIDEO_EXT } from "./image.js";
import { analyzeVideoFrames } from "./video.js";

const DEFAULT_PROMPT =
  "Describe this image in detail: layout, colors, text, objects, and any UI elements. Be specific and structured.";

function checkExt(filePath: string, supported: Set<string>, kind: string): void {
  const ext = path.extname(filePath).toLowerCase();
  if (!supported.has(ext)) {
    throw new Error(
      `Unsupported ${kind} extension "${ext}". Supported: ${[...supported].join(", ")}`,
    );
  }
}

export async function analyzeImage(
  rawPath: string,
  prompt?: string,
): Promise<string> {
  const filePath = await resolvePath(rawPath);
  checkExt(filePath, SUPPORTED_IMAGE_EXT, "image");
  const dataUrl = await imageToDataUrl(filePath);
  const text = await analyzeWithFallback(buildBackends(loadConfig()), {
    imageDataUrl: dataUrl,
    prompt: prompt || DEFAULT_PROMPT,
  });
  return `${path.basename(filePath)}: ${text.text}`;
}

export async function analyzeVideo(
  rawPath: string,
  prompt?: string,
): Promise<string> {
  const filePath = await resolvePath(rawPath);
  checkExt(filePath, SUPPORTED_VIDEO_EXT, "video");
  const { frameDataUrls, prompt: framePrompt } = await analyzeVideoFrames({
    filePath,
    prompt: prompt || "Describe this video.",
  });
  const text = await analyzeWithFallback(buildBackends(loadConfig()), {
    imageDataUrl: frameDataUrls[0],
    prompt: framePrompt,
  });
  return `${path.basename(filePath)}: ${text.text}`;
}

export function createServer() {
  const server = new McpServer(
    { name: "vision-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    "analyze_image",
    {
      title: "Analyze image",
      description:
        "Analyze an image file (png, jpg, webp, bmp, gif, avif) and return a text description. Use for screenshots, diagrams, UI mockups, photos. Provide an absolute or relative path.",
      inputSchema: {
        path: z.string().describe("Path to the image file"),
        prompt: z
          .string()
          .optional()
          .describe("Optional custom prompt for the analysis"),
      },
    },
    async ({ path, prompt }) => {
      try {
        const text = await analyzeImage(path, prompt);
        return { content: [{ type: "text" as const, text }] };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "analyze_video",
    {
      title: "Analyze video",
      description:
        "Analyze a video file (mp4, webm, mov, avi, mkv) by extracting keyframes and describing the content. Requires ffmpeg installed.",
      inputSchema: {
        path: z.string().describe("Path to the video file"),
        prompt: z
          .string()
          .optional()
          .describe("Optional custom prompt for the analysis"),
      },
    },
    async ({ path, prompt }) => {
      try {
        const text = await analyzeVideo(path, prompt);
        return { content: [{ type: "text" as const, text }] };
      } catch (e) {
        return {
          content: [{ type: "text" as const, text: `Error: ${(e as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  return server;
}

export async function main(): Promise<void> {
  const config = loadConfig();
  if (!hasAnyKey(config)) {
    process.stderr.write(
      "vision-mcp: no API keys found. Set GEMINI_API_KEY, XAI_API_KEY, or OPENROUTER_API_KEY.\n",
    );
  } else {
    process.stderr.write(
      `vision-mcp: backends ready — ${["gemini", "grok", "openrouter"]
        .filter((b) => (config as unknown as Record<string, string | null>)[`${b}Key`])
        .join(", ")}\n`,
    );
  }
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function isEntrypoint(): boolean {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === `file://${realpathSync(process.argv[1])}`;
  } catch {
    return import.meta.url === `file://${process.argv[1]}`;
  }
}

if (isEntrypoint()) {
  main().catch((e) => {
    process.stderr.write(`vision-mcp fatal: ${e}\n`);
    process.exit(1);
  });
}
