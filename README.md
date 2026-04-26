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

## Demo Walkthrough

**1. Upload and identify**

Upload a fridge photo and let the app detect visible ingredients, summarize what it found, and call out uncertain items for review.

![Upload and identify ingredients](demo%20pics/upload.png)

**2. Edit the pantry**

Review the detected ingredients, adjust names or quantities, remove bad guesses, and add anything the model missed.

![Edit pantry items](demo%20pics/edit.png)

**3. Set recipe preferences**

Choose cuisines to prioritize, add a health angle, and set servings before generating recipes.

![Select cuisine and health preferences](demo%20pics/cuisine%20select.png)

**4. Review recipe suggestions**

The app returns recipe ideas that use what is already in the fridge while keeping missing ingredients modest.

![Recipe results overview](demo%20pics/results%201.png)

**5. Open a full recipe**

Each recipe includes a quick description, health angle, missing ingredients, waste-reduction rationale, and step-by-step instructions.

![Detailed recipe card](demo%20pics/results%202.png)

**6. Use the shopping tips**

The results also include practical follow-up tips to stretch ingredients further and reduce waste in future meals.

![Smart shopping tips](demo%20pics/results%203.png)

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

## Regen Android Folder
```cd /Users/sydneychang/Desktop/Mealchemy
pnpm install
cd apps/app
pnpm exec expo prebuild -p android
```
or clean

```cd /Users/sydneychang/Desktop/Mealchemy/apps/app
pnpm exec expo prebuild --clean -p android
```

run on emulator:
```cd /Users/sydneychang/Desktop/Mealchemy
pnpm --filter @mealchemy/app android
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
