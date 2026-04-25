import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type {
  CuisineOption,
  HealthOption,
  IdentifyIngredientsResponse,
  PantryItem,
  RecipeResponse
} from "@mealchemy/shared";
import { cuisineOptions, healthOptions } from "@mealchemy/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://127.0.0.1:8787";

export default function HomeScreen() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [uncertainItems, setUncertainItems] = useState<string[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [recipes, setRecipes] = useState<RecipeResponse["recipes"]>([]);
  const [shoppingTips, setShoppingTips] = useState<string[]>([]);
  const [preferredCuisines, setPreferredCuisines] = useState<CuisineOption[]>([
    "Mediterranean",
    "Japanese"
  ]);
  const [healthGoals, setHealthGoals] = useState<HealthOption[]>(["Balanced"]);
  const [manualName, setManualName] = useState("");
  const [manualQuantity, setManualQuantity] = useState("");
  const [servings, setServings] = useState("2");
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pantryCoverage = useMemo(() => {
    if (!recipes.length) {
      return null;
    }

    return Math.round(
      (recipes.reduce((sum, recipe) => sum + recipe.pantryCoverage, 0) / recipes.length) * 100
    );
  }, [recipes]);

  async function pickImage() {
    setError(null);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true
    });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.base64) {
      setError("The selected image could not be processed.");
      return;
    }

    const mimeType = asset.mimeType || "image/jpeg";
    setImageDataUrl(`data:${mimeType};base64,${asset.base64}`);
    setRecipes([]);
    setShoppingTips([]);
  }

  async function identifyItems() {
    if (!imageDataUrl) {
      setError("Upload a fridge photo first.");
      return;
    }

    setError(null);
    setIsIdentifying(true);

    try {
      const response = await fetch(`${API_URL}/identify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          imageDataUrl,
          existingItems: pantry
        })
      });

      const payload = (await response.json()) as IdentifyIngredientsResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Ingredient detection failed.");
      }

      setPantry(payload.items);
      setUncertainItems(payload.uncertainItems);
      setSummary(payload.summary);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ingredient detection failed.");
    } finally {
      setIsIdentifying(false);
    }
  }

  async function generateRecipes() {
    if (!pantry.length) {
      setError("Add or detect at least one pantry item first.");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      const response = await fetch(`${API_URL}/recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          pantry,
          preferredCuisines,
          healthGoals,
          servings: Number(servings) || 2
        })
      });

      const payload = (await response.json()) as RecipeResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Recipe generation failed.");
      }

      setRecipes(payload.recipes);
      setShoppingTips(payload.shoppingTips);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Recipe generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }

  function toggleCuisine(value: CuisineOption) {
    setPreferredCuisines((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function toggleHealthGoal(value: HealthOption) {
    setHealthGoals((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  function updatePantryItem(id: string, field: keyof PantryItem, value: string) {
    setPantry((current) =>
      current.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  function removePantryItem(id: string) {
    setPantry((current) => current.filter((item) => item.id !== id));
  }

  function addManualItem() {
    if (!manualName.trim() || !manualQuantity.trim()) {
      setError("Enter an item name and quantity.");
      return;
    }

    setPantry((current) => [
      ...current,
      {
        id: `manual-${Date.now()}`,
        name: manualName.trim(),
        quantity: manualQuantity.trim(),
        perishability: "medium",
        category: "ingredient"
      }
    ]);
    setManualName("");
    setManualQuantity("");
    setError(null);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>Mealchemy</Text>
          <Text style={styles.title}>Turn a fridge photo into recipes that actually use what you have.</Text>
          <Text style={styles.subtitle}>
            Scan ingredients, fix the pantry list manually, then generate cuisine-aware recipes that
            lean tasty and healthy while reducing waste.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Upload a Fridge Photo</Text>
          <Pressable style={styles.primaryButton} onPress={pickImage}>
            <Text style={styles.primaryButtonText}>Choose Image</Text>
          </Pressable>
          {imageDataUrl ? <Image source={{ uri: imageDataUrl }} style={styles.previewImage} /> : null}
          <Pressable
            style={[styles.secondaryButton, !imageDataUrl && styles.buttonDisabled]}
            onPress={identifyItems}
            disabled={!imageDataUrl || isIdentifying}
          >
            {isIdentifying ? (
              <ActivityIndicator color="#123524" />
            ) : (
              <Text style={styles.secondaryButtonText}>Identify Ingredients</Text>
            )}
          </Pressable>
          {summary ? <Text style={styles.helperText}>{summary}</Text> : null}
          {uncertainItems.length ? (
            <Text style={styles.helperText}>
              Uncertain: {uncertainItems.join(", ")}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Edit Pantry</Text>
          {pantry.map((item) => (
            <View key={item.id} style={styles.pantryRow}>
              <View style={styles.pantryFields}>
                <TextInput
                  value={item.name}
                  onChangeText={(value) => updatePantryItem(item.id, "name", value)}
                  placeholder="Ingredient"
                  style={styles.input}
                />
                <TextInput
                  value={item.quantity}
                  onChangeText={(value) => updatePantryItem(item.id, "quantity", value)}
                  placeholder="Quantity"
                  style={styles.input}
                />
              </View>
              <Pressable style={styles.removeButton} onPress={() => removePantryItem(item.id)}>
                <Text style={styles.removeButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}

          <View style={styles.inlineInputs}>
            <TextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Add item"
              style={styles.input}
            />
            <TextInput
              value={manualQuantity}
              onChangeText={setManualQuantity}
              placeholder="Qty"
              style={styles.input}
            />
          </View>
          <Pressable style={styles.secondaryButton} onPress={addManualItem}>
            <Text style={styles.secondaryButtonText}>Add Manually</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Recipe Preferences</Text>
          <Text style={styles.label}>Prioritize cuisines</Text>
          <View style={styles.chipWrap}>
            {cuisineOptions.map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.chip,
                  preferredCuisines.includes(option) && styles.chipActive
                ]}
                onPress={() => toggleCuisine(option)}
              >
                <Text
                  style={[
                    styles.chipText,
                    preferredCuisines.includes(option) && styles.chipTextActive
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Health angle</Text>
          <View style={styles.chipWrap}>
            {healthOptions.map((option) => (
              <Pressable
                key={option}
                style={[styles.chip, healthGoals.includes(option) && styles.chipActive]}
                onPress={() => toggleHealthGoal(option)}
              >
                <Text
                  style={[
                    styles.chipText,
                    healthGoals.includes(option) && styles.chipTextActive
                  ]}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Servings</Text>
          <TextInput
            value={servings}
            onChangeText={setServings}
            keyboardType="number-pad"
            style={styles.input}
          />

          <Pressable
            style={[styles.primaryButton, !pantry.length && styles.buttonDisabled]}
            onPress={generateRecipes}
            disabled={!pantry.length || isGenerating}
          >
            {isGenerating ? (
              <ActivityIndicator color="#f6f0e5" />
            ) : (
              <Text style={styles.primaryButtonText}>Generate Recipes</Text>
            )}
          </Pressable>
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {recipes.length ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>4. Recipe Results</Text>
            {pantryCoverage !== null ? (
              <Text style={styles.helperText}>
                Average pantry coverage: {pantryCoverage}%
              </Text>
            ) : null}
            {recipes.map((recipe) => (
              <View key={recipe.title} style={styles.recipeCard}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                <Text style={styles.recipeMeta}>
                  {recipe.cuisine} · {recipe.timeMinutes} min · {Math.round(recipe.pantryCoverage * 100)}%
                  pantry coverage
                </Text>
                <Text style={styles.recipeDescription}>{recipe.description}</Text>
                <Text style={styles.recipeMeta}>Health angle: {recipe.healthAngle}</Text>
                <Text style={styles.recipeMeta}>
                  Uses: {recipe.ingredientsUsed.join(", ")}
                </Text>
                {recipe.missingIngredients.length ? (
                  <Text style={styles.recipeMeta}>
                    Missing: {recipe.missingIngredients.join(", ")}
                  </Text>
                ) : null}
                <Text style={styles.recipeMeta}>
                  Waste win: {recipe.whyThisReducesWaste}
                </Text>
                {recipe.steps.map((step, index) => (
                  <Text key={`${recipe.title}-${index}`} style={styles.step}>
                    {index + 1}. {step}
                  </Text>
                ))}
              </View>
            ))}
            {shoppingTips.length ? (
              <View style={styles.tipsBlock}>
                <Text style={styles.label}>Smart shopping tips</Text>
                {shoppingTips.map((tip, index) => (
                  <Text key={`${tip}-${index}`} style={styles.step}>
                    • {tip}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f6f0e5"
  },
  container: {
    padding: 20,
    gap: 16
  },
  hero: {
    backgroundColor: "#123524",
    padding: 24,
    borderRadius: 24,
    gap: 10
  },
  kicker: {
    color: "#d7f171",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36
  },
  subtitle: {
    color: "#dbe7df",
    fontSize: 16,
    lineHeight: 24
  },
  card: {
    backgroundColor: "#fffaf2",
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#e7dcc7"
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#123524"
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3d4b41"
  },
  primaryButton: {
    backgroundColor: "#123524",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#f6f0e5",
    fontSize: 16,
    fontWeight: "700"
  },
  secondaryButton: {
    backgroundColor: "#d7f171",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center"
  },
  secondaryButtonText: {
    color: "#123524",
    fontSize: 16,
    fontWeight: "700"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  previewImage: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: "#ddd"
  },
  helperText: {
    color: "#51605a",
    lineHeight: 22
  },
  pantryRow: {
    gap: 10
  },
  pantryFields: {
    gap: 10
  },
  inlineInputs: {
    gap: 10
  },
  input: {
    borderWidth: 1,
    borderColor: "#d4c8b2",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff"
  },
  removeButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#efe5d4"
  },
  removeButtonText: {
    color: "#7d3d2b",
    fontWeight: "700"
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbbca2",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "#fff"
  },
  chipActive: {
    backgroundColor: "#123524",
    borderColor: "#123524"
  },
  chipText: {
    color: "#123524",
    fontWeight: "600"
  },
  chipTextActive: {
    color: "#f6f0e5"
  },
  errorCard: {
    backgroundColor: "#ffe5df",
    borderRadius: 16,
    padding: 16
  },
  errorText: {
    color: "#892f1f",
    fontWeight: "700"
  },
  recipeCard: {
    gap: 8,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "#f3eddc"
  },
  recipeTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#123524"
  },
  recipeMeta: {
    color: "#45544c",
    lineHeight: 21
  },
  recipeDescription: {
    color: "#22322a",
    fontSize: 15,
    lineHeight: 22
  },
  step: {
    color: "#22322a",
    lineHeight: 22
  },
  tipsBlock: {
    gap: 6
  }
});
