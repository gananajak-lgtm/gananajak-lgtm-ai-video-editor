# AutoSeller cross-device handoff — 2026-10-20
- Decision: standalone AI Affiliate AutoSeller application, not a second timeline editor; integrate with existing AI Video Editor + MyCut via a future MP4 export manifest bridge.
- Work branch: `feature/affiliate-autoseller-standalone` in `gananajak-lgtm/gananajak-lgtm-ai-video-editor`; code under `apps/affiliate-autoseller/`. **Separate runnable app, not yet a separate GitHub repository.**
- Existing AI Video Editor handoff: `AI_VIDEO_MYCUT_HANDOFF.md`; source branch `feature/script-speaker-parser`. Do not alter project 1019 or claim MyCut GUI playback has been verified.
- New MVP: local product tracking, clip jobs, approve and record manual published URLs, lightweight dashboard and Node test suite.
- TikTok policy decision: no replaying recorded content as unattended LIVE; no claims of automatic affiliate product tagging or publishing API access.
- CI: new standalone app is not yet added to main workflow; test locally with `cd apps/affiliate-autoseller && npm test && npm start`. Confirm CI and functional browser check separately; not yet verified.
- Next: add local MP4 import handshake with explicit consent and filename/path validation; integrate non-destructively with MyCut export; implement clip previews, availability checks, scheduled editorial calendar, product relevance and performance metrics; add CI test job; verify actual creator permissions for TikTok.
- Always fresh-fetch HEAD and both handoffs before edits; commit changes and update this handoff every session. Document actual commit SHA and CI status after verification, never invent status.

## Checkpoint — standalone MVP + CI workflow
- Standalone app files committed through `76311bec`; local data ignore commit `e89bad4`; standalone GitHub Actions workflow commit `e1961fc`.
- Node built-in HTTP service, no third-party runtime dependencies. App is a separate process/package within the existing GitHub repository, **not yet a dedicated GitHub repo or deployed public service**.
- Added `.github/workflows/affiliate-autoseller.yml` to run `npm test` on branch push and PR changes.
- Verification: GitHub create-file writes confirmed. Manual `git clone` / `npm test` in assistant environment could **not** run because that environment had no GitHub DNS/network access. CI results are not yet observed; do not claim tests passed.
- Next developer: check fresh HEAD + Actions run and inspect failures; test `npm test`, `npm start` + browser. Add integration tests for persistence and POST API. Expand bridge only after reviewing current MyCut export API and explicit user consent.
