# Kling AI for Cursor

Kling AI for Cursor creates and queries image, video, and motion tasks through
the OAuth-protected Global Kling MCP. This repository contains one Cursor
plugin for the international service; it does not include a regional variant or
a local MCP server.

Version: **1.4.0**

## Capabilities

- Text-to-image, image-to-image, posters, product visuals, portraits, and covers
- V4 video recommendations, omni reference, keyframes, audio-guided video, and motion control
- Live account-scoped model discovery, reference limits, and billing disclosures
- Media upload, Element management, motion library, credit checks, and task status
- Confirmation immediately before credit-consuming generation
- At most one submission per confirmed intent
- One self-refreshing MCP App per generation when available

## MCP endpoint

The plugin registers exactly one HTTP MCP server with the key
`kling-ai` and endpoint `https://kling.ai/mcp/plugin`. Cursor manages its
OAuth connection. Do not add a second Kling MCP configuration or paste an API
key, token, cookie, or authorization header into chat.

## Local installation

From the repository root, copy the plugin components into Cursor's local plugin
directory:

```bash
mkdir -p ~/.cursor/plugins/local/kling-ai
cp -R .cursor-plugin assets commands rules skills mcp.json README.md \
  ~/.cursor/plugins/local/kling-ai/
```

Restart Cursor or run `Developer: Reload Window`, confirm Kling AI is loaded
under **Customize → Plugins**, and click **Connect** on its MCP server to
complete OAuth. When upgrading from 1.0.2, reconnect the MCP server to authorize
the updated `/mcp/plugin` endpoint. After updating a Skill or MCP configuration,
reload Cursor and start a new conversation so it receives the latest tool snapshot.

## Components

| Component | Path | Purpose |
| --- | --- | --- |
| Manifest | `.cursor-plugin/plugin.json` | Plugin identity and native component entrypoints |
| MCP | `mcp.json` | Global remote OAuth MCP |
| Rule | `rules/kling-ai.mdc` | Routing, safety, and single-submission constraints |
| Command | `commands/kling-ai.md` | `/kling-ai` natural-language entrypoint |
| Core Skill | `skills/kling-ai/` | OAuth, account, media, Elements, status, and shared contract |
| Image Skill | `skills/kling-ai-generate-image/` | Image workflows, prompting, and quality gates |
| Video Skill | `skills/kling-ai-generate-video/` | Video, motion control, duration, and shot planning |

## Generation contract

1. Call `who_am_i` before generation and use the live service's canonical
   models, arguments, enums, and inputs.
2. Upload local media with the remote upload tool and reuse one UUIDv7
   `taskTraceId` for the same objective.
3. Show final billable settings, including live-required billing disclosures, and
   obtain explicit confirmation unless those settings are already authorized.
4. Call a generation tool at most once per confirmed intent; never retry an
   ambiguous submission automatically.
5. When Cursor mounts the generation MCP App, let that App refresh internally
   instead of creating duplicate model-side `query_tasks` cards.
6. If no App mounts, query at the provider-permitted interval until terminal,
   cancelled, or the turn cannot continue. Report completion only after terminal
   success with usable primary media. An explicit status request queries once.

## Examples

> `/kling-ai` Check my authorization and credits without creating a generation task.

> `/kling-ai` Create a 4:5 product poster. Show final settings and wait for confirmation.

> `/kling-ai` Create a five-second 16:9 continuous shot with a slow camera push-in.

> `/kling-ai` Query the current state of this task number once. Do not create a new task.

## Validation

```bash
npm run check
npm test
for skill in skills/*; do
  python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-creator/scripts/quick_validate.py" "$skill"
done
```

## Official references

- [Cursor Plugins](https://cursor.com/docs/plugins)
- [Cursor Plugins Reference](https://cursor.com/docs/reference/plugins)
- [Cursor MCP](https://cursor.com/docs/mcp)

## License

MIT. Kling AI and related marks belong to their respective owners.
