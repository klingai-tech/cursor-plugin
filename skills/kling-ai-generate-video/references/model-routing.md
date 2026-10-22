# Video entry points and model selection

First follow [capability discovery](../../kling-ai/references/capability-discovery.md). A discovered tool is not proof that any particular model is enabled. Never route by tool count, a static model name, or an earlier account's capabilities.

`omni_ref_video` (全能参考) is the default entry point for ordinary text-to-video, image-to-video, keyframes, Element, and audio-reference requests. Start discovery there and prefer a compatible Kling 4.0 (V4) model returned for that tool. If no compatible V4 is returned, use another compatible available model on that entry point. If none satisfies all required inputs, explain the limitation without dropping references.

Use another entry point when the user explicitly requests it or a required capability needs it; motion transfer uses `motion_control`. A missing or failed `omni_ref_video` discovery requires refreshing the connection or reporting the problem, not automatic fallback to legacy tools.

Recommend V4 for video generation when the user has not specified a model and live discovery returns a compatible V4 model. Use V4 Flash when speed or credit savings are prioritized and its live capabilities fit. Say "Recommended: V4", without describing it as "the latest model". User-specified available models take precedence. Select quality/speed variants using actual descriptions, and use real billing information for budget choices. Do not raise resolution or output count merely because V4 is available.

## Intent and inputs

- Text-only video can use `omni_ref_video` only if the chosen model explicitly permits no media inputs; if it requires media, explain the constraint and select another entry point only when the required capability demands it. The word "reference" in the tool name does not make attachments mandatory.
- Image, video, Element, and audio references can use `omni_ref_video` only when the selected model supports each requested type and their combination. Do not treat its general tool description as every model's capability list.
- Keyframes belong to whichever discovered tool/model declares the needed frame inputs. Do not hardcode them to one entry point, invent intermediate frames, or substitute identity references for frame control.
- Motion transfer must use a model that explicitly supports that intent and all required inputs. Existing `motion_control` requests keep the subject image and exactly one motion source.
- Do not move an omni model to `image_to_video` or `text_to_video`; tool/model pairs and their parameter sets are inseparable.

After selection, apply [model parameters](../../kling-ai/references/model-parameters.md), including conditional reference caps, Elements, and audio exclusivity. One multi-shot plan remains one task unless separate tasks were explicitly approved. The core Skill's billing, single-submission, and result rules apply to omni reference too.
