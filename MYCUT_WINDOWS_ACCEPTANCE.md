# Windows MyCut 1.0.1 — real GUI acceptance checklist

Status: **NOT YET EXECUTED**. GitHub Actions Windows packaging and FFmpeg smoke tests are not equivalent to opening the generated project in installed MyCut 1.0.1.

## Safety and prerequisites
- Keep user project **1019** closed and unchanged. Work with a **new** MyCut project name/path only.
- Windows host with installed **MyCut 1.0.1** and current AI Video Editor Windows installer from a **successful** CI run.
- Use an isolated test episode containing **three real, decodable MP3 voice clips** of unequal durations, and **three real still images**. Note each real clip duration using a media probe.
- Record app version, installer SHA-256, Windows version, generated project path, and MyCut 1.0.1 version in the results below.
- No paid TTS / image generation calls; use existing audio assets.

## Execute in the Windows application
1. Open AI Video Editor > test episode, load the existing three voice files. Confirm speaker order and preview each MP3.
2. Import three stills. Use sidecar line cues `line: 1`, `line: 2`, `line: 3` where appropriate.
3. Open MyCut shot review: verify image thumbnails, image order, computed image duration, and manual up/down/reorder/lock. Confirm image timeline covers narration gaps seamlessly.
4. Click Export > confirm **final** order > Save As a **new** `.mycut` path. Verify success. Try the same path again: existing bytes must remain unchanged and export must refuse overwrite.
5. Open the generated project in installed MyCut 1.0.1 (not just JSON parser). Confirm all three audio clips and image media show as online; no missing-media dialogs.
6. Play across the first and second voice boundaries. Measure exactly **0.3 seconds** of silence between clips, with no extra gap after the last clip; images must remain continuously visible.
7. Seek to the final frame. Confirm V1 reaches the end of the last voice clip and the project has no stray trailing duration.
8. Export **MP4** using MyCut UI. Play resulting MP4 outside MyCut; verify image changes, intelligible continuous narration, both inter-line pauses, no black frames and no extended ending.
9. Restart MyCut, reopen the same newly generated project, verify clips and sources persist. Confirm project 1019 was not modified.

## Report (fill only after an actual human or GUI automation run)
| Check | Result (PASS/FAIL/NOT RUN) | Evidence / timestamp |
| --- | --- | --- |
| Installer checksum and GUI launch | NOT RUN | |
| Voice preview and speaker order | NOT RUN | |
| Image order/lock and review | NOT RUN | |
| New Save As, existing file not overwritten | NOT RUN | |
| MyCut 1.0.1 opens generated project | NOT RUN | |
| MP3 playback + exactly 0.3-second A1 gaps | NOT RUN | |
| Continuous V1 + correct project end | NOT RUN | |
| MyCut MP4 export and independent playback | NOT RUN | |
| Reopen project; project 1019 preserved | NOT RUN | |

**Release gate:** Do not declare MyCut 1.0.1 GUI interoperability/MP4 complete until the above real-world checks pass with evidence. Unit, IPC and packaging tests alone cannot prove it.
