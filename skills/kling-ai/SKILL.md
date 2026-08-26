---
name: kling-ai
description: Create, query, and manage Kling AI image and video tasks through the OAuth-protected MCP in Cursor. Use for text-to-image, image-to-image, text-to-video, image-to-video, motion control, uploads, Elements, credit checks, task status, and account switching.
---

# Kling AI for Cursor

Use only the Global MCP configured by this Cursor plugin: `https://kling.ai/mcp`. Do not switch regions, register a second Kling MCP, or start or depend on a local MCP server.

## Request routing

- Route text-to-image, image-to-image, posters, covers, product stills, portraits, and image variants to `kling-ai-generate-image`.
- Route text-to-video, image-to-video, motion control, animation, camera movement, storyboards, and video concepts to `kling-ai-generate-video`.
- Keep OAuth, sign-out or account switching, uploads, the motion library, Elements, credit checks, cross-media requests, and task-status requests in this Skill.
- Follow up on an existing task with `query_tasks`; do not create a replacement generation.

An attachment does not determine its role. When the user has not specified one, ask only which materially relevant role it serves: first frame, tail frame, identity or product reference, editable source, motion source, or style reference.

## Cursor connection boundary

- Use OAuth managed by the Cursor MCP connection. Never request an API key, token, cookie, authorization header, or credential file. Never log private account fields or signed URLs.
- OAuth dynamic client registration uses `client_name: "Plugin-Cursor"`. This is OAuth metadata, not a tool argument, URL parameter, or secret. If the host cannot inject it, stop before authorization and report the limitation.
- `mcp.json` is the only MCP configuration source of truth and must remain pointed at `https://kling.ai/mcp`. Do not create a second Kling configuration or regional-switching flow.
- Create one RFC 4122 UUIDv7 `taskTraceId` for each unrelated new objective. Reuse it across discovery, upload, generation, and querying for the same objective. Present `generationId` to the user as the task number; do not expose `taskTraceId` unless troubleshooting requires it.

## Billing and single submission

- Image, video, and motion generation consume Kling credits. Call `who_am_i` before submission and use its live model and argument definitions. If the remote `mcpVersion` is newer than the current tool snapshot, ask the user to reload Cursor and continue in a new conversation.
- Before generation, show the final workflow, model, prompt summary, resolution or duration, aspect ratio, output count, and reference roles. Obtain explicit confirmation immediately before submission. A read-only query, account check, or upload is not generation approval.
- Submit at most once per confirmed intent. Never retry automatically or silently change models after a failure, timeout, ambiguous response, or rendering problem.
- After receiving a `generationId`, determine who owns refresh. When Cursor mounts the generation MCP App, the App refreshes that submission internally; do not call `query_tasks` for it from the model because each call creates another tool card. If no App mounts, return the current state and task number instead of entering a model-driven polling loop. Call `query_tasks` exactly once only for a later explicit standalone status request. If the submission response is lost, first use known identifiers or a provider-supported task listing to determine whether a task exists; if absence cannot be proven, stop and report that creation state is unknown.

Read [tool workflows](references/tool-workflows.md) and the [MCP contract](references/mcp-contract.md) before generation. Read [troubleshooting](references/troubleshooting.md) only after an authorization, schema, upload, or provider failure.

## Workflow

1. Classify the request as generation, motion control, Element management, account mutation, or read-only query.
2. Read the current remote tool definitions. Before generation or motion control, call `who_am_i` and use only the canonical model name, arguments, defaults, enums, and media inputs declared for the selected model.
3. Fill only creative details that materially affect the result. Do not invent models, fields, or values from memory.
4. When local media is required, upload it first and reuse the returned provider reference exactly as the live schema requires. Upload completion does not replace the billing confirmation.
5. After explicit confirmation, call the selected generation tool exactly once and preserve both `generationId` and `taskTraceId`.
6. When the generation response mounts an MCP App, stop model-side status polling. Keep that one App as the refresh owner; it calls `query_tasks` internally and updates in place. Do not wait and recheck the same task with another model tool call.
7. If no App mounts, report the current state and task number without a polling loop. For a later direct request about an existing task, call `query_tasks` exactly once and report that snapshot; do not start a new generation or repeat the query in the same turn.
8. Treat the mounted App as the only media preview and status surface. Do not add Markdown image/video syntax, a separate media attachment, a thumbnail, or a duplicate download link outside the App. Only when no App is rendered may you return the same call's text fallback and one primary result link.
9. Call `element_delete`, `logout`, or account switching only when the user explicitly requests the state change. Account switching stays on the same Global endpoint. Call no other Kling tool until authorization completes.

## Quality defaults

Apply these defaults only when the user did not specify another choice and the live schema supports them:

- Model: prefer a full-quality model compatible with the requested mode and references. Prefer Turbo, fast, or low-cost models only when the user explicitly prioritizes drafts, speed, or credit savings.
- Image resolution: prefer `2k` for normal delivery, `4k` for commercial work, advertising, fine materials, or crop-heavy post-production, and `1k` only for drafts or speed. Never lower a higher live default.
- Video resolution: prefer `1080p` for normal delivery and `4k` for supported commercial, large-screen, or post-production work. Use `720p` for drafts, speed, cost, or model limitations.
- Output count: generate one result unless the user requests more.
- Duration: use about 5 seconds for one action or shot, about 10 seconds for dialogue, a complete product action, or two connected beats, and longer only when supported and narratively necessary.
- Aspect ratio: use `9:16` for vertical shorts, `1:1` for square feeds, and `16:9` for landscape ads or web. For image-to-video, preserve the first frame unless the live tool requires an explicit ratio.

## Failure behavior

- Unauthorized: use Cursor's native MCP Connect flow for `kling-ai`, then continue only after authorization succeeds.
- Unsupported argument: refresh the live tool definitions and change only the rejected field. Show the revised settings and obtain confirmation again before any new generation.
- Insufficient credits or provider failure: report the provider message and task number, then stop. Do not retry automatically.
- Expired result URL: query the original task number for a fresh URL; do not create a new task.
- Opaque error, unexpected empty result, or billing anomaly: submit one feedback report as directed by the tool description. Feedback is not a retry, refund, or fix.
