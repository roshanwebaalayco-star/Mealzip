import { useState, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";

export type MicState = "idle" | "listening" | "processing" | "speaking" | "complete";
export type ConvState =
  | "idle"
  | "ask_family_name"
  | "ask_state"
  | "ask_budget"
  | "ask_dietary_type"
  | "ask_member_start"
  | "ask_member_conditions"
  | "ask_more_members"
  | "complete"
  | "error";

export interface ConvMessage {
  role: "assistant" | "user";
  text: string;
}

export interface VoiceFormData {
  familyName?: string;
  state?: string;
  monthlyBudget?: number;
  dietaryType?: string;
  cookingSkill?: string;
  mealsPerDay?: number;
  members?: Array<{
    name: string | null;
    age: number | null;
    gender: string;
    healthConditions: string[];
    healthGoal: string;
    activityLevel?: string;
    dietaryType?: string;
    spiceTolerance?: string;
    occasionalNonvegDays?: string[];
    occasionalNonvegTypes?: string[];
  }>;
}

const LANG_CODE: Record<string, string> = {
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

const GREETING: Record<string, string> = {
  hindi: "नमस्ते! मैं ParivarSehat AI हूँ। मैं आपके परिवार का personalized meal plan बनाने में मदद करूँगी। आपके परिवार का नाम क्या है?",
  english: "Hello! I'm ParivarSehat AI. I'll help set up your family's personalised meal plan. What is your family name?",
  bengali: "নমস্কার! আমি ParivarSehat AI। আপনার পরিবারের জন্য meal plan তৈরি করতে সাহায্য করব। আপনার পরিবারের নাম কী?",
  tamil: "வணக்கம்! நான் ParivarSehat AI. உங்கள் குடும்பத்திற்கான உணவுத் திட்டம் தயாரிக்க உதவுவேன். உங்கள் குடும்பப் பெயர் என்ன?",
  telugu: "నమస్కారం! నేను ParivarSehat AI. మీ కుటుంబానికి meal plan తయారు చేయడంలో సహాయం చేస్తాను. మీ కుటుంబం పేరు ఏమిటి?",
  marathi: "नमस्कार! मी ParivarSehat AI आहे. मी तुमच्या कुटुंबासाठी meal plan तयार करण्यात मदत करेन. तुमच्या कुटुंबाचे नाव काय आहे?",
  gujarati: "નમસ્તે! હું ParivarSehat AI છું. તમારા પરિવાર માટે meal plan બનાવવામાં મદદ કરીશ. તમારા પરિવારનું નામ શું છે?",
  kannada: "ನಮಸ್ಕಾರ! ನಾನು ParivarSehat AI. ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕಾಗಿ meal plan ತಯಾರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ನಿಮ್ಮ ಕುಟುಂಬದ ಹೆಸರು ಏನು?",
  malayalam: "നമസ്കാരം! ഞാൻ ParivarSehat AI ആണ്. നിങ്ങളുടെ കുടുംബത്തിനായി meal plan തയ്യാറാക്കാൻ സഹായിക്കും. നിങ്ങളുടെ കുടുംബത്തിന്റെ പേര് എന്താണ്?",
  punjabi: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ParivarSehat AI ਹਾਂ। ਮੈਂ ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਦਾ meal plan ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰਾਂਗੀ। ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਦਾ ਨਾਮ ਕੀ ਹੈ?",
  odia: "ନମସ୍କାର! ମୁଁ ParivarSehat AI। ଆପଣଙ୍କ ପରିବାର ପାଇଁ meal plan ତିଆରି କରିବାରେ ସାହାଯ୍ୟ କରିବି। ଆପଣଙ୍କ ପରିବାରର ନାମ କ'ଣ?",
};

const RETRY_MSGS: Record<string, string[]> = {
  hindi: [
    "माफ़ कीजिए, मुझे साफ़ सुनाई नहीं दिया। क्या आप दोबारा बोल सकते हैं?",
    "मुझे अभी भी सुनने में दिक्कत हो रही है। ज़रा ज़ोर से या फ़ोन के पास बोलकर देखें।",
    "लगता है माइक में कुछ दिक्कत है। कृपया 'Type instead' बटन दबाकर जानकारी लिख दें।",
  ],
  english: [
    "Sorry, I couldn't hear that clearly. Could you say it again?",
    "I'm still having trouble hearing you. Try speaking a bit louder or holding the phone closer.",
    "It seems there's a microphone issue. Please tap 'Type instead' to enter your details manually.",
  ],
  bengali: [
    "মাফ করবেন, পরিষ্কার শুনতে পাইনি। আবার বলবেন?",
    "এখনও শুনতে পাচ্ছি না। একটু জোরে বা ফোনের কাছে এসে বলুন।",
    "মনে হচ্ছে মাইকে সমস্যা। দয়া করে 'Type instead' বোতাম টিপে লিখে দিন।",
  ],
  tamil: [
    "மன்னிக்கவும், தெளிவாக கேட்கவில்லை. மீண்டும் சொல்ல முடியுமா?",
    "இன்னும் கேட்பதில் சிரமம் உள்ளது. கொஞ்சம் சத்தமாக அல்லது போனை அருகில் வைத்து பேசுங்கள்.",
    "மைக்கில் ஏதோ பிரச்சனை இருக்கிறது. 'Type instead' பொத்தானை அழுத்தி தகவலை டைப் செய்யுங்கள்.",
  ],
  telugu: [
    "క్షమించండి, స్పష్టంగా వినిపించలేదు. మళ్ళీ చెప్పగలరా?",
    "ఇంకా వినడంలో ఇబ్బంది ఉంది. కాస్త గట్టిగా లేదా ఫోన్ దగ్గరగా పెట్టి మాట్లాడండి.",
    "మైక్‌లో ఏదో సమస్య ఉన్నట్లుంది. 'Type instead' బటన్ నొక్కి వివరాలు టైప్ చేయండి.",
  ],
  marathi: [
    "माफ करा, स्पष्ट ऐकू आले नाही. पुन्हा सांगाल का?",
    "अजूनही ऐकण्यात अडचण येतेय. थोडं मोठ्याने किंवा फोन जवळ धरून बोला.",
    "मायक्रोफोनमध्ये काहीतरी अडचण दिसतेय. कृपया 'Type instead' बटण दाबा आणि लिहून द्या.",
  ],
  gujarati: [
    "માફ કરજો, સ્પષ્ટ સંભળાયું નહીં. ફરી કહેશો?",
    "હજી સાંભળવામાં તકલીફ થઈ રહી છે. થોડું મોટેથી અથવા ફોન નજીક રાખીને બોલો.",
    "માઇકમાં કંઈક તકલીફ લાગે છે. કૃપા કરી 'Type instead' બટન દબાવીને લખી આપો.",
  ],
  kannada: [
    "ಕ್ಷಮಿಸಿ, ಸ್ಪಷ್ಟವಾಗಿ ಕೇಳಿಸಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳಬಹುದೇ?",
    "ಇನ್ನೂ ಕೇಳಲು ಕಷ್ಟವಾಗುತ್ತಿದೆ. ಸ್ವಲ್ಪ ಜೋರಾಗಿ ಅಥವಾ ಫೋನ್ ಹತ್ತಿರ ಹಿಡಿದು ಮಾತನಾಡಿ.",
    "ಮೈಕ್‌ನಲ್ಲಿ ಸಮಸ್ಯೆ ಇರುವಂತಿದೆ. ದಯವಿಟ್ಟು 'Type instead' ಬಟನ್ ಒತ್ತಿ ಮಾಹಿತಿ ಟೈಪ್ ಮಾಡಿ.",
  ],
  malayalam: [
    "ക്ഷമിക്കണം, വ്യക്തമായി കേൾക്കാൻ കഴിഞ്ഞില്ല. ഒന്നു കൂടി പറയാമോ?",
    "ഇപ്പോഴും കേൾക്കാൻ ബുദ്ധിമുട്ട് ഉണ്ട്. അല്പം ഉറക്കെ അല്ലെങ്കിൽ ഫോൺ അടുത്ത് പിടിച്ച് സംസാരിക്കൂ.",
    "മൈക്കിൽ എന്തോ പ്രശ്നം ഉണ്ടെന്ന് തോന്നുന്നു. ദയവായി 'Type instead' ബട്ടൺ ടാപ്പ് ചെയ്ത് ടൈപ്പ് ചെയ്യൂ.",
  ],
  punjabi: [
    "ਮਾਫ਼ ਕਰਨਾ, ਸਾਫ਼ ਸੁਣਾਈ ਨਹੀਂ ਦਿੱਤਾ। ਕੀ ਤੁਸੀਂ ਦੁਬਾਰਾ ਕਹੋਗੇ?",
    "ਅਜੇ ਵੀ ਸੁਣਨ ਵਿੱਚ ਮੁਸ਼ਕਲ ਆ ਰਹੀ ਹੈ। ਥੋੜ੍ਹਾ ਉੱਚੀ ਜਾਂ ਫ਼ੋਨ ਨੇੜੇ ਰੱਖ ਕੇ ਬੋਲੋ।",
    "ਲੱਗਦਾ ਹੈ ਮਾਈਕ ਵਿੱਚ ਕੋਈ ਦਿੱਕਤ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ 'Type instead' ਬਟਨ ਦਬਾ ਕੇ ਲਿਖੋ।",
  ],
  odia: [
    "କ୍ଷମା କରନ୍ତୁ, ସ୍ପଷ୍ଟ ଶୁଣିପାରିଲି ନାହିଁ। ଦୟାକରି ପୁଣି ଥରେ କୁହନ୍ତୁ।",
    "ଏପର୍ଯ୍ୟନ୍ତ ଶୁଣିବାରେ ଅସୁବିଧା ହେଉଛି। ଟିକେ ଜୋରରେ ବା ଫୋନ ପାଖରେ ଧରି କୁହନ୍ତୁ।",
    "ମାଇକରେ କିଛି ଅସୁବିଧା ଲାଗୁଛି। ଦୟାକରି 'Type instead' ବଟନ ଦବାଇ ଲେଖି ଦିଅନ୍ତୁ।",
  ],
};

const ERROR_MSG: Record<string, string> = {
  hindi: "कुछ समस्या आ गई। क्या आप दोबारा बोल सकते हैं?",
  english: "Something went wrong. Could you repeat that?",
  bengali: "কিছু সমস্যা হয়েছে। আবার বলবেন?",
  tamil: "சிக்கல் ஏற்பட்டது. மீண்டும் முயற்சிக்கவும்.",
  telugu: "ఏదో సమస్య వచ్చింది. మళ్ళీ ప్రయత్నించండి.",
  marathi: "काहीतरी चूक झाली. पुन्हा प्रयत्न करा.",
  gujarati: "કઈક ગરબડ થઈ. ફરી કહેશો?",
  kannada: "ಏನೋ ಸಮಸ್ಯೆ ಆಯಿತು. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
  malayalam: "എന്തോ പ്രശ്നം ഉണ്ടായി. വീണ്ടും ശ്രമിക്കൂ.",
  punjabi: "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  odia: "କିଛି ଅସୁବିଧା ହେଲା। ପୁଣି ଥରେ ଚେଷ୍ଟା କରନ୍ତୁ।",
};

function mergeFields(fd: VoiceFormData, parsed: Record<string, unknown>): VoiceFormData {
  const next: VoiceFormData = { ...fd, members: fd.members ? [...fd.members] : [] };

  if (parsed.familyName && typeof parsed.familyName === "string") next.familyName = parsed.familyName;
  if (parsed.state && typeof parsed.state === "string") next.state = parsed.state;
  if (typeof parsed.monthlyBudget === "number" && (parsed.monthlyBudget as number) > 0)
    next.monthlyBudget = parsed.monthlyBudget as number;
  if (parsed.dietaryType && typeof parsed.dietaryType === "string") next.dietaryType = parsed.dietaryType;
  if (parsed.cookingSkill && typeof parsed.cookingSkill === "string") next.cookingSkill = parsed.cookingSkill;
  if (typeof parsed.mealsPerDay === "number" && (parsed.mealsPerDay as number) >= 2)
    next.mealsPerDay = parsed.mealsPerDay as number;

  if (parsed.currentMember && typeof parsed.currentMember === "object") {
    const m = parsed.currentMember as Record<string, unknown>;
    const member: NonNullable<VoiceFormData["members"]>[number] = {
      name: m.name != null ? String(m.name) : null,
      age: typeof m.age === "number" ? (m.age as number) : null,
      gender: m.gender ? String(m.gender) : "male",
      healthConditions: Array.isArray(m.healthConditions)
        ? (m.healthConditions as string[])
        : [],
      healthGoal: m.healthGoal ? String(m.healthGoal) : "general_wellness",
      activityLevel: m.activityLevel ? String(m.activityLevel) : undefined,
      dietaryType: m.dietaryType ? String(m.dietaryType) : undefined,
      spiceTolerance: m.spiceTolerance ? String(m.spiceTolerance) : undefined,
      occasionalNonvegDays: Array.isArray(m.nonVegDays) ? (m.nonVegDays as string[]) : undefined,
      occasionalNonvegTypes: Array.isArray(m.nonVegTypes) ? (m.nonVegTypes as string[]) : undefined,
    };
    if (!next.members) next.members = [];
    next.members = [...next.members, member];
  }

  if (
    parsed.currentMemberConditions != null &&
    Array.isArray(parsed.currentMemberConditions) &&
    next.members &&
    next.members.length > 0
  ) {
    const last = next.members.length - 1;
    next.members = next.members.map((m, i) =>
      i === last
        ? { ...m, healthConditions: parsed.currentMemberConditions as string[] }
        : m
    );
  }

  return next;
}

// Per-language correction/undo triggers. "nahi"/"no" ARE included as they are valid correction
// signals after a field is confirmed. Collision with yes/no answers is handled by YES_NO_STATES:
// detectCorrection() returns false unconditionally in ask_more_members and ask_member_conditions,
// so bare "nahi"/"no" are never mistaken for corrections at those prompts.
const CORRECTION_TRIGGERS: Record<string, string[]> = {
  hi: ["nahi", "nahin", "na", "galat", "galat hai", "galat hua", "wapas", "change karo", "bhul gaya", "mistake", "dobara se", "phirse batao"],
  en: ["no", "nope", "wrong", "go back", "change that", "not that", "no wait", "redo", "correction", "undo", "that's wrong", "incorrect"],
  ta: ["illai", "vendam", "thappu", "maarunga", "thirumba po", "cancel pannu", "illa bidi"],
  te: ["ledu", "thappu", "wapas", "thappu undi"],
  bn: ["naa", "na", "bhul", "wapas jao", "phire jao", "bhul hoye geche"],
  mr: ["nahi", "chukle", "wapas", "phir sangto", "chukiche"],
  gu: ["nahi", "bhul", "paachhu", "bhul thayyu"],
  kn: ["illa", "tappu", "hinge beda", "tappu aaytu"],
  ml: ["illa", "thettanu", "thiriche", "thettayi"],
  pa: ["nahi", "galat", "wapas", "galat hai"],
  or: ["naa", "bhul", "pheri kaho", "bhul hela"],
};

// States where bare yes/no responses are expected as natural conversation answers.
const YES_NO_STATES = new Set<ConvState>(["ask_more_members", "ask_member_conditions"]);

// Single-word bare negatives that should NEVER trigger correction in YES_NO_STATES —
// they are legitimate "no more / no conditions" answers there.
const BARE_NEGATIVES = new Set([
  "no", "nope", "nahi", "nahin", "na", "naa", "ledu", "illa", "illai",
]);

function detectCorrection(transcript: string, language: string, state: ConvState): boolean {
  if (transcript.length > 100) return false;
  const lower = transcript.toLowerCase().trim();
  // In YES_NO states, block only bare single-word negatives; still allow explicit
  // multi-word correction phrases like "go back", "wrong", "galat hai".
  if (YES_NO_STATES.has(state) && BARE_NEGATIVES.has(lower)) return false;
  const langKey = language === "hindi" ? "hi"
    : language === "english" ? "en"
    : language === "tamil" ? "ta"
    : language === "telugu" ? "te"
    : language === "bengali" ? "bn"
    : language === "marathi" ? "mr"
    : language === "gujarati" ? "gu"
    : language === "kannada" ? "kn"
    : language === "malayalam" ? "ml"
    : language === "punjabi" ? "pa"
    : language === "odia" ? "or"
    : "en";
  const triggers = [...(CORRECTION_TRIGGERS[langKey] ?? []), ...(CORRECTION_TRIGGERS.en ?? [])];
  return triggers.some(p => lower === p || lower.startsWith(p + " ") || lower.startsWith(p + ","));
}

const CORRECTION_MSG: Record<string, string> = {
  hindi: "ठीक है, कोई बात नहीं। दोबारा बताइए।",
  english: "No problem! Let me ask again.",
  bengali: "ঠিক আছে, কোনো চিন্তা নেই। আবার বলুন।",
  tamil: "பரவாயில்லை! மீண்டும் கேட்கிறேன்.",
  telugu: "సరే, మళ్ళీ చెప్పండి.",
  marathi: "ठीक आहे, पुन्हा सांगा.",
  gujarati: "ઠીક છે, ફરી કહો.",
  kannada: "ಪರವಾಗಿಲ್ಲ, ಮತ್ತೆ ಹೇಳಿ.",
  malayalam: "കുഴപ്പമില്ല, ഒന്നു കൂടി പറയൂ.",
  punjabi: "ਕੋਈ ਗੱਲ ਨਹੀਂ, ਦੁਬਾਰਾ ਦੱਸੋ।",
  odia: "ଠିକ ଅଛି, ପୁଣି ଥରେ କୁହନ୍ତୁ।",
};

export function useVoiceAssistant() {
  const [micState, setMicState] = useState<MicState>("idle");
  const [convState, setConvState] = useState<ConvState>("idle");
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [formData, setFormData] = useState<VoiceFormData>({});
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState<number>(0);

  const abortRef = useRef(false);
  const isRunningRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const consecutiveFailsRef = useRef(0);
  const stateHistoryRef = useRef<Array<{ state: ConvState; msg: string; fd: VoiceFormData }>>([]);

  const start = useCallback(
    async (language: string = "hindi", onComplete: (data: VoiceFormData) => void) => {
      if (isRunningRef.current) return;
      isRunningRef.current = true;
      abortRef.current = false;
      setError(null);
      setFormData({});

      const greeting = GREETING[language] ?? GREETING.english;
      const initialMsgs: ConvMessage[] = [{ role: "assistant", text: greeting }];
      setMessages(initialMsgs);
      setConvState("ask_family_name");

      const langCode = LANG_CODE[language] ?? "hi-IN";
      // TTS locale matches the script produced by the backend for each language.
      // Backend now generates native script for all 11 Sarvam languages.
      const ttsLang = LANG_CODE[language] ?? "hi-IN";
      let currentState: ConvState = "ask_family_name";
      let fd: VoiceFormData = {};
      let msgs: ConvMessage[] = [...initialMsgs];
      let nextMsg = greeting;
      stateHistoryRef.current = [];

      const speakText = async (text: string): Promise<void> => {
        if (abortRef.current) return;
        try {
          const res = await apiFetch("/api/voice/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, languageCode: langCode }),
          });
          if (!res.ok) throw new Error("TTS request failed");
          const data = (await res.json()) as { audioBase64: string };
          if (abortRef.current || !data.audioBase64) return;
          const audioBytes = Uint8Array.from(atob(data.audioBase64), c => c.charCodeAt(0));
          const blob = new Blob([audioBytes], { type: "audio/wav" });
          const url = URL.createObjectURL(blob);
          await new Promise<void>((resolveAudio) => {
            const audio = new Audio(url);
            ttsAudioRef.current = audio;
            audio.onended = () => { ttsAudioRef.current = null; URL.revokeObjectURL(url); resolveAudio(); };
            audio.onerror = () => { ttsAudioRef.current = null; URL.revokeObjectURL(url); resolveAudio(); };
            if (abortRef.current) { ttsAudioRef.current = null; URL.revokeObjectURL(url); resolveAudio(); return; }
            audio.play().catch(() => { ttsAudioRef.current = null; URL.revokeObjectURL(url); resolveAudio(); });
          });
        } catch {
          if (abortRef.current) return;
          if (!window.speechSynthesis) return;
          await new Promise<void>((resolve) => {
            window.speechSynthesis.cancel();
            const utt = new SpeechSynthesisUtterance(text);
            utt.lang = ttsLang;
            utt.rate = 0.9;
            utt.pitch = 1.1;
            utt.onend = () => resolve();
            utt.onerror = () => resolve();
            window.speechSynthesis.speak(utt);
          });
        }
      };

      const recordOnce = (): Promise<string> =>
        new Promise(async (resolve, reject) => {
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch {
            reject(new Error("Microphone access denied. Please enable it in your browser settings, then tap Voice again."));
            return;
          }
          streamRef.current = stream;

          const mime = MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "audio/mp4";
          let recorder: MediaRecorder;
          try {
            recorder = new MediaRecorder(stream, { mimeType: mime });
          } catch {
            recorder = new MediaRecorder(stream);
          }
          recorderRef.current = recorder;
          const chunks: BlobPart[] = [];

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = async () => {
            if (silenceRafRef.current) {
              cancelAnimationFrame(silenceRafRef.current);
              silenceRafRef.current = null;
            }
            if (audioCtxRef.current) {
              try { audioCtxRef.current.close(); } catch { /* ignore */ }
              audioCtxRef.current = null;
            }
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            if (abortRef.current) {
              reject(new Error("aborted"));
              return;
            }
            try {
              const blob = new Blob(chunks, { type: mime });
              const ab = await blob.arrayBuffer();
              const base64 = btoa(
                String.fromCharCode(...new Uint8Array(ab))
              );
              const res = await apiFetch("/api/voice/transcribe", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ audioBase64: base64, languageCode: langCode }),
              });
              if (!res.ok) {
                const err = (await res.json()) as { error?: string; detail?: string };
                reject(new Error(err.detail ?? err.error ?? "Transcription failed"));
                return;
              }
              const data = (await res.json()) as { transcript: string };
              resolve(data.transcript ?? "");
            } catch (e) {
              reject(e);
            }
          };

          recorder.start();

          stopTimerRef.current = setTimeout(() => {
            if (recorder.state === "recording") recorder.stop();
          }, 8000);

          try {
            const audioCtx = new AudioContext();
            audioCtxRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const bufLen = analyser.frequencyBinCount;
            const data = new Uint8Array(bufLen);

            let silenceStart: number | null = null;
            const SILENCE_THRESHOLD = 8;
            const SILENCE_HOLD_MS = 1800;
            let hasSpoken = false;

            const checkSilence = () => {
              if (recorder.state !== "recording") return;
              analyser.getByteTimeDomainData(data);
              let sum = 0;
              for (const v of data) sum += (v - 128) ** 2;
              const rms = Math.sqrt(sum / bufLen);

              // Expose real-time volume (0-100) to the UI
              setVolume(Math.min(100, Math.round((rms / 30) * 100)));

              if (rms >= SILENCE_THRESHOLD) {
                hasSpoken = true;
                silenceStart = null;
              } else if (hasSpoken) {
                if (silenceStart === null) silenceStart = Date.now();
                else if (Date.now() - silenceStart > SILENCE_HOLD_MS) {
                  if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
                  if (recorder.state === "recording") recorder.stop();
                  return;
                }
              }
              silenceRafRef.current = requestAnimationFrame(checkSilence);
            };
            silenceRafRef.current = requestAnimationFrame(checkSilence);
          } catch {
            // silence detection unavailable, use timeout only
          }
        });

      const callChatTurn = async (
        state: ConvState,
        transcript: string,
        history: ConvMessage[],
        pfd: VoiceFormData
      ) => {
        const res = await apiFetch("/api/voice/chat-turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            state,
            userTranscript: transcript,
            partialFormData: pfd,
            conversationHistory: history,
            language,
          }),
        });
        if (!res.ok) throw new Error("Chat processing failed");
        return res.json() as Promise<{
          parsedFields: Record<string, unknown>;
          nextState: string;
          assistantMessage: string;
          isComplete: boolean;
        }>;
      };

      try {
        while (!abortRef.current) {
          setMicState("speaking");
          await speakText(nextMsg);
          if (abortRef.current) break;

          await new Promise((r) => setTimeout(r, 300));
          if (abortRef.current) break;

          setMicState("listening");
          let transcript: string;
          try {
            transcript = await recordOnce();
          } catch (e) {
            if (abortRef.current || (e as Error).message === "aborted") break;
            setError((e as Error).message);
            setConvState("error");
            setMicState("idle");
            break;
          }

          if (abortRef.current) break;

          setVolume(0);

          if (!transcript.trim()) {
            consecutiveFailsRef.current += 1;
            const failIdx = Math.min(consecutiveFailsRef.current - 1, 2);
            const retryArr = RETRY_MSGS[language] ?? RETRY_MSGS.english;
            nextMsg = retryArr[failIdx];
            msgs = [...msgs, { role: "user", text: "..." }, { role: "assistant", text: nextMsg }];
            setMessages([...msgs]);
            if (consecutiveFailsRef.current >= 3) {
              setMicState("speaking");
              await speakText(nextMsg);
              abortRef.current = true;
              isRunningRef.current = false;
              if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
              }
              setMicState("idle");
              break;
            }
            continue;
          }

          consecutiveFailsRef.current = 0;

          // Correction intent: user said "galat", "wrong", "go back" etc. — go back to previous question.
          // detectCorrection skips YES_NO_STATES so "no" / "nahi" are never intercepted there.
          if (detectCorrection(transcript, language, currentState)) {
            const correctionReply = CORRECTION_MSG[language] ?? CORRECTION_MSG.english;
            const prev = stateHistoryRef.current.pop();
            if (prev) {
              currentState = prev.state;
              setConvState(currentState);
              fd = prev.fd;           // restore captured data to the point before that question
              setFormData({ ...fd });
              nextMsg = `${correctionReply} ${prev.msg}`;
            } else {
              nextMsg = `${correctionReply} ${nextMsg}`;
            }
            msgs = [...msgs, { role: "user", text: transcript }, { role: "assistant", text: nextMsg }];
            setMessages([...msgs]);
            continue;
          }

          msgs = [...msgs, { role: "user", text: transcript }];
          setMessages([...msgs]);
          setMicState("processing");

          // Capture pre-turn snapshot BEFORE the API call / mergeFields — so rolling back
          // truly restores formData to before this answer was processed.
          const preTurnSnapshot = { state: currentState, msg: nextMsg, fd: { ...fd } };

          let result: Awaited<ReturnType<typeof callChatTurn>>;
          try {
            result = await callChatTurn(currentState, transcript, msgs, fd);
          } catch (e) {
            if (abortRef.current) break;
            const fallback = ERROR_MSG[language] ?? ERROR_MSG.english;
            msgs = [...msgs, { role: "assistant", text: fallback }];
            setMessages([...msgs]);
            nextMsg = fallback;
            continue;
          }

          fd = mergeFields(fd, result.parsedFields);
          setFormData({ ...fd });

          msgs = [...msgs, { role: "assistant", text: result.assistantMessage }];
          setMessages([...msgs]);

          // Push pre-turn snapshot only when state actually advances (not on same-state retries)
          if (result.nextState !== currentState && result.nextState !== "complete") {
            stateHistoryRef.current.push(preTurnSnapshot);
          }

          currentState = result.nextState as ConvState;
          setConvState(currentState);
          nextMsg = result.assistantMessage;

          if (result.isComplete || result.nextState === "complete") {
            setConvState("complete");
            setMicState("idle");
            onComplete({ ...fd });
            break;
          }
        }
      } finally {
        setMicState("idle");
        isRunningRef.current = false;
      }
    },
    []
  );

  const stop = useCallback(() => {
    abortRef.current = true;
    isRunningRef.current = false;
    stateHistoryRef.current = [];
    consecutiveFailsRef.current = 0;
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
    if (ttsAudioRef.current) {
      try { ttsAudioRef.current.pause(); ttsAudioRef.current.src = ""; } catch { /* ignore */ }
      ttsAudioRef.current = null;
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (silenceRafRef.current) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* ignore */ }
      audioCtxRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setMicState("idle");
    setConvState("idle");
    setMessages([]);
    setFormData({});
    setError(null);
  }, []);

  const stopListeningEarly = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (silenceRafRef.current) {
      cancelAnimationFrame(silenceRafRef.current);
      silenceRafRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
  }, []);

  return {
    micState,
    convState,
    messages,
    formData,
    error,
    volume,
    start,
    stop,
    stopListeningEarly,
  };
}
