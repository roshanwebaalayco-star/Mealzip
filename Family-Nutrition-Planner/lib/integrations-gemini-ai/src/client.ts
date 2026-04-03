import { GoogleGenAI } from "@google/genai";

const integrationApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const directApiKey = process.env.GEMINI_API_KEY;

export function isModelfarm(): boolean {
  return !!(integrationApiKey && integrationBaseUrl) && !directApiKey;
}

function getAI(): GoogleGenAI {
  if (directApiKey) {
    return new GoogleGenAI({ apiKey: directApiKey });
  }
  if (integrationApiKey && integrationBaseUrl) {
    return new GoogleGenAI({
      apiKey: integrationApiKey,
      httpOptions: {
        apiVersion: "",
        baseUrl: integrationBaseUrl,
      },
    });
  }
  throw new Error(
    "Gemini AI not configured. Set GEMINI_API_KEY or configure the Gemini integration (AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY)."
  );
}

const mode = directApiKey ? "Direct API Key" : isModelfarm() ? "Replit Integration (modelfarm)" : "NOT CONFIGURED";
console.log(`[Gemini AI] Mode: ${mode}`);

export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    const instance = getAI();
    const value = instance[prop as keyof GoogleGenAI];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
