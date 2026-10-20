---
name: install-kling-ai-plugin
description: Install, update, reconnect, or troubleshoot the Kling AI Global plugin and its MCP registration in Cursor. Use for local installation, plugin refresh, and OAuth connection issues.
---

# Install Kling AI in Cursor

1. Treat the installed plugin's `mcp.json` as the only MCP configuration source of truth. Its endpoint must remain `https://kling.ai/mcp/plugin`.
2. Preserve the exact server key `Plugin-Cursor-kling-ai`, transport type, and URL. Do not shorten, rename, or reconstruct fields from memory.
3. For local development, copy this whole plugin directory under `~/.cursor/plugins/local/kling-ai` and reload Cursor. Do not copy plugin components into a project's `.cursor/` directory.
4. Do not create, copy, or enable a second Kling MCP configuration or regional template.
5. Re-read the effective configuration and verify that exactly one `Plugin-Cursor-kling-ai` points to `https://kling.ai/mcp/plugin`.
6. Complete OAuth from Cursor's native MCP Connect flow. Never request or display credentials.
7. After adding or updating a Skill or MCP configuration, reload Cursor, then start a new conversation to obtain the latest tool snapshot.

This plugin connects only to the remote Kling MCP. It does not start, register, or depend on a local MCP server.
