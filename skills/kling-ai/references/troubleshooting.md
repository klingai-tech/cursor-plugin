# Cursor troubleshooting

## MCP tools are missing

Open **Customize → Plugins**, verify that Kling AI is installed, and confirm exactly one `kling-ai` is enabled at `https://kling.ai/mcp`. Reload the Cursor window after adding or updating a Skill or MCP configuration, then start a new conversation to obtain the latest tool snapshot.

## Not authorized

Open the plugin's MCP server in Cursor and click **Connect**. Do not substitute an API key, manually pasted token, or custom callback. For account switching, disconnect or log out first, then authorize again through Cursor's native OAuth flow.

## Wrong region or duplicate tools

Verify that only `https://kling.ai/mcp` is active. Do not keep a second project-scoped or user-scoped copy of the same MCP registration.

## Upload failure

- Refresh the live schema and verify the upload tool and response fields.
- Reuse the upload result exactly in generation inputs and keep the same `taskTraceId`.
- Do not pass local paths, expired signed URLs, or undeclared input names to a remote generation tool.

## Task is still running

If the generation MCP App is mounted, let that single App refresh itself and do not call `query_tasks` from the model. Repeated model calls create repeated Cursor cards. If no App mounted, return the task number and current state without a polling loop. A later explicit request may call `query_tasks` once.

## Submission timeout or lost response

Do not call the generation tool again. First use any known `generationId`, `taskTraceId`, or provider-supported task listing to determine whether a task was created. If creation cannot be determined, report the unknown state and obtain fresh confirmation before any new submission.

## Result URL expired

Query the preserved task number for a fresh URL, or open the Kling generation history for the authorized account. An expired URL does not mean that the generated work was deleted.
