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
  hindi:
    "नमस्ते! मैं ParivarSehat AI हूं। मैं आपके परिवार का personalized meal plan बनाने में मदद करूंगा। आपके परिवार का नाम क्या है?",
  english:
    "Hello! I'm ParivarSehat AI. I'll help set up your family's personalized meal plan. What is your family name?",
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

export function useVoiceAssistant() {
  const [micState, setMicState] = useState<MicState>("idle");
  const [convState, setConvState] = useState<ConvState>("idle");
  const [messages, setMessages] = useState<ConvMessage[]>([]);
  const [formData, setFormData] = useState<VoiceFormData>({});
  const [error, setError] = useState<string | null>(null);

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
      // TTS locale must match the script used in assistant messages.
      // Backend currently produces Devanagari Hindi or English — never other scripts.
      const ttsLang = language === "hindi" ? "hi-IN" : "en-IN";
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

          if (!transcript.trim()) {
            nextMsg =
              language === "hindi"
                ? "क्या आप दोबारा बोल सकते हैं? मुझे सुनाई नहीं दिया।"
                : "Could you please repeat that? I didn't catch it.";
            msgs = [...msgs, { role: "user", text: "..." }, { role: "assistant", text: nextMsg }];
            setMessages([...msgs]);
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
            const fallback =
              language === "hindi"
                ? "कुछ समस्या आ गई। क्या आप दोबारा बोल सकते हैं?"
                : "Something went wrong. Could you repeat that?";
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
    start,
    stop,
    stopListeningEarly,
  };
}
