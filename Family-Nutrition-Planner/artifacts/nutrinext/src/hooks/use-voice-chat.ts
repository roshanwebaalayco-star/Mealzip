import { useState, useRef, useCallback, useEffect } from "react";
import { useLanguageStore } from "@/store/useLanguageStore";
import { LANG_TO_BCP47 } from "@/lib/languages";
import { recordOnce, getVoiceForLang, waitForVoices } from "@/lib/audio-utils";

export type VoiceChatMicState =
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

const SENTENCE_REGEX = /[^.!?।\n]+[.!?।]+/g;

export function useVoiceChat() {
  const [voiceMode, setVoiceMode] = useState(false);
  const [micState, setMicState] = useState<VoiceChatMicState>("idle");
  const [volume, setVolume] = useState(0);

  const voiceModeRef = useRef(false);
  const abortCtrlRef = useRef<AbortController | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const ttsBufferRef = useRef("");
  const sentenceQueueRef = useRef<string[]>([]);
  const isSpeakingRef = useRef(false);
  const onStreamDoneRef = useRef<(() => void) | null>(null);
  const streamDoneRef = useRef(false);
  const onListenReadyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    waitForVoices();
  }, []);

  const getBcp47 = useCallback(() => {
    const lang = useLanguageStore.getState().currentLanguage;
    return LANG_TO_BCP47[lang] ?? "en-IN";
  }, []);

  const speakSentence = useCallback(
    (text: string, bcp47: string): Promise<void> =>
      new Promise((resolve) => {
        if (!window.speechSynthesis || !text.trim()) {
          resolve();
          return;
        }
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = bcp47;
        utt.rate = 0.95;
        utt.pitch = 1.05;
        const voice = getVoiceForLang(bcp47);
        if (voice) utt.voice = voice;
        activeUtteranceRef.current = utt;
        utt.onend = () => {
          activeUtteranceRef.current = null;
          resolve();
        };
        utt.onerror = () => {
          activeUtteranceRef.current = null;
          resolve();
        };
        window.speechSynthesis.speak(utt);
      }),
    []
  );

  const processQueue = useCallback(async () => {
    if (isSpeakingRef.current) return;
    isSpeakingRef.current = true;
    const bcp47 = getBcp47();

    while (sentenceQueueRef.current.length > 0) {
      if (!voiceModeRef.current) break;
      const sentence = sentenceQueueRef.current.shift()!;
      setMicState("speaking");
      await speakSentence(sentence, bcp47);
    }

    isSpeakingRef.current = false;

    if (
      streamDoneRef.current &&
      sentenceQueueRef.current.length === 0 &&
      voiceModeRef.current
    ) {
      const remaining = ttsBufferRef.current.trim();
      if (remaining) {
        ttsBufferRef.current = "";
        setMicState("speaking");
        await speakSentence(remaining, bcp47);
      }
      setMicState("idle");
      if (onStreamDoneRef.current) {
        onStreamDoneRef.current();
        onStreamDoneRef.current = null;
      }
    }
  }, [getBcp47, speakSentence]);

  const feedChunk = useCallback(
    (chunk: string) => {
      ttsBufferRef.current += chunk;
      const matches = ttsBufferRef.current.match(SENTENCE_REGEX);
      if (matches && matches.length > 0) {
        let consumed = 0;
        for (const m of matches) {
          const idx = ttsBufferRef.current.indexOf(m, consumed);
          if (idx >= 0) consumed = idx + m.length;
          sentenceQueueRef.current.push(m.trim());
        }
        ttsBufferRef.current = ttsBufferRef.current.slice(consumed);
        processQueue();
      }
    },
    [processQueue]
  );

  const flushBuffer = useCallback(() => {
    streamDoneRef.current = true;
    if (sentenceQueueRef.current.length === 0 && !isSpeakingRef.current) {
      const remaining = ttsBufferRef.current.trim();
      if (remaining) {
        sentenceQueueRef.current.push(remaining);
        ttsBufferRef.current = "";
      }
      processQueue();
    }
  }, [processQueue]);

  const listenOnce = useCallback(async (): Promise<string | null> => {
    if (!voiceModeRef.current) return null;
    setMicState("listening");
    const bcp47 = getBcp47();
    const ctrl = new AbortController();
    abortCtrlRef.current = ctrl;

    try {
      const transcript = await recordOnce({
        languageCode: bcp47,
        onVolume: setVolume,
        abortSignal: ctrl.signal,
        audioCtx: audioCtxRef.current,
      });
      setVolume(0);
      if (!transcript.trim()) return null;
      return transcript;
    } catch (e) {
      if ((e as Error).message === "aborted") return null;
      throw e;
    } finally {
      abortCtrlRef.current = null;
    }
  }, [getBcp47]);

  const startVoiceMode = useCallback(async () => {
    voiceModeRef.current = true;
    setVoiceMode(true);

    try {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") await ctx.resume();
      audioCtxRef.current = ctx;
    } catch {
      /* fallback: no persistent audioCtx */
    }

    await waitForVoices();
  }, []);

  const stopVoiceMode = useCallback(() => {
    voiceModeRef.current = false;
    setVoiceMode(false);
    setMicState("idle");
    setVolume(0);

    if (abortCtrlRef.current) {
      abortCtrlRef.current.abort();
      abortCtrlRef.current = null;
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    activeUtteranceRef.current = null;
    ttsBufferRef.current = "";
    sentenceQueueRef.current = [];
    isSpeakingRef.current = false;
    streamDoneRef.current = false;
    onStreamDoneRef.current = null;

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
    }
  }, []);

  const bargeIn = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    activeUtteranceRef.current = null;
    sentenceQueueRef.current = [];
    ttsBufferRef.current = "";
    isSpeakingRef.current = false;
    streamDoneRef.current = false;
  }, []);

  const resetStreamState = useCallback(() => {
    ttsBufferRef.current = "";
    sentenceQueueRef.current = [];
    isSpeakingRef.current = false;
    streamDoneRef.current = false;
    onStreamDoneRef.current = null;
  }, []);

  const waitForSpeechDone = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (
        !isSpeakingRef.current &&
        sentenceQueueRef.current.length === 0 &&
        streamDoneRef.current
      ) {
        resolve();
        return;
      }
      onStreamDoneRef.current = resolve;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (voiceModeRef.current) {
        voiceModeRef.current = false;
        if (abortCtrlRef.current) abortCtrlRef.current.abort();
        if (window.speechSynthesis) window.speechSynthesis.cancel();
        if (audioCtxRef.current)
          try {
            audioCtxRef.current.close();
          } catch {
            /* */
          }
      }
    };
  }, []);

  return {
    voiceMode,
    micState,
    volume,
    setMicState,
    startVoiceMode,
    stopVoiceMode,
    bargeIn,
    listenOnce,
    feedChunk,
    flushBuffer,
    resetStreamState,
    waitForSpeechDone,
  };
}
