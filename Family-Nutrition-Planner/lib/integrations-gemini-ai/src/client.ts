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

interface GeminiGenerationConfig {
  maxOutputTokens?: number;
  responseMimeType?: string;
  temperature?: number;
}

interface GeminiRequestParams {
  model: string;
  contents: GeminiContent[];
  config?: GeminiGenerationConfig;
  abortSignal?: AbortSignal;
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

interface StreamChunk {
  text: string;
}

async function modelfarmFetch(
  model: string,
  contents: GeminiContent[],
  generationConfig: GeminiGenerationConfig | undefined,
  abortSignal?: AbortSignal,
  systemInstruction?: { parts: Array<{ text: string }> },
): Promise<{ json: () => Promise<{ candidates?: GeminiCandidate[] }>; ok: boolean; status: number; text: () => Promise<string> }> {
  const url = `${integrationBaseUrl}/models/${model}:generateContent`;
  const body: Record<string, unknown> = { contents, generationConfig };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": integrationApiKey!,
    },
    body: JSON.stringify(body),
    signal: abortSignal,
  }) as ReturnType<typeof fetch>;
}

async function modelfarmGenerateContent(params: GeminiRequestParams): Promise<GeminiResponse> {
  const resp = await modelfarmFetch(params.model, params.contents, params.config as GeminiGenerationConfig, params.abortSignal, params.systemInstruction);
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Modelfarm HTTP ${resp.status}: ${errText}`);
  }
  const data = await resp.json() as { candidates?: GeminiCandidate[] };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return { candidates: data.candidates, text };
}

async function* modelfarmGenerateContentStream(params: GeminiRequestParams): AsyncIterable<StreamChunk> {
  const response = await modelfarmGenerateContent(params);
  const text = response.text ?? "";
  if (text) {
    yield { text };
  }
}

const modelfarmProxy = {
  models: {
    generateContent: (params: GeminiRequestParams) => modelfarmGenerateContent(params),
    generateContentStream: (params: GeminiRequestParams) => modelfarmGenerateContentStream(params),
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
