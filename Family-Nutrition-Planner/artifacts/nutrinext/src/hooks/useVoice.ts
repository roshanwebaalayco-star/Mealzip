/**
 * FILE: client/hooks/useVoice.ts
 * PURPOSE: Two self-contained React hooks for native browser voice I/O.
 *
 *   useSpeechRecognition  — Microphone input (STT)
 *   useSpeechSynthesis    — Text-to-speech output with sentence streaming
 *
 * ZERO EXTERNAL DEPENDENCIES.
 * Uses only window.SpeechRecognition and window.speechSynthesis.
 *
 * BROWSER SUPPORT:
 *  - SpeechRecognition: Chrome/Edge ✅  Firefox ❌  Safari (iOS 14.5+) ✅
 *  - SpeechSynthesis:   All modern browsers ✅
 *  If SpeechRecognition is unavailable, isSupported = false.
 *  Chat.tsx shows a text input fallback in that case — no crash.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";

export const LANGUAGE_CODES: Record<string, string> = {
  English:   "en-IN",
  Hindi:     "hi-IN",
  Tamil:     "ta-IN",
  Telugu:    "te-IN",
  Marathi:   "mr-IN",
  Bengali:   "bn-IN",
  Gujarati:  "gu-IN",
  Kannada:   "kn-IN",
  Malayalam: "ml-IN",
  Punjabi:   "pa-IN",
};

function splitIntoSentences(text: string): string[] {
  const matches = text.match(/[^.?!।]+[.?!।]+/g);
  return matches
    ? matches.map((s) => s.trim()).filter((s) => s.length > 2)
    : [];
}

interface SpeechRecognitionState {
  isListening:  boolean;
  isSupported:  boolean;
  transcript:   string;
  error:        string | null;
}

interface SpeechRecognitionControls {
  startListening:  (languageCode?: string) => void;
  stopListening:   () => void;
  resetTranscript: () => void;
}

export function useSpeechRecognition(
  onTranscriptReady: (transcript: string) => void
): SpeechRecognitionState & SpeechRecognitionControls {
  const [isListening, setIsListening] = useState(false);
  const [transcript,  setTranscript]  = useState("");
  const [error,       setError]       = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window),
    []
  );

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(
    (languageCode: string = "en-IN") => {
      if (!isSupported) {
        setError("Voice input is not supported in this browser. Please type your message.");
        return;
      }

      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      const recognition = new SpeechRecognitionClass();
      recognition.lang             = languageCode;
      recognition.continuous       = false;
      recognition.interimResults   = true;
      recognition.maxAlternatives  = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
        setTranscript("");
      };

      recognition.onresult = (event: any) => {
        let finalTranscript   = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript   += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        setTranscript(finalTranscript || interimTranscript);

        if (finalTranscript) {
          onTranscriptReady(finalTranscript.trim());
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "aborted") {
          setIsListening(false);
          return;
        }

        const errorMessages: Record<string, string> = {
          "no-speech":            "No speech detected. Tap the mic and try again.",
          "audio-capture":        "Microphone access denied or unavailable.",
          "network":              "Network error during voice recognition.",
          "not-allowed":          "Microphone permission denied. Please allow mic access in browser settings.",
          "service-not-allowed":  "Speech service is not allowed. Check browser settings.",
          "bad-grammar":          "Speech grammar configuration error.",
          "language-not-supported": `Language "${languageCode}" is not supported by this browser.`,
        };

        setError(errorMessages[event.error] ?? `Voice error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [isSupported, onTranscriptReady]
  );

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    transcript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}

interface SpeechSynthesisState {
  isSpeaking:   boolean;
  isSupported:  boolean;
}

interface SpeechSynthesisControls {
  speakDelta:   (token: string) => void;
  flushBuffer:  () => void;
  cancelSpeech: () => void;
  setLanguage:  (langCode: string) => void;
}

export function useSpeechSynthesis(): SpeechSynthesisState & SpeechSynthesisControls {
  const [isSpeaking, setIsSpeaking] = useState(false);

  const sentenceBufferRef  = useRef<string>("");
  const currentLangRef     = useRef<string>("en-IN");
  const utteranceQueueRef  = useRef<SpeechSynthesisUtterance[]>([]);

  const isSupported = useMemo(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    []
  );

  const speakSentence = useCallback(
    (sentence: string) => {
      if (!isSupported || !sentence.trim()) return;

      const utterance       = new SpeechSynthesisUtterance(sentence.trim());
      utterance.lang        = currentLangRef.current;
      utterance.rate        = 0.95;
      utterance.pitch       = 1.0;
      utterance.volume      = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const langPrefix = currentLangRef.current.split("-")[0];
      const matchingVoice = voices.find(
        (v) => v.lang === currentLangRef.current || v.lang.startsWith(langPrefix)
      );
      if (matchingVoice) utterance.voice = matchingVoice;

      utterance.onstart = () => setIsSpeaking(true);

      utterance.onend = () => {
        utteranceQueueRef.current.shift();
        if (utteranceQueueRef.current.length === 0) {
          setIsSpeaking(false);
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== "interrupted" && e.error !== "canceled") {
          console.error("[TTS] Utterance error:", e.error);
        }
        setIsSpeaking(false);
      };

      utteranceQueueRef.current.push(utterance);
      window.speechSynthesis.speak(utterance);
    },
    [isSupported]
  );

  const speakDelta = useCallback(
    (token: string) => {
      if (!isSupported) return;

      sentenceBufferRef.current += token;
      const buffer = sentenceBufferRef.current;

      let lastTerminatorIndex = -1;
      for (let i = 0; i < buffer.length; i++) {
        if (/[.?!।]/.test(buffer[i])) {
          lastTerminatorIndex = i;
        }
      }

      if (lastTerminatorIndex < 0) return;

      const completePart = buffer.slice(0, lastTerminatorIndex + 1);
      sentenceBufferRef.current = buffer.slice(lastTerminatorIndex + 1);

      const sentences = splitIntoSentences(completePart);
      sentences.forEach(speakSentence);
    },
    [isSupported, speakSentence]
  );

  const flushBuffer = useCallback(() => {
    const remaining = sentenceBufferRef.current.trim();
    if (remaining.length > 0) {
      speakSentence(remaining);
      sentenceBufferRef.current = "";
    }
  }, [speakSentence]);

  const cancelSpeech = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    utteranceQueueRef.current    = [];
    sentenceBufferRef.current    = "";
    setIsSpeaking(false);
  }, [isSupported]);

  const setLanguage = useCallback((langCode: string) => {
    currentLangRef.current = langCode;
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }, [isSupported]);

  useEffect(() => {
    return () => {
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  return {
    isSpeaking,
    isSupported,
    speakDelta,
    flushBuffer,
    cancelSpeech,
    setLanguage,
  };
}
