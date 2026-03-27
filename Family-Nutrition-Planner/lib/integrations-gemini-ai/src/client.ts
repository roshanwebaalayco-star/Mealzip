import { GoogleGenAI } from "@google/genai";

function getAI(): GoogleGenAI {
  const baseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Gemini AI not configured. Please set up the Gemini integration (AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY)."
    );
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: "",
      baseUrl,
    },
  });
}

export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    const instance = getAI();
    const value = instance[prop as keyof GoogleGenAI];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
