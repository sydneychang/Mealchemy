import { Hono } from "hono";
import { cors } from "hono/cors";
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
};

type OpenAIResponsePayload = {
  output_text?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("*", cors());

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "mealchemy-api",
    routes: ["/identify", "/recipes"]
  })
);

app.post("/identify", async (c) => {
  const payload = identifyIngredientsRequestSchema.parse(await c.req.json());
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
  const payload = recipeRequestSchema.parse(await c.req.json());
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
  if (!json.output_text) {
    throw new Error("OpenAI response did not contain output_text");
  }

  return JSON.parse(json.output_text);
}

export default app;
