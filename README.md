# Kling AI for Cursor

Cursor plugin for creating and monitoring Kling AI images and videos through
the official OAuth-protected MCP server. It combines generation workflows,
credit-safety guidance, and an optional localhost task monitor.

## What it includes

- `skills/kling-ai/SKILL.md`: generation confirmation and result-handling rules.
- `rules/kling-ai.mdc`: optional project guidance for safe generation.
- `.mcp.json`: remote OAuth MCP configuration for `https://klingai.com/mcp`.
- A local read-only monitor for generation status and outputs.

## When to use it

Install the plugin through Cursor, then authenticate the `kling-ai` MCP server
when Cursor prompts you. Use the local monitor only for long-running tasks:

```bash
npm install
npm run monitor -- --generation-id=<id>
```

The monitor binds only to `127.0.0.1`, keeps OAuth tokens in memory, and never
creates or cancels a generation. See [PRIVACY.md](PRIVACY.md) for data handling.

## License

MIT
