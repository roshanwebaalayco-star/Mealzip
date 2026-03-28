import { Router, type IRouter } from "express";
import { z } from "zod";
import { TranscribeVoiceBody } from "@workspace/api-zod";
import { ai } from "@workspace/integrations-gemini-ai";

const router: IRouter = Router();

const ParseProfileBody = z.object({
  transcript: z.string().min(1),
  language: z.enum(["hindi", "english", "bengali", "tamil", "telugu", "marathi", "gujarati", "kannada", "malayalam", "punjabi", "odia"]).optional().default("hindi"),
});

function detectAudioFormat(buf: Buffer): { mimeType: string; fileName: string } {
  // WebM: starts with 0x1A 0x45 0xDF 0xA3 (EBML header)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return { mimeType: "audio/webm", fileName: "audio.webm" };
  }
  // OGG: starts with "OggS" (0x4F 0x67 0x67 0x53)
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) {
    return { mimeType: "audio/ogg", fileName: "audio.ogg" };
  }
  // MP3: ID3 tag (0x49 0x44 0x33) or sync word (0xFF 0xFB / 0xFF 0xF3 / 0xFF 0xF2)
  if (
    (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) ||
    (buf[0] === 0xff && (buf[1] === 0xfb || buf[1] === 0xf3 || buf[1] === 0xf2))
  ) {
    return { mimeType: "audio/mpeg", fileName: "audio.mp3" };
  }
  // FLAC: starts with "fLaC" (0x66 0x4C 0x61 0x43)
  if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) {
    return { mimeType: "audio/flac", fileName: "audio.flac" };
  }
  // M4A/MP4: ftyp box at offset 4
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) {
    return { mimeType: "audio/mp4", fileName: "audio.m4a" };
  }
  // Default to WAV (RIFF header: 0x52 0x49 0x46 0x46)
  return { mimeType: "audio/wav", fileName: "audio.wav" };
}

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
    const { mimeType, fileName } = detectAudioFormat(audioBuffer);

    req.log.info({ mimeType, fileName, bytes: audioBuffer.length }, "Voice transcription request");

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append("file", blob, fileName);
    formData.append("language_code", languageCode);
    formData.append("model", "saarika:v2.5");

    const response = await fetch("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: {
        "api-subscription-key": sarvamApiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      let sarvamErrorBody: string;
      try {
        sarvamErrorBody = await response.text();
      } catch {
        sarvamErrorBody = "(could not read response body)";
      }
      req.log.error(
        { status: response.status, sarvamError: sarvamErrorBody, mimeType, languageCode },
        "Sarvam STT HTTP error"
      );
      res.status(502).json({
        error: "Voice transcription failed",
        detail: `Sarvam returned ${response.status}: ${sarvamErrorBody}`,
        audioFormat: mimeType,
      });
      return;
    }

    const data = await response.json() as { transcript?: string; language_code?: string };
    const transcript = (data.transcript ?? "").trim();

    if (!transcript) {
      res.status(422).json({
        error: "Empty transcript — no speech detected",
        code: "EMPTY_TRANSCRIPT",
        audioFormat: mimeType,
      });
      return;
    }

    res.json({
      transcript,
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
The user has spoken in ${language}. The speech was transcribed by Sarvam AI.
Extract structured information from the transcript and return a JSON object that maps directly to the form fields below.

Transcript: "${transcript}"

Return ONLY valid JSON (no markdown, no explanation) matching this exact structure (use null for missing fields):
{
  "familyName": "string or null — the family's surname or name e.g. 'Sharma Family'",
  "state": "exact Indian state name or null — e.g. 'Uttar Pradesh', 'Maharashtra', 'Jharkhand'",
  "monthlyBudget": number_in_INR_or_null,
  "language": "hindi|english|bengali|tamil|telugu|marathi|gujarati|kannada|malayalam|punjabi|odia or null",
  "dietaryType": "vegetarian|non-vegetarian|vegan|jain or null — the overall family diet type",
  "healthGoal": "general_wellness|weight_loss|muscle_gain|manage_diabetes|heart_health|manage_thyroid or null",
  "members": [
    {
      "name": "string or null",
      "role": "father|mother|spouse|child|grandparent|other",
      "age": number_or_null,
      "gender": "male|female|other",
      "healthConditions": ["diabetes","hypertension","obesity","anemia","thyroid","high_cholesterol","pcod","growing_child","elderly"] — only matching values, may be empty,
      "healthGoal": "general_wellness|weight_loss|manage_diabetes|anemia_recovery|child_growth|heart_health|muscle_gain or null"
    }
  ]
}

Mapping rules for Indian languages (especially Hindi):
Family terms: "Pitaji/Papa/Pita" → father, "Maa/Amma/Mata" → mother, "beta/putra" → child (male), "beti/putri" → child (female), "dada/dadi/nana/nani/dadaji" → grandparent
Numbers: "paanch" → 5, "chaar" → 4, "teen/tin" → 3, "do" → 2, "ek" → 1, "hajar/hazar" → 1000
Budget: "panch hazaar" → 5000, "das hazaar" → 10000, "teen hazaar" → 3000
Health: "madhumeh/sugar/diabetes" → diabetes, "BP/blood pressure/raktchaap" → hypertension, "thyroid" → thyroid, "khoon ki kami/anemia" → anemia, "motapa/mota" → obesity
Diet: "shakahari/vegetarian" → vegetarian, "maansahari/non-veg" → non-vegetarian, "jain khana/jain" → jain
States: Map regional names e.g. "UP" → "UP", "Dilli/Delhi" → "Delhi", "Bambai/Mumbai wala" → "Maharashtra"
Goals: "vajan ghatana/weight loss" → weight_loss, "diabetes control" → manage_diabetes, "heart" → heart_health

If a number of family members is mentioned without names, generate placeholder entries (name: null) for each.
Set dietaryType at family level from the dominant pattern.`;


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

const ChatTurnBody = z.object({
  state: z.string(),
  userTranscript: z.string().min(1),
  partialFormData: z.record(z.unknown()).optional().default({}),
  conversationHistory: z.array(z.object({
    role: z.enum(["assistant", "user"]),
    text: z.string(),
  })).optional().default([]),
  language: z.enum(["hindi", "english", "bengali", "tamil", "telugu", "marathi", "gujarati", "kannada", "malayalam", "punjabi", "odia"]).optional().default("hindi"),
});

router.post("/voice/chat-turn", async (req, res): Promise<void> => {
  const parsed = ChatTurnBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
    return;
  }

  const { state, userTranscript, partialFormData, conversationHistory, language } = parsed.data;

  const historyText = conversationHistory.map(m =>
    `[${m.role.toUpperCase()}]: ${m.text}`
  ).join("\n");

  // Per-language config: native script instructions, completion/retry messages, condition prompt.
  // Keeps Gemini responding in the correct script with zero extra API calls.
  const LANG_CFG: Record<string, {
    note: string;
    completeMsg: string;
    retryMsg: string;
    conditionsPrompt: string;
    mappings: string;
  }> = {
    hindi: {
      note: "Hindi in Devanagari script — warm, friendly (e.g. 'शर्मा परिवार — बिल्कुल सही! आप किस राज्य में रहते हैं?')",
      completeMsg: "बहुत शुक्रिया! परिवार की प्रोफाइल तैयार है। एक सेकंड — मील प्लान बन रहा है!",
      retryMsg: "क्षमा करें, समझ नहीं आया। क्या आप दोबारा बोल सकते हैं?",
      conditionsPrompt: "[Name] जी को कोई स्वास्थ्य समस्या है? जैसे मधुमेह, BP, या 'सब ठीक है' बोलें।",
      mappings: `Family: pitaji/papa → father | maa/amma/mummy → mother | beta/son → child(M) | beti/daughter → child(F) | dada/nana → grandparent(M) | dadi/nani → grandparent(F)
Numbers: ek=1 do=2 teen=3 chaar=4 paanch=5 das=10 hazaar=1000
Health: madhumeh/sugar → diabetes | BP/raktchaap → hypertension | motapa → obesity | khoon ki kami → anemia | sab theek/healthy → []
Diet: shakahari/veg → vegetarian | maansahari/non-veg → non-vegetarian | jain → jain
Yes/No: haan/bilkul/zaroor → addMore:true | nahi/bas/ho gaya → isComplete:true`,
    },
    english: {
      note: "friendly, clear English",
      completeMsg: "Thank you! Your family profile is all set. Generating your meal plan now!",
      retryMsg: "Sorry, I didn't catch that. Could you please repeat?",
      conditionsPrompt: "Does [Name] have any health conditions like diabetes or hypertension? Or are they healthy?",
      mappings: `Family: father/dad/husband | mother/mom/wife | son/boy/child | daughter/girl | grandpa/grandma → grandparent
Yes/No: yes/sure/more → addMore:true | no/done/that's all → isComplete:true`,
    },
    bengali: {
      note: "Bengali in Bengali script (বাংলা) — warm, friendly (e.g. 'শর্মা পরিবার — দারুণ! আপনি কোন রাজ্যে থাকেন?')",
      completeMsg: "অনেক ধন্যবাদ! পরিবারের প্রোফাইল তৈরি হয়েছে। মিল প্ল্যান তৈরি হচ্ছে!",
      retryMsg: "দুঃখিত, বুঝতে পারিনি। আবার বলবেন?",
      conditionsPrompt: "[Name]-এর কোনো স্বাস্থ্য সমস্যা আছে? যেমন ডায়াবেটিস, BP, বা 'সব ঠিক আছে' বলুন।",
      mappings: `Family: baba/bapi → father | maa/dida → mother | chele/putra → child(M) | meye/putri → child(F) | thakurda/dadu → grandparent(M) | thakurma/dida → grandparent(F)
Numbers: ek=1 dui=2 tin=3 char=4 panch=5 das=10 hazar=1000
Health: madhumeh/sugar → diabetes | raktochaap/BP → hypertension | motaa → obesity | roktoshonyo → anemia | sab thik → []
Diet: niramish/veg → vegetarian | aamishahari/non-veg → non-vegetarian | jain → jain
Yes/No: haa/bolun/aar ache → addMore:true | na/shesh/bas → isComplete:true`,
    },
    tamil: {
      note: "Tamil in Tamil script (தமிழ்) — warm, friendly (e.g. 'சர்மா குடும்பம் — அருமை! நீங்கள் எந்த மாநிலத்தில் இருக்கிறீர்கள்?')",
      completeMsg: "மிக்க நன்றி! குடும்ப சுயவிவரம் தயாராகிவிட்டது. உணவுத் திட்டம் தயாரிக்கிறோம்!",
      retryMsg: "மன்னிக்கவும், புரியவில்லை. மீண்டும் சொல்ல முடியுமா?",
      conditionsPrompt: "[Name]-க்கு நீரிழிவு, BP போன்ற உடல்நலப் பிரச்சனை ஏதும் இருக்கிறதா? இல்லை என்றால் 'நலமாக இருக்கிறார்கள்' என்று சொல்லுங்கள்.",
      mappings: `Family: appa/thandai → father | amma/thaai → mother | magan/payyan → child(M) | magal/ponnu → child(F) | thatha → grandparent(M) | paati → grandparent(F)
Numbers: onnu=1 rendu=2 moonu=3 naalu=4 anju=5 pathu=10 aayiram=1000
Health: neerizivvu/sugar → diabetes | BP/ratthaatthupam → hypertension | paruvanam/adipai → obesity | irattha kunaippu → anemia | nalama → []
Diet: saiva/veg → vegetarian | asamia/non-veg → non-vegetarian | jain → jain
Yes/No: aama/seri/innum irukka → addMore:true | illai/mudindhachu/போதும் → isComplete:true`,
    },
    telugu: {
      note: "Telugu in Telugu script (తెలుగు) — warm, friendly (e.g. 'శర్మ కుటుంబం — చాలా బాగుంది! మీరు ఏ రాష్ట్రంలో ఉంటున్నారు?')",
      completeMsg: "చాలా ధన్యవాదాలు! కుటుంబ ప్రొఫైల్ సిద్ధంగా ఉంది. మీల్ ప్లాన్ తయారవుతోంది!",
      retryMsg: "క్షమించండి, అర్థం కాలేదు. మళ్ళీ చెప్పగలరా?",
      conditionsPrompt: "[Name]కి మధుమేహం, BP వంటి ఆరోగ్య సమస్యలు ఏమైనా ఉన్నాయా? లేదా 'ఆరోగ్యంగా ఉన్నారు' అని చెప్పండి.",
      mappings: `Family: nanna/thandri → father | amma/talli → mother | abbayi/koduku → child(M) | ammayi/kuthuru → child(F) | thatha → grandparent(M) | naana/avva → grandparent(F)
Numbers: okati=1 rendu=2 mudu=3 nalugu=4 aidu=5 padi=10 veyyi=1000
Health: madhumehamu/sugar → diabetes | BP/raktapeetam → hypertension | boddu → obesity | anemia/raktaheenam → anemia | arogyganga → []
Diet: sakahari/veg → vegetarian | maamsahari/non-veg → non-vegetarian | jain → jain
Yes/No: avunu/inka/sure → addMore:true | ledu/ayyindi/chaalu → isComplete:true`,
    },
    marathi: {
      note: "Marathi in Devanagari script (मराठी) — warm, friendly (e.g. 'शर्मा कुटुंब — छान! तुम्ही कोणत्या राज्यात राहता?')",
      completeMsg: "खूप आभारी आहोत! कुटुंबाची प्रोफाइल तयार आहे. जेवणाची योजना तयार होत आहे!",
      retryMsg: "माफ करा, समजले नाही. पुन्हा सांगाल का?",
      conditionsPrompt: "[Name] यांना मधुमेह, रक्तदाब यासारख्या आरोग्य समस्या आहेत का? किंवा 'सगळे ठीक आहे' सांगा.",
      mappings: `Family: baba/pappa/vaDil → father | aai/mummy → mother | mulga/putra → child(M) | mulgi/kanya → child(F) | aajoba → grandparent(M) | aaji → grandparent(F)
Numbers: ek=1 don=2 teen=3 chaar=4 paach=5 daha=10 hazaar=1000
Health: madhumeh/sugar → diabetes | raktadaab/BP → hypertension | ladacha/staulya → obesity | raktaheenataa → anemia | sab theek/nirogi → []
Diet: shakahari/veg → vegetarian | mansahari/non-veg → non-vegetarian | jain → jain
Yes/No: ho/haa/aahe/aadhik → addMore:true | nahi/bas/zaala → isComplete:true`,
    },
    gujarati: {
      note: "Gujarati in Gujarati script (ગુજરાતી) — warm, friendly (e.g. 'શર્મા પરિવાર — ખૂબ સુંદર! તમે ક્યા રાજ્યમાં રહો છો?')",
      completeMsg: "ખૂબ ખૂબ આભાર! પરિવારની પ્રોફાઈલ તૈયાર છે. ભોજન યોજના બની રહી છે!",
      retryMsg: "માફ કરજો, સમજાઈ નહીં. ફરી કહેશો?",
      conditionsPrompt: "[Name]ને ડાયાબિટીઝ, BP જેવી કોઈ સ્વાસ્થ્ય સમસ્યા છે? અથવા 'સ્વસ્થ છે' કહો.",
      mappings: `Family: bapuji/papa → father | mummy/baa → mother | dikro/putra → child(M) | dikri/putri → child(F) | dada/nana → grandparent(M) | dadi/nani → grandparent(F)
Numbers: ek=1 be=2 tran=3 char=4 paanch=5 das=10 hazar=1000
Health: madhumeh/sugar → diabetes | BP/raktchaap → hypertension | jaadat vajan/motaapaa → obesity | ochu lohee → anemia | swasth/theek → []
Diet: shakahari/veg → vegetarian | maansahari/non-veg → non-vegetarian | jain → jain
Yes/No: haa/bijo/vahu → addMore:true | nahi/bas/thai gayu → isComplete:true`,
    },
    kannada: {
      note: "Kannada in Kannada script (ಕನ್ನಡ) — warm, friendly (e.g. 'ಶರ್ಮ ಕುಟುಂಬ — ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ! ನೀವು ಯಾವ ರಾಜ್ಯದಲ್ಲಿ ವಾಸಿಸುತ್ತೀರಿ?')",
      completeMsg: "ತುಂಬಾ ಧನ್ಯವಾದಗಳು! ಕುಟುಂಬದ ಪ್ರೊಫೈಲ್ ಸಿದ್ಧವಾಗಿದೆ. ಊಟದ ಯೋಜನೆ ತಯಾರಾಗುತ್ತಿದೆ!",
      retryMsg: "ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಬಹುದೇ?",
      conditionsPrompt: "[Name]ಗೆ ಮಧುಮೇಹ, ರಕ್ತದೊತ್ತಡ ಮುಂತಾದ ಆರೋಗ್ಯ ಸಮಸ್ಯೆಗಳಿವೆಯೇ? ಇಲ್ಲವಾದರೆ 'ಆರೋಗ್ಯವಾಗಿದ್ದಾರೆ' ಎನ್ನಿ.",
      mappings: `Family: appa/tande → father | amma/taayi → mother | maga/huchcha → child(M) | magalu/hennu → child(F) | ajja/thatha → grandparent(M) | ajji/avva → grandparent(F)
Numbers: ondu=1 eradu=2 mooru=3 naalku=4 aidu=5 hattu=10 saavira=1000
Health: madhumEha/sugar → diabetes | BP/raktadoTTa → hypertension | adipai/staulya → obesity | anemia → anemia | arogya/theek → []
Diet: saahivari/veg → vegetarian | maamsahari/non-veg → non-vegetarian | jain → jain
Yes/No: houdhu/aukka/inka → addMore:true | illa/aaytu/saakaratthu → isComplete:true`,
    },
    malayalam: {
      note: "Malayalam in Malayalam script (മലയാളം) — warm, friendly (e.g. 'ശർമ്മ കുടുംബം — വളരെ നന്നായി! നിങ്ങൾ ഏത് സംസ്ഥാനത്താണ് താമസിക്കുന്നത്?')",
      completeMsg: "വളരെ നന്ദി! കുടുംബ പ്രൊഫൈൽ തയ്യാറായി. ഭക്ഷണ പദ്ധതി തയ്യാറാക്കുന്നു!",
      retryMsg: "ക്ഷമിക്കൂ, മനസ്സിലായില്ല. വീണ്ടും പറയാമോ?",
      conditionsPrompt: "[Name]-ന് പ്രമേഹം, BP തുടങ്ങിയ ആരോഗ്യ പ്രശ്നങ്ങൾ ഉണ്ടോ? ഇല്ലെങ്കിൽ 'ആരോഗ്യമുള്ളവർ' എന്ന് പറയൂ.",
      mappings: `Family: achan/appan/chettan → father | amma/kochamma → mother | makan/cherukkan → child(M) | maal/pennu → child(F) | appooppan/thatha → grandparent(M) | ammumma/paatti → grandparent(F)
Numbers: onnu=1 randu=2 moonu=3 naalu=4 anchu=5 pathu=10 aayiram=1000
Health: pramEham/sugar → diabetes | BP/raktasamma → hypertension | thadich → obesity | anemia/choru kuravv → anemia | arogya/kshemam → []
Diet: sakahari/veg → vegetarian | maamsahari/non-veg → non-vegetarian | jain → jain
Yes/No: athe/undu/koodi → addMore:true | illa/ayi/maathi → isComplete:true`,
    },
    punjabi: {
      note: "Punjabi in Gurmukhi script (ਪੰਜਾਬੀ) — warm, friendly (e.g. 'ਸ਼ਰਮਾ ਪਰਿਵਾਰ — ਬਹੁਤ ਵਧੀਆ! ਤੁਸੀਂ ਕਿਸ ਰਾਜ ਵਿੱਚ ਰਹਿੰਦੇ ਹੋ?')",
      completeMsg: "ਬਹੁਤ ਬਹੁਤ ਧੰਨਵਾਦ! ਪਰਿਵਾਰ ਦੀ ਪ੍ਰੋਫਾਈਲ ਤਿਆਰ ਹੈ। ਭੋਜਨ ਯੋਜਨਾ ਬਣ ਰਹੀ ਹੈ!",
      retryMsg: "ਮਾਫ਼ ਕਰਨਾ, ਸਮਝ ਨਹੀਂ ਆਇਆ। ਦੁਬਾਰਾ ਕਹਿ ਸਕਦੇ ਹੋ?",
      conditionsPrompt: "[Name] ਨੂੰ ਸ਼ੂਗਰ, ਬੀਪੀ ਵਰਗੀ ਕੋਈ ਸਿਹਤ ਸਮੱਸਿਆ ਹੈ? ਜਾਂ 'ਸਿਹਤਮੰਦ ਹੈ' ਕਹੋ।",
      mappings: `Family: paji/pita/bapu → father | maa/bibi → mother | munda/putra → child(M) | kudi/dhee → child(F) | dada/nana → grandparent(M) | dadi/nani → grandparent(F)
Numbers: ik=1 do=2 tinn=3 chaar=4 panj=5 das=10 hazaar=1000
Health: madhumeh/sugar → diabetes | BP/raktchaap → hypertension | motaapa → obesity | khoon di kami → anemia | theek/sehatmand → []
Diet: shakahari/veg → vegetarian | maansahari/non-veg → non-vegetarian | jain → jain
Yes/No: haan/bilkul/hor → addMore:true | nahi/bas/ho gaya → isComplete:true`,
    },
    odia: {
      note: "Odia in Odia script (ଓଡ଼ିଆ) — warm, friendly (e.g. 'ଶର୍ମା ପରିବାର — ବହୁତ ଭଲ! ଆପଣ କେଉଁ ରାଜ୍ୟରେ ଥାଆନ୍ତି?')",
      completeMsg: "ବହୁତ ଧନ୍ୟବାଦ! ପରିବାରର ପ୍ରୋଫାଇଲ ପ୍ରସ୍ତୁତ। ଖାଦ୍ୟ ଯୋଜନା ତିଆରି ହେଉଛି!",
      retryMsg: "କ୍ଷମା କରନ୍ତୁ, ବୁଝି ପାରିଲି ନାହିଁ। ପୁଣି କହିବେ?",
      conditionsPrompt: "[Name]ଙ୍କର ମଧୁମେହ, ରକ୍ତଚାପ ଭଳି କୌଣସି ସ୍ୱାସ୍ଥ୍ୟ ସମସ୍ୟା ଅଛି? ନଚେତ 'ସୁସ୍ଥ ଅଛନ୍ତି' ବୋଲନ୍ତୁ।",
      mappings: `Family: bapa/pita → father | maa/maata → mother | pua/putra → child(M) | jhi/kanya → child(F) | dada/nana → grandparent(M) | aai/nani → grandparent(F)
Numbers: gote=1 dui=2 tini=3 chhari=4 pancha=5 dasha=10 hajara=1000
Health: madhumeha/sugar → diabetes | raktachap/BP → hypertension | mota → obesity | raktaheen → anemia | sustha/theek → []
Diet: niramisha/veg → vegetarian | saamishya/non-veg → non-vegetarian | jain → jain
Yes/No: haa/achhi/aaru → addMore:true | naa/shesh/bas → isComplete:true`,
    },
  };

  const cfg = LANG_CFG[language] ?? LANG_CFG.english;

  const prompt = `You are a voice assistant for ParivarSehat AI, an Indian family nutrition planning app.
You are having a turn-by-turn voice conversation to collect family profile data.

CURRENT STATE: ${state}
CONVERSATION LANGUAGE: ${language}
DATA COLLECTED SO FAR: ${JSON.stringify(partialFormData, null, 2)}

CONVERSATION HISTORY (before this turn):
${historyText || "(none yet)"}

USER JUST SAID: "${userTranscript}"

=== WHAT TO EXTRACT BY STATE ===

ask_family_name:
  → parsedFields: { "familyName": "Sharma Family" }  (add " Family" if not present)
  → nextState: "ask_state"

ask_state:
  → parsedFields: { "state": "Jharkhand" }  (exact Indian state name)
  → nextState: "ask_budget"

ask_budget:
  → parsedFields: { "monthlyBudget": 5000 }  (number in INR, convert spoken numbers)
  → nextState: "ask_dietary_type"

ask_dietary_type:
  → parsedFields: { "dietaryType": "vegetarian|non-vegetarian|vegan|jain" }
  → nextState: "ask_member_start"

ask_member_start:
  → parsedFields: { "currentMember": { "name": "...", "role": "father|mother|child|grandparent|other", "age": 42, "gender": "male|female|other", "healthConditions": [], "healthGoal": "general_wellness" } }
  → nextState: "ask_more_members"  if conditions were mentioned
  → nextState: "ask_member_conditions"  if conditions NOT mentioned

ask_member_conditions:
  → parsedFields: { "currentMemberConditions": ["diabetes","hypertension"] }  OR  { "currentMemberConditions": [] }
  → nextState: "ask_more_members"

ask_more_members:
  → Another member given → parsedFields: { "currentMember": { ... } }, nextState: "ask_more_members" or "ask_member_conditions"
  → Yes but no details → parsedFields: { "addMore": true }, nextState: "ask_member_start"
  → No/done → nextState: "complete", isComplete: true

=== LANGUAGE MAPPINGS for ${language.toUpperCase()} ===
${cfg.mappings}

Indian states (colloquial → official):
  UP/Uttar Pradesh → Uttar Pradesh | Dilli/Delhi → Delhi | Bambai/Mumbai → Maharashtra
  Madras/Chennai → Tamil Nadu | Bengaluru/Bangalore → Karnataka | Hyderabad → Telangana

=== RULES ===
1. isComplete:true ONLY when nextState is "complete" AND familyName AND at least one member collected
2. assistantMessage MUST be in ${cfg.note}
3. assistantMessage = brief warm confirmation of what you heard + next question
4. Completion message: "${cfg.completeMsg}"
5. For ask_member_conditions with no useful input: "${cfg.conditionsPrompt}"

Return ONLY valid JSON, no markdown:
{
  "parsedFields": {},
  "nextState": "ask_state",
  "assistantMessage": "...",
  "isComplete": false
}`;

  const ChatTurnResponseSchema = z.object({
    parsedFields: z.record(z.unknown()).default({}),
    nextState: z.string().default(state),
    assistantMessage: z.string().min(1),
    isComplete: z.boolean().default(false),
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" },
    });

    let rawData: unknown;
    try {
      rawData = JSON.parse(response.text ?? "{}");
    } catch {
      rawData = {};
    }

    const schemaResult = ChatTurnResponseSchema.safeParse(rawData);
    const fallbackMsg = cfg.retryMsg;

    if (!schemaResult.success) {
      req.log.warn({ issues: schemaResult.error.flatten() }, "Gemini chat-turn output failed schema validation — using fallback");
      res.json({ parsedFields: {}, nextState: state, assistantMessage: fallbackMsg, isComplete: false });
      return;
    }

    const data = schemaResult.data;

    let isComplete = data.isComplete;
    let nextState = data.nextState;

    if (isComplete) {
      const existingName = (partialFormData as Record<string, unknown>).familyName;
      const parsedName = data.parsedFields.familyName;
      const hasFamilyName = !!existingName || !!parsedName;
      const existingMembers = Array.isArray((partialFormData as Record<string, unknown>).members)
        ? ((partialFormData as Record<string, unknown>).members as unknown[]).length
        : 0;
      const hasNewMember = !!data.parsedFields.currentMember;
      const atLeastOneMember = existingMembers > 0 || hasNewMember;

      if (!hasFamilyName || !atLeastOneMember) {
        isComplete = false;
        nextState = !hasFamilyName ? "ask_family_name" : "ask_member_start";
        req.log.info({ hasFamilyName, atLeastOneMember }, "Premature complete blocked — missing required fields");
      }
    }

    res.json({
      parsedFields: data.parsedFields,
      nextState,
      assistantMessage: data.assistantMessage,
      isComplete,
    });
  } catch (err) {
    req.log.error({ err }, "Voice chat-turn failed");
    res.status(500).json({ error: "Chat turn failed", details: String(err) });
  }
});

export default router;
