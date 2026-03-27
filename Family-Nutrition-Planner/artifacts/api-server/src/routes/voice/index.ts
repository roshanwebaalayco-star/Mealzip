import { Router, type IRouter } from "express";
import { z } from "zod";
import { TranscribeVoiceBody } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

const ParseProfileBody = z.object({
  transcript: z.string().min(1),
  language: z.enum(["hindi", "english", "bengali", "tamil", "telugu", "marathi", "gujarati", "kannada", "malayalam", "punjabi", "odia"]).optional().default("hindi"),
});

router.post("/voice/transcribe", async (req, res): Promise<void> => {
  const parsed = TranscribeVoiceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { audioBase64, languageCode } = parsed.data;
  const sarvamApiKey = process.env.SARVAM_API_KEY;

  if (!sarvamApiKey) {
    res.status(503).json({
      error: "Voice transcription service not configured",
      code: "SARVAM_KEY_MISSING",
    });
    return;
  }

  try {
    const audioBuffer = Buffer.from(audioBase64, "base64");
    const formData = new FormData();
    // Detect MIME type from buffer header (webm starts with 0x1A 0x45 0xDF 0xA3)
    const isWebm = audioBuffer[0] === 0x1a && audioBuffer[1] === 0x45;
    const mimeType = isWebm ? "audio/webm" : "audio/wav";
    const fileName = isWebm ? "audio.webm" : "audio.wav";
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("language_code", languageCode);
    formData.append("model", "saarika:v2");

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": sarvamApiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Sarvam API error: ${response.status}`);
    }

    const data = await response.json() as { transcript?: string; language_code?: string };
    res.json({
      transcript: data.transcript ?? "",
      confidence: 0.9,
      detectedLanguage: data.language_code ?? languageCode,
    });
  } catch (err) {
    req.log.error({ err }, "Sarvam STT failed");
    res.status(502).json({ error: "Voice transcription service unavailable" });
  }
});

router.post("/voice/parse-profile", async (req, res): Promise<void> => {
  const parsed = ParseProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { transcript, language } = parsed.data;

  const prompt = `You are an AI assistant helping set up a family nutrition profile for an Indian household.
Extract structured information from this voice transcript (spoken in ${language}) and return a JSON profile.

Transcript: "${transcript}"

Extract whatever information is present and return ONLY a JSON object with this structure (use null for missing fields):
{
  "familyName": "string or null",
  "state": "Indian state name or null",
  "city": "city name or null",
  "monthlyBudget": number_in_INR_or_null,
  "primaryLanguage": "hindi|english|bengali|tamil|telugu|marathi|gujarati or null",
  "cuisinePreferences": ["veg", "non-veg", "jain", etc. - array may be empty],
  "members": [
    {
      "name": "string or null",
      "role": "father|mother|child|grandparent|other",
      "age": number_or_null,
      "gender": "male|female|other",
      "healthConditions": ["diabetes", "hypertension", "obesity", etc. - may be empty],
      "dietaryRestrictions": ["vegetarian", "vegan", "jain", "gluten_free", etc. - may be empty]
    }
  ],
  "confidence": 0.0_to_1.0,
  "unparsedInfo": "any information mentioned but not captured in the structure above"
}

Rules:
- Extract family member count from mentions like "hum paanch log hain" (we are 5 people) 
- Map Hindi terms: "Pitaji/Papa" → father, "Maa/Amma" → mother, "beta/beti" → child, "dada/dadi/nana/nani" → grandparent
- For budget, convert phrases like "hamaara mahine ka kharcha panch hazaar hai" → 5000
- Common Indian health conditions: "madhumeh/sugar ki bimari" → diabetes, "BP" → hypertension, "thyroid" → thyroid
- Dietary: "shakahari" → vegetarian, "maansahari" → non-vegetarian, "jain khana" → jain
- Set confidence based on how much useful info was extracted (0.3 = very little, 0.9 = very detailed)`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });
    const profileData = JSON.parse(response.text ?? "{}");
    res.json(profileData);
  } catch (err) {
    req.log.error({ err }, "Voice profile parsing failed");
    res.status(500).json({ error: "Profile parsing failed", details: String(err) });
  }
});

export default router;
