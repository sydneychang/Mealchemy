import { Hono, type Context, type Next } from "hono";
import {
  buildDetectionPrompt,
  buildRecipePrompt,
  identifyIngredientsRequestSchema,
  identifyIngredientsResponseSchema,
  ingredientDetectionJsonSchema,
  recipeRecommendationJsonSchema,
  recipeRequestSchema,
  recipeResponseSchema
} from "@mealchemy/shared";

type Bindings = {
  OPENAI_API_KEY: string;
  OPENAI_DETECTION_MODEL?: string;
  OPENAI_RECIPE_MODEL?: string;
  ALLOWED_WEB_ORIGINS?: string;
  MAX_REQUEST_BYTES?: string;
  MAX_IMAGE_DATA_URL_BYTES?: string;
  API_RATE_LIMITER?: RateLimit;
};

type OpenAIResponsePayload = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

type AppContext = {
  Bindings: Bindings;
};

const app = new Hono<AppContext>();

const DEFAULT_ALLOWED_WEB_ORIGINS = [
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:19006",
  "http://127.0.0.1:19006",
  "https://mealchemy.health",
  "https://www.mealchemy.health"
];
const DEFAULT_MAX_REQUEST_BYTES = 6_000_000;
const DEFAULT_MAX_IMAGE_DATA_URL_BYTES = 5_000_000;

app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  const allowedOrigin = getAllowedOrigin(c.env, origin);

  if (origin && !allowedOrigin) {
    return c.json(
      {
        ok: false,
        error: "Origin not allowed."
      },
      403
    );
  }

  if (c.req.method === "OPTIONS") {
    const headers = new Headers();
    applyCorsHeaders(headers, allowedOrigin);
    return new Response(null, { status: 204, headers });
  }

  await next();
  applyCorsHeaders(c.res.headers, allowedOrigin);
});

app.use("/identify", applyRateLimit);
app.use("/recipes", applyRateLimit);

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "mealchemy-api",
    routes: ["/identify", "/recipes"]
  })
);

app.post("/identify", async (c) => {
  const rawBody = await c.req.text();
  const maxRequestBytes = getMaxBytes(c.env.MAX_REQUEST_BYTES, DEFAULT_MAX_REQUEST_BYTES);

  if (rawBody.length > maxRequestBytes) {
    return c.json(
      {
        ok: false,
        error: `Request body exceeds ${maxRequestBytes} bytes.`
      },
      413
    );
  }

  const parsedJson = parseJsonBody(rawBody);
  if (parsedJson instanceof Response) {
    return parsedJson;
  }

  const payloadResult = identifyIngredientsRequestSchema.safeParse(parsedJson);
  if (!payloadResult.success) {
    return c.json(
      {
        ok: false,
        error: "Invalid identify request body."
      },
      400
    );
  }

  const payload = payloadResult.data;
  const maxImageDataUrlBytes = getMaxBytes(
    c.env.MAX_IMAGE_DATA_URL_BYTES,
    DEFAULT_MAX_IMAGE_DATA_URL_BYTES
  );

  if (!payload.imageDataUrl.startsWith("data:image/")) {
    return c.json(
      {
        ok: false,
        error: "Image must be sent as a data URL."
      },
      400
    );
  }

  if (payload.imageDataUrl.length > maxImageDataUrlBytes) {
    return c.json(
      {
        ok: false,
        error: `Image payload exceeds ${maxImageDataUrlBytes} bytes. Compress or crop the image and try again.`
      },
      413
    );
  }

  const result = await callStructuredOpenAI({
    apiKey: c.env.OPENAI_API_KEY,
    model: c.env.OPENAI_DETECTION_MODEL || "gpt-4.1-mini",
    formatName: "ingredient_detection",
    schema: ingredientDetectionJsonSchema,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: buildDetectionPrompt(payload.existingItems)
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Identify visible food items from this fridge image."
          },
          {
            type: "input_image",
            image_url: payload.imageDataUrl,
            detail: "low"
          }
        ]
      }
    ]
  });

  const parsed = identifyIngredientsResponseSchema.parse(result);
  return c.json(parsed);
});

app.post("/recipes", async (c) => {
  const rawBody = await c.req.text();
  const maxRequestBytes = getMaxBytes(c.env.MAX_REQUEST_BYTES, DEFAULT_MAX_REQUEST_BYTES);

  if (rawBody.length > maxRequestBytes) {
    return c.json(
      {
        ok: false,
        error: `Request body exceeds ${maxRequestBytes} bytes.`
      },
      413
    );
  }

  const parsedJson = parseJsonBody(rawBody);
  if (parsedJson instanceof Response) {
    return parsedJson;
  }

  const payloadResult = recipeRequestSchema.safeParse(parsedJson);
  if (!payloadResult.success) {
    return c.json(
      {
        ok: false,
        error: "Invalid recipe request body."
      },
      400
    );
  }

  const payload = payloadResult.data;
  const result = await callStructuredOpenAI({
    apiKey: c.env.OPENAI_API_KEY,
    model: c.env.OPENAI_RECIPE_MODEL || "gpt-5-mini",
    formatName: "recipe_recommendations",
    schema: recipeRecommendationJsonSchema,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: buildRecipePrompt(payload)
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Recommend recipes based on the pantry list."
          }
        ]
      }
    ]
  });

  const parsed = recipeResponseSchema.parse(result);
  return c.json(parsed);
});

app.onError((error, c) => {
  console.error(error);
  return c.json(
    {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error"
    },
    500
  );
});

async function callStructuredOpenAI(args: {
  apiKey: string;
  model: string;
  formatName: string;
  schema: unknown;
  input: unknown[];
}) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${args.apiKey}`
    },
    body: JSON.stringify({
      model: args.model,
      input: args.input,
      text: {
        format: {
          type: "json_schema",
          name: args.formatName,
          strict: true,
          schema: args.schema
        }
      }
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${message}`);
  }

  const json = (await response.json()) as OpenAIResponsePayload;
  const outputText = extractOutputText(json);

  if (!outputText) {
    throw new Error("OpenAI response did not contain any output text");
  }

  return JSON.parse(outputText);
}

function extractOutputText(response: OpenAIResponsePayload) {
  const textParts: string[] = [];

  for (const outputItem of response.output ?? []) {
    for (const contentItem of outputItem.content ?? []) {
      if (contentItem.type === "output_text" && contentItem.text) {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("").trim();
}

async function applyRateLimit(c: Context<AppContext>, next: Next) {
  if (c.env.API_RATE_LIMITER) {
    const clientIp = getClientIp(c.req.raw);
    const key = `${c.req.path}:${clientIp}`;
    const { success } = await c.env.API_RATE_LIMITER.limit({ key });

    if (!success) {
      return c.json(
        {
          ok: false,
          error: "Too many requests. Please wait a minute and try again."
        },
        429
      );
    }
  }

  await next();
}

function getAllowedOrigin(env: Bindings, origin?: string) {
  if (!origin) {
    return null;
  }

  const allowedOrigins = new Set(
    (env.ALLOWED_WEB_ORIGINS || DEFAULT_ALLOWED_WEB_ORIGINS.join(","))
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );

  return allowedOrigins.has(origin) ? origin : null;
}

function applyCorsHeaders(headers: Headers, allowedOrigin: string | null) {
  headers.set("Vary", "Origin");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
}

function getMaxBytes(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseJsonBody(rawBody: string) {
  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return Response.json(
      {
        ok: false,
        error: "Request body must be valid JSON."
      },
      { status: 400 }
    );
  }
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export default app;
