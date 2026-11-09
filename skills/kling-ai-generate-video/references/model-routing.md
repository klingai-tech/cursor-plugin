# Video entry points and model selection

First follow [capability discovery](../../kling-ai/references/capability-discovery.md). A discovered tool is not proof that any particular model is enabled. Never route by tool count, a static model name, or an earlier account's capabilities.

Compare the relevant entry points returned by successful discovery, including `omni_ref_video` (全能参考) when present. Filter out pairs that cannot meet the requested tool, model or family, output settings, sound, or reference roles before ranking. If discovery itself fails, refresh the connection or report the failure. If successful discovery omits an entry point, use the remaining eligible pairs.

Recommend V4 when the user has not specified a model and live discovery returns a compatible V4 pair. Prefer omni for ordinary requests when eligible pairs are otherwise equivalent. Use V4 Flash when speed or credit savings are prioritized and its live capabilities fit. Say "Recommended: V4" or "推荐使用 V4". If no V4 pair fits, consider a compatible live default only when the user permits other models. If the only permitted model or family has no eligible pair, report the limitation and stop.

## Intent and inputs

- Text-only video can use `omni_ref_video` when the chosen model permits no media inputs.
- Image, video, Element, and audio references can use `omni_ref_video` only when the selected model supports each requested type and their combination. Do not treat its general tool description as every model's capability list.
- Keyframes belong to whichever discovered tool/model declares the needed frame inputs. Do not hardcode them to one entry point, invent intermediate frames, or substitute identity references for frame control.
- Motion transfer must use a model that explicitly supports that intent and all required inputs. Existing `motion_control` requests keep the subject image and exactly one motion source.
- Required silence eliminates pairs without a declared sound-off control that satisfies the request or an explicit silent-output guarantee. A text-to-video tool name, an absent audio field, or silence described in a prompt does not establish that capability.
- Do not move an omni model to `image_to_video` or `text_to_video`; tool/model pairs and their parameter sets are inseparable.

After selection, apply [model parameters](../../kling-ai/references/model-parameters.md), including conditional reference caps, Elements, and audio exclusivity. One multi-shot plan remains one task unless separate tasks were explicitly approved. The core Skill's billing, single-submission, and result rules apply to omni reference too.
