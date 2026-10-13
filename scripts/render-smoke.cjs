const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ffmpegPath = require("ffmpeg-static");
const { renderTimeline } = require("../dist-electron/src/main/video/render.js");
const {
  createPreviewTimeline
} = require("../dist-electron/src/main/video/previewPlan.js");
const {
  buildQcSampleSpecs
} = require("../dist-electron/src/main/video/qcPack.js");
const {
  verifyRenderedOutput
} = require("../dist-electron/src/main/video/renderVerification.js");

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
  const voiceA = path.join(root, "voice-a.wav");
  const voiceB = path.join(root, "voice-b.wav");
  const music = path.join(root, "music.wav");
  const storyOutput = path.join(root, "story-smoke.mp4");
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

    for (const [file, frequency, duration] of [
      [voiceA, 330, 0.8], [voiceB, 550, 0.8], [music, 110, 4]
    ]) {
      run(["-y", "-f", "lavfi", "-i", `sine=frequency=${frequency}:duration=${duration}`,
        "-ac", "2", file]);
    }

    const fullPlan = {
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
    };

    const qcSpecs = buildQcSampleSpecs(
      { ...fullPlan, duration: 1800 },
      15
    );

    if (
      qcSpecs.length !== 3 ||
      qcSpecs[0].id !== "opening" ||
      Math.abs(qcSpecs[1].start - 892.5) > 0.001 ||
      Math.abs(qcSpecs[2].start - 1785) > 0.001
    ) {
      throw new Error("QC sample points are not opening / middle / ending.");
    }

    const previewPlan = {
      ...createPreviewTimeline(fullPlan, 1.2, 1.3),
      subtitleStyle: {
        fontFamily: "",
        scale: 1.2,
        position: "middle"
      },
      exportSubtitleSidecar: true
    };

    if (
      Math.abs(previewPlan.duration - 1.3) > 0.001 ||
      Math.abs((previewPlan.narrationOffset ?? 0) - 1.2) > 0.001 ||
      previewPlan.clips.length !== 2 ||
      previewPlan.audioLayers.length !== 1 ||
      Math.abs((previewPlan.audioLayers[0].sourceOffset ?? 0) - 0.2) > 0.001
    ) {
      throw new Error("Preview timeline slicing did not preserve expected offsets.");
    }

    const progressEvents = [];

    await renderTimeline(
      previewPlan,
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

    const subtitleSidecar = path.join(root, "smoke.srt");
    if (
      !fs.existsSync(subtitleSidecar) ||
      !fs.readFileSync(subtitleSidecar, "utf8").includes("Second subtitle")
    ) {
      throw new Error("Subtitle sidecar was not written from the corrected cues.");
    }

    const report = await verifyRenderedOutput(previewPlan, output);
    if (
      !report.passed ||
      report.width !== previewPlan.width ||
      report.height !== previewPlan.height ||
      report.fileSizeBytes <= 0 ||
      report.actualDuration <= 0 ||
      Math.abs((report.fps ?? 0) - previewPlan.fps) > 0.1 ||
      !fs.existsSync(report.reportPath)
    ) {
      throw new Error("Post-render verification did not validate the smoke output.");
    }

    // End-to-end novel-style export: two speakers, a deliberate pause, SFX, music and two held frames.
    const storyPlan = {
      duration: 4, narration, width: 360, height: 640, fps: 24,
      clips: [
        { id: "story-scene-1", imagePath: image1, start: 0, duration: 2, motion: "hold" },
        { id: "story-scene-2", imagePath: image2, start: 2, duration: 2, motion: "hold" }
      ],
      audioLayers: [
        { id: "speaker-a", filePath: voiceA, kind: "dialogue", start: 0.3, duration: 0.8, volume: 0.7, loop: false, fadeIn: 0, fadeOut: 0, origin: "studio-dialogue", voiceLineId: "line-1", voiceSpeaker: "พรานสิง" },
        { id: "speaker-b", filePath: voiceB, kind: "dialogue", start: 2.2, duration: 0.8, volume: 0.7, loop: false, fadeIn: 0, fadeOut: 0, origin: "studio-dialogue", voiceLineId: "line-2", voiceSpeaker: "พรานอิน" },
        { id: "story-effect", filePath: effect, kind: "sfx", start: 1.5, duration: 0.8, volume: 0.15, loop: false, fadeIn: 0, fadeOut: 0, origin: "manual" },
        { id: "background-music", filePath: music, kind: "music", start: 0, duration: 4, volume: 0.08, loop: false, fadeIn: 0, fadeOut: 0.2, origin: "manual" }
      ],
      subtitles: [], transitionDuration: 0, quality: "draft"
    };
    await renderTimeline(storyPlan, storyOutput, () => {});
    const storyReport = await verifyRenderedOutput(storyPlan, storyOutput);
    if (!storyReport.passed || Math.abs(storyReport.actualDuration - 4) > 0.3 ||
        storyReport.width !== 360 || storyReport.height !== 640 ||
        fs.statSync(storyOutput).size < 1000) {
      throw new Error("Multi-speaker story MP4 failed post-render verification.");
    }

    // Decode the encoded AAC output and confirm that each speaker's distinct
    // frequency is present only inside that speaker's scheduled time window.
    const pcm = path.join(root, "story-audio.f32le");
    run(["-y", "-i", storyOutput, "-map", "0:a:0", "-vn", "-ac", "1",
      "-ar", "8000", "-f", "f32le", pcm]);
    const pcmBytes = fs.readFileSync(pcm);
    const samples = new Float32Array(pcmBytes.buffer.slice(
      pcmBytes.byteOffset, pcmBytes.byteOffset + pcmBytes.byteLength
    ));
    function toneMagnitude(startSeconds, frequency) {
      const start = Math.round(startSeconds * 8000);
      const length = 1600;
      let cosine = 0;
      let sine = 0;
      for (let n = 0; n < length; n += 1) {
        const angle = 2 * Math.PI * frequency * n / 8000;
        cosine += samples[start + n] * Math.cos(angle);
        sine += samples[start + n] * Math.sin(angle);
      }
      return Math.hypot(cosine, sine) / length;
    }
    const speakerAActive = toneMagnitude(0.5, 330);
    const speakerAQuiet = toneMagnitude(1.2, 330);
    const speakerBActive = toneMagnitude(2.4, 550);
    const speakerBQuiet = toneMagnitude(1.2, 550);
    if (!(speakerAActive > 0.01 && speakerAActive > speakerAQuiet * 5 &&
          speakerBActive > 0.01 && speakerBActive > speakerBQuiet * 5)) {
      throw new Error("Encoded MP4 dialogue timing or speaker separation failed.");
    }

    console.log(
      `render smoke test passed (${stat.size} bytes, ${progressEvents.length} progress events, ${report.frameCount ?? "n/a"} frames)`
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
