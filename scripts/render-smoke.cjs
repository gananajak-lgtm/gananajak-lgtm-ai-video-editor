const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");
const { renderTimeline } = require("../dist-electron/main/video/render.js");

function run(args) {
  const result = spawnSync(ffmpegPath, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `FFmpeg fixture command failed: ${args.join(" ")}`);
  }
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-video-editor-smoke-"));
  const image1 = path.join(root, "frame-1.png");
  const image2 = path.join(root, "frame-2.png");
  const narration = path.join(root, "narration.wav");
  const effect = path.join(root, "effect.wav");
  const output = path.join(root, "smoke.mp4");

  try {
    run([
      "-y",
      "-f", "lavfi",
      "-i", "color=c=0x203050:s=640x360:d=1",
      "-frames:v", "1",
      image1
    ]);

    run([
      "-y",
      "-f", "lavfi",
      "-i", "color=c=0x705030:s=640x360:d=1",
      "-frames:v", "1",
      image2
    ]);

    run([
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=3",
      "-ac", "2",
      narration
    ]);

    run([
      "-y",
      "-f", "lavfi",
      "-i", "sine=frequency=880:duration=0.8",
      "-ac", "2",
      effect
    ]);

    const progressEvents = [];

    await renderTimeline(
      {
        duration: 3,
        narration,
        width: 360,
        height: 640,
        fps: 24,
        clips: [
          {
            id: "clip-1",
            imagePath: image1,
            start: 0,
            duration: 1.5,
            motion: "slow-zoom-in"
          },
          {
            id: "clip-2",
            imagePath: image2,
            start: 1.5,
            duration: 1.5,
            motion: "pan-right"
          }
        ],
        audioLayers: [
          {
            id: "effect-1",
            filePath: effect,
            kind: "sfx",
            start: 1,
            duration: 0.8,
            volume: 0.2,
            loop: false,
            fadeIn: 0,
            fadeOut: 0.15,
            origin: "manual"
          }
        ],
        subtitles: [
          {
            id: "subtitle-1",
            start: 0.2,
            end: 1.3,
            text: "First subtitle"
          },
          {
            id: "subtitle-2",
            start: 1.55,
            end: 2.75,
            text: "Second subtitle"
          }
        ],
        transitionDuration: 0.25,
        quality: "draft"
      },
      output,
      (progress) => progressEvents.push(progress)
    );

    if (
      progressEvents.length === 0 ||
      progressEvents[progressEvents.length - 1].progress !== 1
    ) {
      throw new Error("Render progress did not reach 100%.");
    }

    const stat = fs.statSync(output);
    if (stat.size < 1000) {
      throw new Error(`Smoke render output is unexpectedly small: ${stat.size} bytes`);
    }

    console.log(
      `render smoke test passed (${stat.size} bytes, ${progressEvents.length} progress events)`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
