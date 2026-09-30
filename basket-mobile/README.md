# Basket Studio — Cloudflare Worker mobile app

A standalone lightweight mobile app within an isolated folder and branch. One Worker serves the Thai-language interface and a secure /api/analyze endpoint. Intended for a single owner.

## Setup
1. In Cloudflare Workers, connect GitHub repository `gananajak-lgtm-ai-video-editor` and choose `feature/mobile-basket-studio`. Project root: `basket-mobile`.
2. Build command: none. Deploy command: `npx wrangler deploy` (or use Workers Builds).
3. Set encrypted Worker secrets `OPENAI_API_KEY` and `APP_ACCESS_PIN` (a random 12+ character PIN). Never commit either secret.
4. Open `https://gananajak-basket-studio.<your-subdomain>.workers.dev`, upload a product screenshot, enter your PIN, choose 30 or 60 seconds, and generate Thai captions and Meta AI shot prompts.
5. Open Meta AI via the button. The app cannot auto-fill prompts into a third-party app or stitch the returned videos. TikTok product-link selection must be performed in the TikTok app.

No automatic marketplace scraping. OpenAI API billing is separate from ChatGPT subscription. Review product claims and speech before posting. The screenshot is transmitted to OpenAI for analysis. Soft in-memory rate limits are not a hard spending cap; configure budgets/rate limits in your account for production use.

For local development: `npx wrangler dev`. Health endpoint `/api/health` reports whether secrets are configured (never reveals them).

Cloudflare Workers Builds production configuration: branch `feature/mobile-basket-studio`, root directory `/basket-mobile`, deploy command `npx wrangler deploy`, and Worker name `gananajak-basket-studio`. This documentation update also triggers a new production-branch build after Cloudflare Branch control is saved.
