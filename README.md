# AI Video Editor 🎬

AI-assisted automatic video editor focused on story-driven videos made from still images, long narration, music, ambience, sound effects, and subtitles.

## MVP

- Import images and long-form narration audio
- Listen to narration and create timestamped transcript segments
- Group continuous speech into editable story scenes
- Detect and place matching sound effects from a local SFX library
- Analyze still images with vision AI
- Match grouped scenes to relevant images
- Build deliberate shot plans instead of cutting on every sentence
- Hold shots through narration pauses rather than forcing cuts
- Pan / zoom / hold motion for still images
- Mix narration, SFX, ambience, and music on overlapping tracks
- Preview the generated timeline before rendering
- Export MP4 with FFmpeg

## Current foundation

The desktop app currently includes:

- Electron + React + TypeScript shell
- Multi-image and narration import
- FFprobe media-duration analysis
- FFmpeg MP4 rendering with selectable resolution, aspect ratio, frame rate, and quality
- Long-audio transcription in 10-minute chunks
- Restoration of transcript segments to the original episode timestamps
- Secure local API-key storage when operating-system encryption is available
- Scene Grouper with minimum-shot planning
- Automatic SFX cue detection for common Thai and English narration cues
- Multitrack narration / SFX / ambience / music mixing
- Visual image analysis with a local descriptor cache
- Scene-to-image matching
- Automatic shot planning
- Timestamp-aligned Visual Brain timeline generation
- Motion-aware rendering: hold, zoom in, zoom out, pan left, pan right
- Automatic burned subtitles generated from transcript timestamps
- Duration-preserving crossfade transitions between planned shots
- Baseline sequential timeline retained as a fallback
- Manual finishing controls for image replacement, shot motion, cut nudging, crossfade timing, and subtitle corrections
- Safe local still-image preview in the Electron renderer
- Project save/open using portable `.aivproj` JSON documents
- Recovery autosave stored in the Electron user-data directory
- Full project persistence for narration, images, transcript, Editing Brain plan, timeline edits, subtitles, transitions, and audio layers
- Missing-media detection when a project is reopened
- Export presets for 1080p, 1440p, 4K, 9:16 vertical, 1:1 square, 4:5 portrait, and custom dimensions
- 24 / 25 / 30 / 60 fps export options
- Draft / Standard / High encoder-quality presets
- Resolution-aware subtitle sizing
- Aspect-preserving scale + center crop so artwork is not stretched
- CI runtime smoke render covering images, narration, overlapping SFX, subtitles, motion, transitions, portrait export, custom FPS, and quality presets

## Audio Brain

Long narration is converted into manageable audio chunks before transcription. Each returned segment is offset back to the original file time, so a long episode becomes one continuous timestamped story map.

The current timestamp implementation uses the OpenAI audio transcription endpoint with `whisper-1` verbose segment timestamps. The API key is entered locally in the desktop app and is never committed to the repository.

## Editing Brain

Editing Brain combines nearby timestamped narration segments into longer story scenes so the editor does not treat every sentence as a mandatory cut.

It can also inspect narration text for sound-effect cues, match those cues against filenames in a user-supplied local SFX library, and place matched effects directly on the multitrack timeline.

## Visual Brain

Visual Brain analyzes each selected story image for:

- visible characters or roles
- actions
- setting
- mood
- shot type / framing

Descriptors are cached locally using the source file size and modification time, so unchanged images do not need to be analyzed again.

Grouped story scenes are ranked against image descriptors. The shot planner selects a small set of images per scene, avoids unnecessary immediate repetition when alternatives exist, chooses a motion style, and converts the result into a narration-length timeline.

Pauses between spoken scenes extend the current visual shot until the next planned timestamp instead of introducing artificial rapid cuts.

## Current limitations

- Scene-to-image ranking is currently heuristic over AI-generated descriptors rather than a full semantic reranker.
- Character identity can only use visually supported information or helpful fictional labels present in filenames.
- The CI smoke render now verifies the real FFmpeg pipeline with synthetic media, but a representative long real-world episode still needs end-to-end verification.
- Manual finishing controls and project persistence are now present; richer playback/scrubbing can be added after the core MVP is proven.
- Export can upscale to 4K or custom dimensions, but true source detail still depends on the original image resolution.
- Thai subtitle appearance depends on suitable Thai fonts being available on the target operating system.

## Product direction

The editor is designed first for narrated cinematic stories rather than as a general-purpose replacement for traditional NLE software.

## Development

Initial development is tracked in GitHub Issues. The first milestone establishes the media pipeline and a minimal end-to-end render.
