import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, X, Volume2, Loader2, CheckCircle2, Circle } from "lucide-react";
import { useVoiceAssistant, type VoiceFormData } from "@/hooks/use-voice-assistant";
import { INDIAN_LANGUAGES } from "@/lib/languages";
import { useLanguageStore } from "@/store/useLanguageStore";

interface Props {
  open: boolean;
  language: string;
  onClose: (partialData?: VoiceFormData) => void;
  onComplete: (data: VoiceFormData) => void;
}

function ProgressItem({ label, value }: { label: string; value?: string | number | null }) {
  const filled = value != null && value !== "" && value !== 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      {filled ? (
        <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
      ) : (
        <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      )}
      <span className={filled ? "text-foreground" : "text-muted-foreground"}>
        {label}
        {filled && (
          <span className="font-medium text-green-700 ml-1">
            {String(value)}
          </span>
        )}
      </span>
    </div>
  );
}

function AudioWaveform({ active, volume = 0 }: { active: boolean; volume?: number }) {
  const count = 20;
  return (
    <div className="flex items-end gap-px h-8">
      {Array.from({ length: count }, (_, i) => {
        const baseHeight = 15 + Math.abs(Math.sin(i * 0.9 + 1)) * 55;
        const liveHeight = active
          ? Math.max(10, baseHeight * Math.max(0.25, volume / 80))
          : 12;
        return (
          <div
            key={i}
            className="w-1 rounded-full transition-all duration-100"
            style={{
              height: `${Math.round(liveHeight)}%`,
              backgroundColor: active ? "#f97316" : "#fdba74",
              animation: active
                ? `waveBar ${0.35 + (i % 6) * 0.07}s ease-in-out ${i * 0.04}s infinite alternate`
                : undefined,
              minHeight: "3px",
            }}
          />
        );
      })}
    </div>
  );
}

function PulseRing({ color = "orange" }: { color?: string }) {
  return (
    <span
      className="absolute inset-0 rounded-full animate-ping opacity-40"
      style={{ backgroundColor: color === "orange" ? "#f97316" : "#6366f1" }}
    />
  );
}

export default function VoiceAssistantModal({ open, language, onClose, onComplete }: Props) {
  const { micState, convState, messages, formData, error, volume, start, stop, stopListeningEarly } =
    useVoiceAssistant();
  const { currentLanguage, setLanguage: setGlobalLanguage } = useLanguageStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [pickedLang, setPickedLang] = useState<string | null>(null);

  useEffect(() => {
    if (open && !hasStarted && currentLanguage !== "english") {
      setPickedLang(currentLanguage);
      setHasStarted(true);
      start(currentLanguage, onComplete);
    }
  }, [open]);

  const handlePickLanguage = (lang: string) => {
    setPickedLang(lang);
    setGlobalLanguage(lang);
    setHasStarted(true);
    start(lang, onComplete);
  };

  useEffect(() => {
    if (!open) {
      stop();
      setHasStarted(false);
      setPickedLang(null);
    }
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // 8-second safety timeout: if still listening after 8s, stop the recorder.
  // The hook's retry loop then receives an empty transcript and speaks the localized
  // "didn't catch that" message via the hook's own TTS path — no duplicate audio.
  useEffect(() => {
    if (micState !== "listening") return;
    const t = setTimeout(() => {
      stopListeningEarly();
    }, 8000);
    return () => clearTimeout(t);
  }, [micState, stopListeningEarly]);

  const handleClose = () => {
    const partial = Object.keys(formData).length > 0 ? { ...formData } : undefined;
    stop();
    onClose(partial);
  };

  const micLabel = {
    idle: "Tap mic to respond",
    listening: "Listening… tap to stop",
    processing: "Processing…",
    speaking: "Speaking…",
    complete: "Profile complete!",
  }[micState];

  const memberCount = formData.members?.length ?? 0;

  return (
    <>
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.4); }
          to   { transform: scaleY(1); }
        }
      `}</style>

      <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
        <DialogContent
          className="fixed inset-0 w-screen h-screen max-w-none max-h-none rounded-none translate-x-0 translate-y-0 left-0 top-0 flex flex-col p-0 gap-0 overflow-hidden"
          hideCloseButton
          aria-describedby="voice-setup-desc"
        >
          <DialogTitle className="sr-only">Voice Setup</DialogTitle>
          <p className="sr-only" id="voice-setup-desc">Set up your family profile using voice</p>

          {!pickedLang ? (
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-10 gap-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                  AI
                </div>
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold mb-1">🙏 Namaste!</p>
                <p className="text-sm text-muted-foreground">Select your preferred language to continue:</p>
                <p className="text-xs text-muted-foreground">अपनी भाषा चुनें:</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2.5 max-w-sm">
                {INDIAN_LANGUAGES.map(l => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => handlePickLanguage(l.key)}
                    className="px-4 py-2 text-sm font-medium rounded-full bg-white border border-secondary/30 hover:bg-secondary/10 hover:border-secondary/60 transition-colors shadow-sm"
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground mt-4"
                onClick={handleClose}
              >
                Cancel
              </Button>
            </div>
          ) : (
          <>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-primary/5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
                AI
              </div>
              <div>
                <p className="font-semibold text-sm leading-tight">ParivarSehat AI</p>
                <p className="text-xs text-muted-foreground leading-tight">Voice Setup</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full w-8 h-8"
              onClick={handleClose}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Conversation + Progress layout */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Chat area */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth"
            >
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex gap-2 items-end ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs shrink-0 mb-0.5">
                      AI
                    </div>
                  )}
                  <div
                    className={`max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.role === "assistant"
                        ? "bg-orange-50 border border-orange-100 text-foreground rounded-bl-sm"
                        : "bg-white border border-border text-foreground rounded-br-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Typing indicator when processing */}
              {micState === "processing" && (
                <div className="flex gap-2 items-end">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-xs shrink-0">
                    AI
                  </div>
                  <div className="bg-orange-50 border border-orange-100 px-4 py-3 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1 items-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Error message */}
              {convState === "error" && error && (
                <div className="text-center">
                  <p className="text-xs text-destructive bg-destructive/10 rounded-xl px-3 py-2">
                    {error}
                  </p>
                </div>
              )}

              {/* Complete state */}
              {convState === "complete" && (
                <div className="text-center py-2">
                  <div className="inline-flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-full px-4 py-2 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Profile complete — submitting…
                  </div>
                </div>
              )}
            </div>

            {/* Progress sidebar */}
            <div className="w-44 border-l bg-muted/30 px-3 py-4 shrink-0 hidden sm:flex flex-col gap-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Progress
              </p>
              <div className="space-y-2.5">
                <ProgressItem label="Family" value={formData.familyName} />
                <ProgressItem label="State" value={formData.state} />
                <ProgressItem
                  label="Budget"
                  value={formData.monthlyBudget ? `₹${formData.monthlyBudget}` : undefined}
                />
                <ProgressItem label="Diet" value={formData.dietaryType} />
                <ProgressItem
                  label="Members"
                  value={memberCount > 0 ? `${memberCount} added` : undefined}
                />
              </div>

              {memberCount > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-medium">Members:</p>
                  {formData.members?.map((m, i) => (
                    <div key={i} className="text-[10px] text-foreground leading-tight">
                      <span className="font-medium">{m.name ?? "?"}</span>
                      <span className="text-muted-foreground"> ({m.role})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="border-t bg-white px-5 py-4 shrink-0">
            <div className="flex flex-col items-center gap-3">
              {/* Mic button */}
              <div className="relative">
                {micState === "listening" && <PulseRing />}
                <button
                  onClick={() => {
                    if (micState === "listening") stopListeningEarly();
                  }}
                  disabled={micState === "processing" || micState === "speaking" || convState === "complete"}
                  className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 ${
                    micState === "listening"
                      ? "bg-red-500 text-white shadow-lg scale-110"
                      : micState === "speaking"
                      ? "bg-primary text-white shadow-md"
                      : micState === "processing"
                      ? "bg-muted text-muted-foreground cursor-not-allowed"
                      : convState === "complete"
                      ? "bg-green-500 text-white"
                      : "bg-primary text-white hover:bg-primary/90 shadow-md hover:shadow-lg"
                  }`}
                >
                  {micState === "processing" ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : micState === "speaking" ? (
                    <Volume2 className="w-6 h-6" />
                  ) : micState === "listening" ? (
                    <MicOff className="w-6 h-6" />
                  ) : convState === "complete" ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <Mic className="w-6 h-6" />
                  )}
                </button>
              </div>

              {/* Waveform always visible — active (orange, animated) while mic/speaker on, flat bars when idle */}
              <div className="flex flex-col items-center gap-1">
                <AudioWaveform
                  active={micState === "listening" || micState === "speaking"}
                  volume={micState === "listening" ? volume : micState === "speaking" ? 60 : 0}
                />
                <p className="text-xs text-muted-foreground text-center">{micLabel}</p>
              </div>

              {/* Type instead button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 mt-1"
                onClick={handleClose}
              >
                Type instead
              </Button>
            </div>
          </div>
          </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
