import { apiFetch } from "@/lib/api-fetch";

let cachedVoices: SpeechSynthesisVoice[] = [];

export function getVoiceForLang(bcp47: string): SpeechSynthesisVoice | null {
  if (!window.speechSynthesis) return null;
  if (cachedVoices.length === 0) {
    cachedVoices = window.speechSynthesis.getVoices();
  }
  const langPrefix = bcp47.split("-")[0];
  return (
    cachedVoices.find((v) => v.lang === bcp47) ??
    cachedVoices.find((v) => v.lang.startsWith(langPrefix)) ??
    null
  );
}

export function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve([]);
      return;
    }
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      cachedVoices = voices;
      resolve(voices);
      return;
    }
    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices();
      resolve(cachedVoices);
    }, 2000);
  });
}

export interface RecordOnceOptions {
  languageCode: string;
  silenceThreshold?: number;
  silenceHoldMs?: number;
  maxDurationMs?: number;
  onVolume?: (v: number) => void;
  abortSignal?: AbortSignal;
  audioCtx?: AudioContext | null;
}

export async function recordOnce(opts: RecordOnceOptions): Promise<string> {
  const {
    languageCode,
    silenceThreshold = 8,
    silenceHoldMs = 1800,
    maxDurationMs = 8000,
    onVolume,
    abortSignal,
  } = opts;

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    throw new Error(
      "Microphone access denied. Please enable it in your browser settings."
    );
  }

  if (abortSignal?.aborted) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error("aborted");
  }

  const mime = MediaRecorder.isTypeSupported("audio/webm")
    ? "audio/webm"
    : "audio/mp4";
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, { mimeType: mime });
  } catch {
    recorder = new MediaRecorder(stream);
  }
  const chunks: BlobPart[] = [];
  let silenceRafId: number | null = null;
  let localAudioCtx: AudioContext | null = null;

  const ownsAudioCtx = !opts.audioCtx;

  return new Promise<string>((resolve, reject) => {
    if (abortSignal) {
      const onAbort = () => {
        if (recorder.state === "recording") recorder.stop();
      };
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      if (silenceRafId != null) {
        cancelAnimationFrame(silenceRafId);
        silenceRafId = null;
      }
      if (ownsAudioCtx && localAudioCtx) {
        try {
          localAudioCtx.close();
        } catch {
          /* ignore */
        }
        localAudioCtx = null;
      }
      stream.getTracks().forEach((t) => t.stop());

      if (abortSignal?.aborted) {
        reject(new Error("aborted"));
        return;
      }

      try {
        const blob = new Blob(chunks, { type: mime });
        const ab = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(ab)));
        const res = await apiFetch("/api/voice/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audioBase64: base64, languageCode }),
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

    const stopTimer = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, maxDurationMs);

    try {
      localAudioCtx = opts.audioCtx ?? new AudioContext();
      if (localAudioCtx.state === "suspended") {
        localAudioCtx.resume();
      }
      const source = localAudioCtx.createMediaStreamSource(stream);
      const analyser = localAudioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const bufLen = analyser.frequencyBinCount;
      const data = new Uint8Array(bufLen);

      let silenceStart: number | null = null;
      let hasSpoken = false;

      const checkSilence = () => {
        if (recorder.state !== "recording") return;
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += (v - 128) ** 2;
        const rms = Math.sqrt(sum / bufLen);

        if (onVolume) onVolume(Math.min(100, Math.round((rms / 30) * 100)));

        if (rms >= silenceThreshold) {
          hasSpoken = true;
          silenceStart = null;
        } else if (hasSpoken) {
          if (silenceStart === null) silenceStart = Date.now();
          else if (Date.now() - silenceStart > silenceHoldMs) {
            clearTimeout(stopTimer);
            if (recorder.state === "recording") recorder.stop();
            return;
          }
        }
        silenceRafId = requestAnimationFrame(checkSilence);
      };
      silenceRafId = requestAnimationFrame(checkSilence);
    } catch {
      /* silence detection unavailable — timeout-only fallback */
    }
  });
}
