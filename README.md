# vision-mcp

MCP server that gives **text-only AI coding agents** the ability to understand images and videos. Works with OpenCode, Claude Desktop, Claude Code, Cursor, VS Code, and any MCP-compatible client — including agents running on models without native vision.

```
agent (text-only) → vision-mcp → Gemini / Grok / OpenRouter → text description
```

## Why

Most coding agents run on strong text models (DeepSeek, Claude, etc.) that can't see images. When you paste a screenshot, a UI mockup, or an error screenshot, they say *"I can't view images"*. vision-mcp fixes that: it takes the file, sends it to a vision-capable model, and returns a plain-text description the agent can reason over.

## Features

- **2 tools**: `analyze_image` and `analyze_video`
- **3 backends, automatic fallback**: Gemini → Grok (xAI) → OpenRouter — first success wins, rest cancelled
- **Zero config file**: keys come from environment variables only
- **Image preprocessing**: auto-rotate (EXIF), downscale to ≤1024px, JPEG re-encode — small payloads, fast responses
- **Video support**: ffmpeg keyframe extraction (up to 8 frames) with timestamps
- **Typed & tested**: TypeScript, 21 unit/integration tests, MCP protocol verified over real stdio
- **No Python**: pure Node.js (sharp for images, ffmpeg binary for video)

## Requirements

- Node.js ≥ 18
- ffmpeg (for video analysis only; images work without it)
- At least **one** of these API keys:

| Backend | Env var | Get it |
|---|---|---|
| Gemini (default) | `GEMINI_API_KEY` | https://aistudio.google.com/app/apikey |
| Grok (xAI) | `XAI_API_KEY` | https://console.x.ai |
| OpenRouter | `OPENROUTER_API_KEY` | https://openrouter.ai/keys |

## Install

### npx from GitHub (recommended — no npm publish needed)

```bash
# Run directly (no install)
npx -y github:pongsakornp/vision-mcp
```

> npx clones the repo, installs deps, auto-builds via the `prepare` script, and runs the server over stdio.

### From source

```bash
git clone https://github.com/pongsakornp/vision-mcp.git
cd vision-mcp
npm install
npm run build
```

## Usage

### MCP client config

**OpenCode** (`opencode.jsonc`):

```jsonc
{
  "mcp": {
    "vision-mcp": {
      "type": "local",
      "command": ["npx", "-y", "github:pongsakornp/vision-mcp"],
      "environment": {
        "GEMINI_API_KEY": "AIza...",
        "XAI_API_KEY": "xai-...",
        "OPENROUTER_API_KEY": "sk-or-..."
      },
      "enabled": true
    }
  }
}
```

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "vision-mcp": {
      "command": "npx",
      "args": ["-y", "github:pongsakornp/vision-mcp"],
      "env": {
        "GEMINI_API_KEY": "AIza..."
      }
    }
  }
}
```

**VS Code / Cursor** (`.vscode/mcp.json` or workspace):

```json
{
  "servers": {
    "vision-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "github:pongsakornp/vision-mcp"],
      "environment": {
        "GEMINI_API_KEY": "AIza..."
      }
    }
  }
}
```

> Keys live in the MCP config — no shell profile edits needed. Keep the config out of git if it contains keys.

### CLI (for scripting / debugging)

```bash
# Spawn the server and talk JSON-RPC over stdio
GEMINI_API_KEY=AIza... node dist/index.js
```

## Tools

### `analyze_image(path, prompt?)`

Analyze an image file (png, jpg, jpeg, webp, bmp, gif, avif, tiff). Path can be absolute, relative, or `~/...`.

### `analyze_video(path, prompt?)`

Analyze a video (mp4, webm, mov, avi, mkv, flv, wmv, m4v). Extracts up to 8 evenly-spaced keyframes with ffmpeg, then describes the sequence.

## Configuration

| Env var | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | — | Gemini API key (tried first) |
| `XAI_API_KEY` | — | Grok/xAI API key (tried second) |
| `OPENROUTER_API_KEY` | — | OpenRouter key (tried last) |
| `VISION_GEMINI_MODEL` | `gemini-flash-latest` | Gemini model override |
| `VISION_GROK_MODEL` | `grok-4-vision` | Grok model override |
| `VISION_OPENROUTER_MODEL` | `google/gemini-flash-latest` | OpenRouter model override |
| `VISION_TIMEOUT_MS` | `20000` | Per-backend request timeout |

## Backend behavior

- Only backends with keys configured are launched.
- All configured backends run **in parallel**; the first success wins and the rest are cancelled.
- If all fail, the error reports every backend's failure for diagnosis.

## Development

```bash
npm run build        # compile TypeScript → dist/
npm test             # run the 21 tests (vitest)
npm run typecheck    # tsc --noEmit
```

Test coverage: config parsing, backend fallback logic, path resolution, image preprocessing (sharp), video keyframe extraction (real ffmpeg), and the full MCP stdio protocol.

## License

MIT — see [LICENSE](LICENSE).
