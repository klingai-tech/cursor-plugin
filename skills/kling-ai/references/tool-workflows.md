# Remote tool workflows

## Generation

1. Verify that Cursor has exactly one `kling-ai` connection at `https://kling.ai/mcp`, then read the current `tools/list`.
2. Create a UUIDv7 `taskTraceId`, call `who_am_i`, and use only the models, arguments, enums, defaults, and inputs declared for the selected live tool.
3. When local media is present, upload it with `file_upload` and pass the returned URL under the live input name. Never pass a local path directly to the remote generation tool.
4. Show the final billable settings and wait for explicit user confirmation.
5. Call the selected generation tool exactly once with `{model, arguments[], inputs[], rationale, taskTraceId}`, and preserve its `generationId`.
6. If the generation response mounts an MCP App, make no model-side `query_tasks` call for that submission. The mounted App owns bounded read-only refresh and updates the same card in place.
7. If no App mounts, return the current state and task number without model-loop polling. A later explicit status request may call `query_tasks` once. When an App is rendered, add only a concise status if needed; otherwise return the text fallback and one primary result link.

## Read-only operations

- Account and credits: call `query_membership_and_credits` once.
- Task status: call `query_tasks` once only for an explicit standalone request; never repeat it in the same turn and never use it alongside a mounted generation App.
- Model capabilities: call `who_am_i` without creating a task.

## State changes

- Call `element_delete` only after the user explicitly confirms the deletion target.
- Call `logout` or switch accounts only when the user explicitly requests it. Immediately re-enter Cursor's native OAuth flow after logout, and stop other Kling calls until authorization completes.
Never retry a generation automatically.
