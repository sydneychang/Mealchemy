# Mealchemy

Mealchemy is a hackathon-ready Android + web app that turns a fridge photo into:

- an editable pantry list
- cuisine-aware recipe suggestions
- healthier, waste-reducing meal ideas

## Stack

- `apps/app`: Expo app for Android and web
- `apps/api`: Cloudflare Worker API
- `packages/shared`: shared schemas and prompt builders

The current scaffold assumes:

- image understanding via OpenAI vision
- recipe generation via OpenAI text models
- manual pantry editing in the client
- no auth/database yet, to keep the MVP fast

## Quick Start

1. Install dependencies:

```bash
pnpm install
```

2. Copy env values:

```bash
cp .env.example .env
```

3. Start the API locally:

```bash
pnpm dev:api
```

4. Start the Expo app:

```bash
pnpm dev:app
```

## Environment

Root `.env` values used by the scaffold:

```bash
EXPO_PUBLIC_API_URL=http://127.0.0.1:8787
OPENAI_API_KEY=your_openai_api_key
OPENAI_DETECTION_MODEL=gpt-4.1-mini
OPENAI_RECIPE_MODEL=gpt-5-mini
```

For Cloudflare deployment, set the secret with Wrangler:

```bash
cd apps/api
pnpm wrangler secret put OPENAI_API_KEY
```

## App Flow

1. Upload a fridge image.
2. Call `/identify` to extract visible ingredients.
3. Let the user edit quantities or add missing items manually.
4. Pick cuisines and health preferences.
5. Call `/recipes` to generate 3 recipe options.

## Next Build Steps

- add camera capture alongside gallery upload
- add better quantity editing and pantry categories
- add recipe ranking that weights perishability more heavily
- add persistence with Supabase or Firebase if you want accounts/history
- deploy the Worker and point `mealchemy.health` at the web app

## Notes

- This repo is scaffolded to move fast in a hackathon, not to be over-engineered.
- API keys stay in the Worker, not in the app.
- The web experience is intended to run through Expo web from the same app codebase.
