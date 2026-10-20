# AI Affiliate AutoSeller — independent MVP

Separate runnable application under `apps/affiliate-autoseller` (distinct package, server, UI, local datastore, and test suite). Not embedded in AI Video Editor and does not touch existing MyCut projects.

## Run
Requires Node.js 20+. From this directory:
```sh
npm test
npm start
```
Open http://127.0.0.1:4177 . State persists to `data/autoseller.json` (gitignored via the main repository's rules only if configured; do not commit runtime data).

## Implemented
- Localhost-only HTTP backend, atomic JSON writes and serialized mutations.
- Affiliate product catalogue (HTTPS links, price, commission rate).
- Clip job pipeline: draft → human-approved → manually published; saved TikTok video URL.
- Basic browser interface; basic pure workflow tests.
- Integration boundary for MyCut: register exported MP4 **path only**. No file reading/rendering, automatic MyCut invocation or TikTok uploads yet.

## Safe integration contract (next)
1. AI Video Editor/MyCut exports user-approved MP4.
2. Later connector sends a `render-complete` manifest with export ID, absolute local path, dimensions, and provenance to a protected import endpoint.
3. AutoSeller creates an unapproved clip job. Human checks product claims, pricing, video ownership, and preview.
4. Only approved jobs are published with a TikTok-supported flow; for now publication and product attachment are manual.

## Limits
This MVP is **not** a 24h live rerun system or autonomous TikTok publishing integration. TikTok Affiliate product attachment and account access must be verified before any platform automation is built. No estimated commission is recorded as actual sales. Local machine must be running to access the dashboard.

Security: bind to 127.0.0.1 only. Never expose this HTTP service to the internet or put secrets in the app. Future network access requires auth, CSRF/CORS checks, rate limiting and durable DB.
