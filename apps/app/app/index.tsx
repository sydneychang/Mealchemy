import { useState } from "react";
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
import * as ImageManipulator from "expo-image-manipulator";
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
const MAX_UPLOAD_IMAGE_BYTES = Number(process.env.EXPO_PUBLIC_MAX_IMAGE_DATA_URL_BYTES || 4_500_000);
const INITIAL_MAX_IMAGE_DIMENSION = 1600;
const MIN_IMAGE_DIMENSION = 600;
const IMAGE_COMPRESSION_LEVELS = [0.72, 0.58, 0.44, 0.32, 0.24];
const BRAND_LOGO = require("../assets/brand/logo.png");

export default function HomeScreen() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
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
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickImage() {
    setError(null);
    setImageNotice(null);

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1
    });

    if (result.canceled) {
      return;
    }

    setIsPreparingImage(true);

    try {
      const asset = result.assets[0];
      const preparedImage = await prepareImageForUpload(asset);
      setImageDataUrl(preparedImage.dataUrl);
      setImageNotice(preparedImage.notice);
      setRecipes([]);
      setShoppingTips([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The selected image could not be processed.");
    } finally {
      setIsPreparingImage(false);
    }
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
          <View style={styles.heroLogoFrame}>
            <Image source={BRAND_LOGO} style={styles.heroLogo} resizeMode="contain" />
          </View>
          <Text style={styles.title}>Turn a fridge photo into recipes that actually use what you have.</Text>
          <Text style={styles.subtitle}>
            Scan ingredients, fix the pantry list manually, then generate cuisine-aware recipes that
            lean tasty and healthy while reducing waste.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Upload a Fridge Photo</Text>
          <Pressable
            style={[styles.primaryButton, isPreparingImage && styles.buttonDisabled]}
            onPress={pickImage}
            disabled={isPreparingImage}
          >
            {isPreparingImage ? (
              <ActivityIndicator color="#f6f0e5" />
            ) : (
              <Text style={styles.primaryButtonText}>Choose Image</Text>
            )}
          </Pressable>
          {imageDataUrl ? <Image source={{ uri: imageDataUrl }} style={styles.previewImage} /> : null}
          {imageNotice ? <Text style={styles.helperText}>{imageNotice}</Text> : null}
          <Pressable
            style={[styles.secondaryButton, !imageDataUrl && styles.buttonDisabled]}
            onPress={identifyItems}
            disabled={!imageDataUrl || isIdentifying || isPreparingImage}
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
          {pantry.length ? (
            <View style={styles.pantryGrid}>
              {pantry.map((item) => (
                <View key={item.id} style={styles.pantryItemCard}>
                  <View style={styles.pantryCardHeader}>
                    <View style={styles.pantryMeta}>
                      <Text style={styles.pantryMetaBadge}>{item.category}</Text>
                      <Text style={styles.pantryMetaText}>{item.perishability} perishability</Text>
                    </View>
                    <Pressable style={styles.removeButton} onPress={() => removePantryItem(item.id)}>
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </Pressable>
                  </View>

                  <View style={styles.pantryFields}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Ingredient</Text>
                      <TextInput
                        value={item.name}
                        onChangeText={(value) => updatePantryItem(item.id, "name", value)}
                        placeholder="Ingredient"
                        style={styles.input}
                      />
                    </View>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Quantity</Text>
                      <TextInput
                        value={item.quantity}
                        onChangeText={(value) => updatePantryItem(item.id, "quantity", value)}
                        placeholder="Quantity"
                        style={styles.input}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.manualAddCard}>
            <Text style={styles.manualAddTitle}>Add a pantry item manually</Text>
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
              <Pressable style={styles.secondaryButton} onPress={addManualItem}>
                <Text style={styles.secondaryButtonText}>Add Manually</Text>
              </Pressable>
            </View>
          </View>
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
            {recipes.map((recipe) => (
              <View key={recipe.title} style={styles.recipeCard}>
                <Text style={styles.recipeTitle}>{recipe.title}</Text>
                <Text style={styles.recipeMeta}>
                  {recipe.cuisine} · {recipe.timeMinutes} min
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

async function prepareImageForUpload(asset: ImagePicker.ImagePickerAsset) {
  let targetWidth = asset.width || INITIAL_MAX_IMAGE_DIMENSION;
  let targetHeight = asset.height || INITIAL_MAX_IMAGE_DIMENSION;
  const originalLongestSide = Math.max(targetWidth, targetHeight);

  if (originalLongestSide > INITIAL_MAX_IMAGE_DIMENSION) {
    const scale = INITIAL_MAX_IMAGE_DIMENSION / originalLongestSide;
    targetWidth = Math.max(1, Math.round(targetWidth * scale));
    targetHeight = Math.max(1, Math.round(targetHeight * scale));
  }

  for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
    for (const compress of IMAGE_COMPRESSION_LEVELS) {
      const result = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: targetWidth, height: targetHeight } }],
        {
          compress,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true
        }
      );

      if (!result.base64) {
        continue;
      }

      const dataUrl = `data:image/jpeg;base64,${result.base64}`;
      if (dataUrl.length <= MAX_UPLOAD_IMAGE_BYTES) {
        const wasCompressed =
          targetWidth !== (asset.width || targetWidth) ||
          targetHeight !== (asset.height || targetHeight) ||
          compress < IMAGE_COMPRESSION_LEVELS[0] ||
          (asset.mimeType && asset.mimeType !== "image/jpeg");

        return {
          dataUrl,
          notice: wasCompressed
            ? `Image optimized for upload (${result.width}x${result.height}).`
            : "Image ready for upload."
        };
      }
    }

    const nextLongestSide = Math.max(Math.round(Math.max(targetWidth, targetHeight) * 0.8), MIN_IMAGE_DIMENSION);
    const scale = nextLongestSide / Math.max(targetWidth, targetHeight);

    if (scale >= 1) {
      break;
    }

    targetWidth = Math.max(1, Math.round(targetWidth * scale));
    targetHeight = Math.max(1, Math.round(targetHeight * scale));
  }

  throw new Error("This image is still too large after compression. Try cropping tighter or choosing a smaller image.");
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
    gap: 18
  },
  heroLogoFrame: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#fffaf2",
    borderRadius: 24,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e7dcc7"
  },
  heroLogo: {
    width: "100%",
    height: 300
  },
  title: {
    color: "#ffffff",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
    textAlign: "center"
  },
  subtitle: {
    color: "#dbe7df",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center"
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
  pantryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12
  },
  pantryItemCard: {
    flexBasis: "48%",
    flexGrow: 1,
    minWidth: 150,
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd0b8",
    backgroundColor: "#fffcf6"
  },
  pantryCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  pantryMeta: {
    gap: 10
  },
  pantryMetaBadge: {
    alignSelf: "flex-start",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#e8f0ca",
    color: "#365125",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize"
  },
  pantryMetaText: {
    color: "#6b665d",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize"
  },
  pantryFields: {
    gap: 10
  },
  fieldGroup: {
    gap: 6
  },
  fieldLabel: {
    color: "#3d4b41",
    fontSize: 13,
    fontWeight: "700"
  },
  manualAddCard: {
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e7dcc7",
    backgroundColor: "#f8f2e8"
  },
  manualAddTitle: {
    color: "#123524",
    fontSize: 16,
    fontWeight: "800"
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
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "#efe5d4"
  },
  removeButtonText: {
    color: "#7d3d2b",
    fontSize: 12,
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
