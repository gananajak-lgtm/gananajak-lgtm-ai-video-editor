# AI Video Editor 🎬

AI-assisted automatic video editor focused on story-driven videos made from still images, narration, music, sound effects, and subtitles.

## MVP

- Import images and long-form narration audio
- Listen to narration and create timestamped transcript segments
- Build an automatic timeline
- Match images to narration segments
- Pan/zoom motion for still images
- Transitions
- Automatic subtitles
- Preview before rendering
- Export MP4 with FFmpeg

## Current foundation

The desktop app currently includes:

- Electron + React + TypeScript shell
- Multi-image and narration import
- FFprobe media-duration analysis
- FFmpeg 1080p / 30 fps MP4 rendering
- Slow-zoom motion for still images
- Long-audio transcription in 10-minute chunks
- Restoration of transcript segments to the original episode timestamps
- Secure local API-key storage when operating-system encryption is available
- Baseline timeline UI and export flow

## Audio Brain

Long narration is converted into manageable audio chunks before transcription. Each returned segment is offset back to the original file time, so a long episode becomes one continuous timestamped story map.

The current timestamp implementation uses the OpenAI audio transcription endpoint with `whisper-1` verbose segment timestamps. The API key is entered locally in the desktop app and is never committed to the repository.

## Next: Visual Brain

The next editing layer will analyze the meaning of each transcript scene and the available images, then choose the most relevant image for each timestamp range instead of distributing images evenly.

## Product direction

The editor is designed first for narrated cinematic stories rather than as a general-purpose replacement for traditional NLE software.

## Development

Initial development is tracked in GitHub Issues. The first milestone establishes the media pipeline and a minimal end-to-end render.
