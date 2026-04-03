import { GoogleGenAI } from "@google/genai";

const integrationApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const directApiKey = process.env.GEMINI_API_KEY;

export function isModelfarm(): boolean {
  return !!(integrationApiKey && integrationBaseUrl);
}

function getAI(): GoogleGenAI {
  if (integrationApiKey && integrationBaseUrl) {
    return new GoogleGenAI({
      apiKey: integrationApiKey,
      httpOptions: {
        apiVersion: "",
        baseUrl: integrationBaseUrl,
      },
    });
  }
  if (directApiKey) {
    return new GoogleGenAI({ apiKey: directApiKey });
  }
  throw new Error(
    "Gemini AI not configured. Set GEMINI_API_KEY or configure the Gemini integration (AI_INTEGRATIONS_GEMINI_BASE_URL and AI_INTEGRATIONS_GEMINI_API_KEY)."
  );
}

const _usingModelfarm = isModelfarm();
console.log(`[Gemini AI] Mode: ${_usingModelfarm ? "Replit Integration (modelfarm)" : directApiKey ? "Direct API Key" : "NOT CONFIGURED"}`);

export const ai = new Proxy({} as GoogleGenAI, {
  get(_target, prop) {
    const instance = getAI();
    const value = instance[prop as keyof GoogleGenAI];
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
