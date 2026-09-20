# AI Content Factory

This branch adds the front half of the automatic video pipeline.

## Pipeline

Topic / brief -> AI script + structured scene planner -> asset prompts -> existing visual/editing brain -> timeline -> render.

## Implemented

- Provider-neutral ContentProject and ContentScene schema.
- Deterministic fallback scene planner.
- OpenAI Responses API content generator using Structured Outputs.
- Reuses the existing securely stored OpenAI API key.
- Renderer IPC/preload bridge.
- Create Video panel for topic, format, language, and target duration.
- Generated scenes include narration, visual intent, image prompt, optional video prompt, SFX hints, and estimated timing.

## Safety and reliability

Mystery, legend, and disputed-story prompts explicitly ask the generator to distinguish reported facts from folklore rather than flattening uncertain claims into facts.

The content model can be overridden with the OPENAI_CONTENT_MODEL environment variable.

## Next

1. Add image/video asset provider interfaces and generation job states.
2. Persist ContentProject with the editable project document.
3. Convert generated assets into the existing VisualBrainPlan/TimelinePlan.
4. Add narration/TTS provider support.
5. Add batch project render queue.
