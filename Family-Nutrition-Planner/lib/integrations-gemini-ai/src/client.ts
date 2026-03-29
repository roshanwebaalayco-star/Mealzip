import { GoogleGenAI } from "@google/genai";

const integrationApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
const integrationBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;
const directApiKey = process.env.GEMINI_API_KEY;

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

function isModelfarm(): boolean {
  return !!(integrationApiKey && integrationBaseUrl && !directApiKey);
}

interface GeminiContent {
  role: string;
  parts: Array<{ text: string }>;
}

interface GeminiGenerateContentRequest {
  contents: GeminiContent[];
  generationConfig?: {
    maxOutputTokens?: number;
    responseMimeType?: string;
    temperature?: number;
  };
  systemInstruction?: { parts: Array<{ text: string }> };
}

interface GeminiCandidate {
  content: { role: string; parts: Array<{ text: string }> };
  finishReason: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  text?: string;
}

async function modelfarmGenerateContent(
  model: string,
  request: GeminiGenerateContentRequest,
  abortSignal?: AbortSignal,
): Promise<GeminiResponse> {
  const url = `${integrationBaseUrl}/models/${model}:generateContent`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": integrationApiKey!,
    },
    body: JSON.stringify({
      contents: request.contents,
      generationConfig: request.generationConfig,
      systemInstruction: request.systemInstruction,
    }),
    signal: abortSignal,
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Modelfarm HTTP ${resp.status}: ${errText}`);
  }
  const data = (await resp.json()) as { candidates?: GeminiCandidate[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { candidates: data.candidates, text };
}

const modelfarmProxy = {
  models: {
    generateContent: async (params: {
      model: string;
      contents: GeminiContent[];
      config?: { maxOutputTokens?: number; responseMimeType?: string; temperature?: number };
      abortSignal?: AbortSignal;
    }) => {
      return modelfarmGenerateContent(
        params.model,
        {
          contents: params.contents,
          generationConfig: params.config as GeminiGenerateContentRequest["generationConfig"],
        },
        params.abortSignal,
      );
    },
  },
};

export const ai = isModelfarm()
  ? modelfarmProxy
  : new Proxy({} as GoogleGenAI, {
      get(_target, prop) {
        const instance = getAI();
        const value = instance[prop as keyof GoogleGenAI];
        return typeof value === "function" ? value.bind(instance) : value;
      },
    });
