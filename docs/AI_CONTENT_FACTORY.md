# AI Content Factory

This branch adds the front half of the automatic video pipeline.

## Pipeline

Topic / brief -> script -> scene planner -> asset prompts -> existing visual/editing brain -> timeline -> render.

## First milestone

The first milestone intentionally stays provider-neutral. It defines a durable content-project schema and a deterministic scene planner before wiring an LLM or image/video provider.

This keeps generated content separate from the existing Phase 1 timeline/render model and lets later providers be swapped without rewriting the editor.

## Next

1. Add script-generation provider interface.
2. Add structured AI scene planning.
3. Add image/video asset provider interface and job states.
4. Convert generated assets into the existing VisualBrainPlan/TimelinePlan.
5. Add Create Video UI and render queue.
