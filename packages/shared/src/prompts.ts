import type { PantryItem, RecipeRequest } from "./schemas";

export function buildDetectionPrompt(existingItems: PantryItem[]) {
  const existing = existingItems.length
    ? existingItems.map((item) => `${item.name} (${item.quantity})`).join(", ")
    : "none";

  return [
    "You identify ingredients visible in fridge or pantry photos for a food-waste reduction app.",
    "Return concise ingredient names that a home cook would understand.",
    "Prefer ingredients over branded packaging unless the brand is necessary.",
    "Estimate quantity in simple kitchen language like '2 eggs', 'half bag', or '1 cup'.",
    "Set perishability to high for produce, herbs, dairy, cooked leftovers, and meats that should be used soon.",
    "Use confidence only when reasonably inferable from the image.",
    `Existing pantry items provided by the user: ${existing}.`,
    "If the image is ambiguous, list those in uncertainItems and keep summary short."
  ].join("\n");
}

export function buildRecipePrompt(input: RecipeRequest) {
  const pantry = input.pantry
    .map((item) => `${item.name} (${item.quantity}, perishability: ${item.perishability})`)
    .join(", ");
  const cuisines = input.preferredCuisines.length
    ? input.preferredCuisines.join(", ")
    : "no special cuisine preference";
  const healthGoals = input.healthGoals.length
    ? input.healthGoals.join(", ")
    : "balanced and tasty";

  return [
    "You create practical recipes for a food-waste reduction assistant called Mealchemy.",
    "Prioritize recipes that use the most perishable items first, but still taste good.",
    "Avoid unrealistic pantry assumptions and keep missing ingredients modest.",
    "Favor healthier recipes when possible without becoming joyless or overly restrictive.",
    `Pantry: ${pantry}.`,
    `Preferred cuisines: ${cuisines}.`,
    `Health goals: ${healthGoals}.`,
    `Desired servings: ${input.servings}.`,
    "Return exactly 3 recipe options with clear steps."
  ].join("\n");
}
