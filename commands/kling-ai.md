---
name: kling-ai
description: Run Kling AI workflows in natural language — generate images and videos, manage generations, check account status, and continue a completed result.
---

# /kling-ai

Natural-language entrypoint for Kling AI workflows. Route the request to the
core `$kling-ai` Skill, then use `$kling-ai-generate-image` or
`$kling-ai-generate-video` for generation. Follow the live remote schema and
the main confirmation, single-submission, and result-presentation contract.

## Usage

```
/kling-ai <natural language request>
```

## Examples

```
/kling-ai Create a cinematic 16:9 poster outside a convenience store on a rainy night
/kling-ai Turn this image into a five-second 9:16 product video
/kling-ai Query the task with generationId <id>
/kling-ai Check my Kling AI account and credits
```

Every real generation still requires confirmation of the final billable
settings, and each confirmed intent may be submitted at most once. When the
generation MCP App mounts, it is the single self-refreshing status and result
card; do not poll the same task with model-side `query_tasks` calls.
