# Mealchemy
https://devpost.com/software/mealchemy
Mealchemy is a hackathon-ready Android + web app that turns a fridge photo into:

- an editable pantry list
- cuisine-aware recipe suggestions
- healthier, waste-reducing meal ideas

https://mealchemy.health/

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
https://www.youtube.com/shorts/iikT3TA1V3U

**1. Start with the Mealchemy intro**

The home screen sets up the promise of the app right away: turn a fridge photo into recipes that actually use what you already have.

![Mealchemy intro screen](demo%20pics/intro.png)

**2. Upload and identify**

Upload a fridge photo and let the app detect visible ingredients, summarize what it found, and call out uncertain items for review.

![Upload and identify ingredients](demo%20pics/upload.png)

**3. Review the pantry grid**

Detected ingredients appear as individual pantry cards so you can quickly scan categories, quantities, and perishability.

![Pantry editor grid](demo%20pics/edit%20pantry.png)

**4. Make manual pantry edits**

Adjust names or quantities, remove bad guesses, and add anything the model missed before recipe generation.

![Manual pantry edits](demo%20pics/manual%20edits.png)

**5. Set recipe preferences**

Choose cuisines to prioritize, add a health angle, and set servings before generating recipes.

![Select cuisine and health preferences](demo%20pics/cuisine%20select.png)

**6. Review recipe suggestions**

The app returns recipe ideas that use what is already in the fridge while keeping missing ingredients modest.

![Recipe results overview](demo%20pics/results%201.png)

**7. Open a full recipe**

Each recipe includes a quick description, health angle, missing ingredients, waste-reduction rationale, and step-by-step instructions.

![Detailed recipe card](demo%20pics/results%202.png)

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

For Cloudflare deployment, set the secret with Wrangler:

```bash
cd apps/api
pnpm wrangler secret put OPENAI_API_KEY
```

## Build dist command

```EXPO_PUBLIC_API_URL=https://mealchemy-api.syd2chang.workers.dev pnpm --filter @mealchemy/app exec expo export --platform web
```

Copy app/dist file to Cloudflare pages (create deployment)

## Redeploy API worker (not just web app)
```cd /Users/sydneychang/Desktop/Mealchemy/apps/api
pnpm wrangler deploy
```

Check status on Cloudflare Workers page

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


# Mealchemy Repo Overview

## What Each Tool Is Doing

- **pnpm**  
  Workspace/package manager. Links `apps/*` and `packages/*` so both app and API can import `@mealchemy/shared`.

- **Expo**  
  Frontend runtime/build system. Enables one React Native codebase to run on Android and web. Entry: `apps/app/app/index.tsx`.

- **React Native**  
  UI layer used by Expo. The home screen is a single screen handling upload, pantry editing, cuisine selection, and recipe results.

- **expo-router**  
  File-based routing for the Expo app. Minimal setup with `_layout.tsx` and `index.tsx`.

- **Wrangler**  
  Cloudflare CLI. Runs the Worker locally (`wrangler dev`) and deploys it (`wrangler deploy`). Configured in `apps/api/package.json`.

- **Cloudflare Workers**  
  Backend hosting target. Config in `apps/api/wrangler.toml`. API code in `apps/api/src/index.ts`.

- **Hono**  
  Lightweight web framework inside the Worker (Express-style routing for Workers).

- **Zod**  
  Runtime validation for request/response schemas. Located in `packages/shared/src/schemas.ts`.

- **OpenAI Responses API**  
  Used by the Worker for image understanding and recipe generation (`apps/api/src/index.ts`).

---

## How The Repo Fits Together

- **`apps/app/app/index.tsx`**  
  User-facing app. Handles:
  - Image upload and compression
  - Sending image to `/identify`
  - Pantry editing
  - Sending pantry to `/recipes`

- **`apps/api/src/index.ts`**  
  Server layer. Handles:
  - Keeping OpenAI API key secure
  - CORS
  - Payload size checks
  - Rate limiting (`/identify`, `/recipes`)
  - Enforcing structured JSON responses

- **`packages/shared/src/schemas.ts`**  
  Shared contract between app and API:
  - Pantry item types
  - Cuisine options
  - Health options
  - API response shapes

- **`packages/shared/src/prompts.ts`**  
  Prompt-building logic for:
  - Ingredient detection
  - Recipe generation

- **`tsconfig.base.json`**  
  Provides shared path alias for importing `@mealchemy/shared` across the repo
