const VEGAN_TAGS = new Set(["vegan"]);
const VEGETARIAN_TAGS = new Set(["vegetarian", "jain", "sattvic"]);

export function parseDietTag(raw: string): string {
  return raw.toLowerCase().replace(/^diet_type:/, "").trim();
}

export function resolveDietPreference(restrictions: string[]): string | null {
  const tags = (restrictions || []).map(parseDietTag);
  if (tags.some(t => VEGAN_TAGS.has(t))) return "vegan";
  if (tags.some(t => VEGETARIAN_TAGS.has(t))) return "vegetarian";
  return null;
}
