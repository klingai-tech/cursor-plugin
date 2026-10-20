# Changelog

## 1.3.0

- Synced shared Skills and references from Kling AI for Claude Code 1.3.0, adapted for Cursor.
- Added V4 recommendations, omni-reference video routing, live capability discovery, and model parameter constraints.
- Expanded Element, motion-library, upload, reference media, and billing workflows.
- Updated the Global MCP endpoint to `https://kling.ai/mcp/plugin` and delegated OAuth registration to Cursor.
- Aligned confirmation and result handling, including headless status polling when no MCP App renders.

## 1.0.2

- Consolidated the repository as one Global `kling-ai` Cursor plugin.
- Added native Rules, Commands, and focused image, video, and install Skills.
- Fixed the plugin to exactly one Global OAuth MCP endpoint and the `Plugin-Cursor-kling-ai` server key.
- Removed the bundled localhost task monitor and local runtime dependency.
- Aligned generation confirmation, single-submission, task handoff, MCP App refresh, and fallback behavior with the other Kling AI hosts.

## 1.0.0

- Initial Cursor plugin package.
