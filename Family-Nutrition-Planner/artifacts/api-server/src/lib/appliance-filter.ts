export const APPLIANCE_KEYWORDS: Record<string, string[]> = {
  oven: ["bake", "baked", "baking", "oven", "roast at", "preheat", "180°c", "200°c", "350°f"],
  oven_otg: ["bake", "baked", "baking", "oven", "otg", "roast at", "preheat", "180°c", "200°c", "350°f"],
  microwave: ["microwave", "microwave-safe", "nuke", "reheat in microwave"],
  blender_mixie: ["blend", "blender", "mixie", "grind", "food processor", "puree", "liquidise"],
  idli_stand: ["idli stand", "idli mould", "idli maker", "steam in idli", "idli steamer"],
  air_fryer: ["air fry", "air fryer", "air-fry", "airfry"],
  pressure_cooker: ["pressure cook", "pressure cooker", "whistle", "3 whistles", "2 whistles", "4 whistles"],
  kadai: ["kadai", "kadhai", "wok", "deep fry", "deep-fry", "fry in oil"],
  tawa: ["tawa", "griddle", "flat pan", "skillet", "tava"],
};

export const ALL_APPLIANCES = Object.keys(APPLIANCE_KEYWORDS);

export const detectRequiredAppliances = (
  instructions: string,
  ingredients: string
): string[] => {
  const text = `${instructions} ${ingredients}`.toLowerCase();
  return ALL_APPLIANCES.filter(appliance =>
    APPLIANCE_KEYWORDS[appliance].some(kw => text.includes(kw))
  );
};

export const filterByAppliances = <T extends { instructions?: string | null; ingredients?: string | null }>(
  recipes: T[],
  ownedAppliances: string[]
): T[] => {
  const normalizedOwned = new Set(ownedAppliances);
  if (normalizedOwned.has("oven_otg")) normalizedOwned.add("oven");
  if (normalizedOwned.has("oven")) normalizedOwned.add("oven_otg");
  return recipes.filter(recipe => {
    const required = detectRequiredAppliances(
      recipe.instructions ?? "",
      recipe.ingredients ?? ""
    );
    return required.every(a => normalizedOwned.has(a));
  });
};
