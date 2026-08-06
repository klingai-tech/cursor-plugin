---
name: kling-ai
description: Create and inspect Kling AI images and videos through the official MCP server. Use for text-to-image, image-to-image, text-to-video, image-to-video, reference media, and task status workflows.
---

# Kling AI

Use the `kling-ai` MCP server for Kling operations.

- Before any operation that can create or consume credits, explain the selected model, duration/size, expected credit impact when available, and ask for explicit confirmation.
- Do not submit the same generation twice. If a request may already have been submitted, query its task status first.
- Use `generation.read` tools for status and results; do not claim completion until the server reports a terminal success state and returns a result URL.
- Treat returned media URLs as temporary and do not expose OAuth tokens, raw authorization headers, or private task payloads.
