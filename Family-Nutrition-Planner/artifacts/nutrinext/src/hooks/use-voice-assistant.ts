import { useState, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api-fetch";

export type MicState = "idle" | "listening" | "processing" | "speaking";
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
  members?: Array<{
    name: string | null;
    role: string;
    age: number | null;
    gender: string;
    healthConditions: string[];
    healthGoal: string;
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
  hindi: "नमस्ते! मैं ParivarSehat AI हूं। मैं आपके परिवार का personalized meal plan बनाने में मदद करूंगा। आपके परिवार का नाम क्या है?",
  english: "Hello! I'm ParivarSehat AI. I'll help set up your family's personalised meal plan. What is your family name?",
  bengali: "নমস্কার! আমি ParivarSehat AI। আপনার পরিবারের জন্য meal plan তৈরি করতে সাহায্য করব। আপনার পরিবারের নাম কী?",
  tamil: "வணக்கம்! நான் ParivarSehat AI. உங்கள் குடும்பத்திற்கான உணவுத் திட்டம் தயாரிக்க உதவுவேன். உங்கள் குடும்பப் பெயர் என்ன?",
  telugu: "నమస్కారం! నేను ParivarSehat AI. మీ కుటుంబానికి meal plan తయారు చేయడంలో సహాయం చేస్తాను. మీ కుటుంబం పేరు ఏమిటి?",
  marathi: "नमस्कार! मी ParivarSehat AI आहे. मी तुमच्या कुटुंबाची meal plan तयार करण्यात मदत करेन. तुमच्या कुटुंबाचे नाव काय आहे?",
  gujarati: "નમસ્તે! હું ParivarSehat AI છું. તમારા પરિવાર માટે meal plan બનાવવામાં મદદ કરીશ. તમારા પરિવારનું નામ શું છે?",
  kannada: "ನಮಸ್ಕಾರ! ನಾನು ParivarSehat AI. ನಿಮ್ಮ ಕುಟುಂಬಕ್ಕಾಗಿ meal plan ತಯಾರಿಸಲು ಸಹಾಯ ಮಾಡುತ್ತೇನೆ. ನಿಮ್ಮ ಕುಟುಂಬದ ಹೆಸರು ಏನು?",
  malayalam: "നമസ്കാരം! ഞാൻ ParivarSehat AI ആണ്. നിങ്ങളുടെ കുടുംബത്തിനായി meal plan തയ്യാറാക്കാൻ സഹായിക്കും. നിങ്ങളുടെ കുടുംബത്തിന്റെ പേര് എന്താണ്?",
  punjabi: "ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ਮੈਂ ParivarSehat AI ਹਾਂ। ਮੈਂ ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਦਾ meal plan ਬਣਾਉਣ ਵਿੱਚ ਮਦਦ ਕਰਾਂਗਾ। ਤੁਹਾਡੇ ਪਰਿਵਾਰ ਦਾ ਨਾਮ ਕੀ ਹੈ?",
  odia: "ନମସ୍କାର! ମୁଁ ParivarSehat AI। ଆପଣଙ୍କ ପରିବାର ପାଇଁ meal plan ତିଆରି କରିବାରେ ସାହାଯ୍ୟ କରିବି। ଆପଣଙ୍କ ପରିବାରର ନାମ କ'ଣ?",
};

// Localised "didn't catch" and "error" prompts — shown as chat bubbles and spoken aloud
const RETRY_MSG: Record<string, string> = {
  hindi: "क्या आप दोबारा बोल सकते हैं? मुझे सुनाई नहीं दिया।",
  english: "Could you please repeat that? I didn't catch it.",
  bengali: "আবার বলবেন? আমি বুঝতে পারিনি।",
  tamil: "மன்னிக்கவும், மீண்டும் சொல்ல முடியுமா? கேட்கவில்லை.",
  telugu: "క్షమించండి, మళ్ళీ చెప్పగలరా? వినిపించలేదు.",
  marathi: "पुन्हा सांगाल का? मला ऐकू आले नाही.",
  gujarati: "ફરી કહેશો? મને સંભળાઈ નહીં.",
  kannada: "ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಬಹುದೇ? ಕೇಳಿಸಲಿಲ್ಲ.",
  malayalam: "ഒന്നു കൂടി പറയാമോ? കേൾക്കാൻ കഴിഞ്ഞില്ല.",
  punjabi: "ਕੀ ਤੁਸੀਂ ਦੁਬਾਰਾ ਕਹਿ ਸਕਦੇ ਹੋ? ਸੁਣਾਈ ਨਹੀਂ ਦਿੱਤਾ।",
  odia: "ଦୟାକରି ପୁଣି ଥରେ କହିବେ? ଶୁଣିପାରିଲି ନାହିଁ।",
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

  if (parsed.currentMember && typeof parsed.currentMember === "object") {
    const m = parsed.currentMember as Record<string, unknown>;
    const member = {
      name: m.name != null ? String(m.name) : null,
      role: m.role ? String(m.role) : "other",
      age: typeof m.age === "number" ? (m.age as number) : null,
      gender: m.gender ? String(m.gender) : "male",
      healthConditions: Array.isArray(m.healthConditions)
        ? (m.healthConditions as string[])
        : [],
      healthGoal: m.healthGoal ? String(m.healthGoal) : "general_wellness",
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

// Multilingual correction/undo detection — keeps same state and re-asks
const CORRECTION_PATTERNS = [
  "nahi", "nahin", "galat", "wapas", "phirse", "ruk", "dobara", "cancel",
  "wrong", "correction", "no wait", "not that", "redo", "back",
  "illa", "illai", "ledu", "illa", "naa", "athe alla", "illa bidi",
  "nahi jana", "nahi chahiye", "mistake", "bhul gaya",
];

function isCorrectionIntent(transcript: string): boolean {
  if (transcript.length > 80) return false;
  const lower = transcript.toLowerCase().trim();
  return CORRECTION_PATTERNS.some(p => lower.startsWith(p) || lower === p);
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
  odia: "ଠିକ ଅଛି, ପୁଣି ଥρ कहé.",
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

      const speakText = (text: string): Promise<void> =>
        new Promise((resolve) => {
          if (abortRef.current || !window.speechSynthesis) {
            resolve();
            return;
          }
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(text);
          utt.lang = ttsLang;
          utt.rate = 0.9;
          utt.pitch = 1.1;
          utt.onend = () => resolve();
          utt.onerror = () => resolve();
          window.speechSynthesis.speak(utt);
        });

      const recordOnce = (): Promise<string> =>
        new Promise(async (resolve, reject) => {
          let stream: MediaStream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          } catch {
            reject(new Error("Microphone access denied. Please allow microphone and try again."));
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
            nextMsg = RETRY_MSG[language] ?? RETRY_MSG.english;
            msgs = [...msgs, { role: "user", text: "..." }, { role: "assistant", text: nextMsg }];
            setMessages([...msgs]);
            continue;
          }

          // Correction intent: user said "nahi", "galat", "wrong" etc. — re-ask same question
          if (isCorrectionIntent(transcript)) {
            const correctionReply = CORRECTION_MSG[language] ?? CORRECTION_MSG.english;
            msgs = [...msgs, { role: "user", text: transcript }, { role: "assistant", text: `${correctionReply} ${nextMsg}` }];
            setMessages([...msgs]);
            nextMsg = `${correctionReply} ${nextMsg}`;
            continue;
          }

          msgs = [...msgs, { role: "user", text: transcript }];
          setMessages([...msgs]);
          setMicState("processing");

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
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
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
