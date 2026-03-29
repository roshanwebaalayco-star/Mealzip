export const INDIAN_LANGUAGES = [
  { key: "english", label: "English" },
  { key: "hindi", label: "हिंदी" },
  { key: "bengali", label: "বাংলা" },
  { key: "tamil", label: "தமிழ்" },
  { key: "telugu", label: "తెలుగు" },
  { key: "marathi", label: "मराठी" },
  { key: "gujarati", label: "ગુજરાતી" },
  { key: "kannada", label: "ಕನ್ನಡ" },
  { key: "malayalam", label: "മലയാളം" },
  { key: "punjabi", label: "ਪੰਜਾਬੀ" },
  { key: "odia", label: "ଓଡ଼ିଆ" },
] as const;

export const LANG_TO_BCP47: Record<string, string> = {
  hindi: "hi-IN",
  english: "en-IN",
  bengali: "bn-IN",
  tamil: "ta-IN",
  telugu: "te-IN",
  marathi: "mr-IN",
  gujarati: "gu-IN",
  kannada: "kn-IN",
  malayalam: "ml-IN",
  punjabi: "pa-IN",
  odia: "or-IN",
};
