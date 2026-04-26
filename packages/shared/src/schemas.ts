import { z } from "zod";

export const cuisineOptions = [
  "American",
  "Chinese",
  "French",
  "Indian",
  "Italian",
  "Japanese",
  "Korean",
  "Mediterranean",
  "Mexican",
  "Thai",
  "Vietnamese"
] as const;

export const healthOptions = [
  "High protein",
  "High fiber",
  "Lower carb",
  "Vegetable forward",
  "Vegetarian",
  "Balanced"
] as const;

export const pantryItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  quantity: z.string().min(1),
  confidence: z.number().min(0).max(1).nullable().optional(),
  perishability: z.enum(["high", "medium", "low"]).default("medium"),
  category: z.string().min(1).default("ingredient"),
  notes: z.string().nullable().optional()
});

export const identifyIngredientsRequestSchema = z.object({
  imageDataUrl: z.string().min(1),
  existingItems: z.array(pantryItemSchema).default([])
});

export const identifyIngredientsResponseSchema = z.object({
  items: z.array(pantryItemSchema),
  uncertainItems: z.array(z.string()).default([]),
  summary: z.string().min(1)
});

export const recipeRequestSchema = z.object({
  pantry: z.array(pantryItemSchema).min(1),
  preferredCuisines: z.array(z.enum(cuisineOptions)).default([]),
  healthGoals: z.array(z.enum(healthOptions)).default([]),
  servings: z.number().int().min(1).max(8).default(2)
});

export const recipeSchema = z.object({
  title: z.string().min(1),
  cuisine: z.string().min(1),
  description: z.string().min(1),
  timeMinutes: z.number().int().min(5).max(240),
  healthAngle: z.string().min(1),
  ingredientsUsed: z.array(z.string()).min(1),
  missingIngredients: z.array(z.string()).default([]),
  steps: z.array(z.string()).min(2),
  whyThisReducesWaste: z.string().min(1)
});

export const recipeResponseSchema = z.object({
  recipes: z.array(recipeSchema).length(3),
  shoppingTips: z.array(z.string()).max(5).default([])
});

export type CuisineOption = (typeof cuisineOptions)[number];
export type HealthOption = (typeof healthOptions)[number];
export type PantryItem = z.infer<typeof pantryItemSchema>;
export type IdentifyIngredientsRequest = z.infer<typeof identifyIngredientsRequestSchema>;
export type IdentifyIngredientsResponse = z.infer<typeof identifyIngredientsResponseSchema>;
export type RecipeRequest = z.infer<typeof recipeRequestSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type RecipeResponse = z.infer<typeof recipeResponseSchema>;

export const ingredientDetectionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["items", "uncertainItems", "summary"],
  properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "name",
            "quantity",
            "confidence",
            "perishability",
            "category",
            "notes"
          ],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            quantity: { type: "string" },
            confidence: {
              type: ["number", "null"]
            },
            perishability: {
              type: "string",
              enum: ["high", "medium", "low"]
            },
            category: { type: "string" },
            notes: {
              type: ["string", "null"]
            }
          }
        }
      },
    uncertainItems: {
      type: "array",
      items: { type: "string" }
    },
    summary: { type: "string" }
  }
} as const;

export const recipeRecommendationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["recipes", "shoppingTips"],
  properties: {
    recipes: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title",
          "cuisine",
          "description",
          "timeMinutes",
          "healthAngle",
          "ingredientsUsed",
          "missingIngredients",
          "steps",
          "whyThisReducesWaste"
        ],
        properties: {
          title: { type: "string" },
          cuisine: { type: "string" },
          description: { type: "string" },
          timeMinutes: { type: "number" },
          healthAngle: { type: "string" },
          ingredientsUsed: {
            type: "array",
            items: { type: "string" }
          },
          missingIngredients: {
            type: "array",
            items: { type: "string" }
          },
          steps: {
            type: "array",
            items: { type: "string" }
          },
          whyThisReducesWaste: { type: "string" }
        }
      }
    },
    shoppingTips: {
      type: "array",
      items: { type: "string" }
    }
  }
} as const;
