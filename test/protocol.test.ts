import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";

// Spawn the built server and exercise the MCP stdio protocol.
// Requires dist/index.js to exist (run `npm run build` first).
describe("MCP stdio protocol", () => {
  let child: ChildProcess;
  let pendingId = 0;

  beforeAll(async () => {
    const dist = path.resolve(process.cwd(), "dist/index.js");
    await fs.access(dist);
    child = spawn("node", [dist], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, GEMINI_API_KEY: "test-key" },
    });
  });

  afterAll(() => {
    child?.kill();
  });

  function send(method: string, params: unknown = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = ++pendingId;
      const timer = setTimeout(() => reject(new Error("timeout waiting for response")), 8000);
      const onData = (buf: Buffer) => {
        const text = buf.toString();
        for (const line of text.split("\n").filter(Boolean)) {
          const msg = JSON.parse(line);
          if (msg.id === id) {
            clearTimeout(timer);
            child.stdout.off("data", onData);
            resolve(msg);
          }
        }
      };
      child.stdout.on("data", onData);
      child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    });
  }

  it("responds to initialize", async () => {
    const res = await send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    expect(res.result.serverInfo.name).toBe("vision-mcp");
    expect(res.result.capabilities.tools).toBeDefined();
  });

  it("lists both tools", async () => {
    await send("notifications/initialized", {});
    const res = await send("tools/list");
    const names = res.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("analyze_image");
    expect(names).toContain("analyze_video");
  });

  it("errors gracefully on missing file", async () => {
    const res = await send("tools/call", {
      name: "analyze_image",
      arguments: { path: "/nonexistent/nope.png" },
    });
    expect(res.result.isError).toBe(true);
    expect(res.result.content[0].text).toMatch(/not found/i);
  });
});
