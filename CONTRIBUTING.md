# Contributing

Thanks for helping improve vision-mcp.

## Development setup

```bash
git clone https://github.com/pongsakornp/vision-mcp.git
cd vision-mcp
npm install
npm run build
npm test
```

## Before submitting

1. `npm run build` — must compile clean
2. `npm test` — all tests must pass
3. `npm run typecheck` — no type errors

## Project layout

```
src/
  config.ts     — env parsing, defaults
  backends.ts   — Gemini/Grok/OpenRouter clients + fallback chain
  image.ts      — path resolution, sharp preprocessing
  video.ts      — ffmpeg keyframe extraction
  index.ts      — MCP server, tools, entrypoint
test/
  config.test.ts    — config parsing
  backends.test.ts  — fallback logic
  image.test.ts     — sharp + paths
  video.test.ts     — ffmpeg keyframes
  protocol.test.ts  — MCP stdio end-to-end
```

## Conventions

- TypeScript, strict mode, NodeNext modules
- No runtime config files — environment variables only
- New backends: implement `VisionBackend` in `backends.ts`, add to `buildBackends` order, add a test
- Keep the fallback-first-wins semantics: all backends parallel, first success returns

## Reporting issues

Include: Node version, MCP client, backend used, and the tool's error text (not just "it didn't work").
