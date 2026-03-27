import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, X, Volume2, Loader2, CheckCircle2, Circle } from "lucide-react";
import { useVoiceAssistant, type VoiceFormData } from "@/hooks/use-voice-assistant";

interface Props {
  open: boolean;
  language: string;
  onClose: () => void;
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

function WaveAnimation() {
  return (
    <div className="flex items-end gap-0.5 h-5">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="w-1 rounded-full bg-primary"
          style={{
            height: `${20 + Math.random() * 60}%`,
            animation: `waveBar 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
          }}
        />
      ))}
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
  const { micState, convState, messages, formData, error, start, stop, stopListeningEarly } =
    useVoiceAssistant();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [hasStarted, setHasStarted] = useState(false);

  useEffect(() => {
    if (open && !hasStarted) {
      setHasStarted(true);
      start(language, onComplete);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      stop();
      setHasStarted(false);
    }
  }, [open]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  const handleClose = () => {
    stop();
    onClose();
  };

  const micLabel = {
    idle: "Tap mic to respond",
    listening: "Listening… tap to stop",
    processing: "Processing…",
    speaking: "Speaking…",
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
          className="max-w-lg w-full h-[90dvh] flex flex-col p-0 gap-0 rounded-2xl overflow-hidden"
          hideCloseButton
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b bg-primary/5">
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
          <div className="flex flex-1 overflow-hidden">
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
            <div className="w-36 border-l bg-muted/30 px-3 py-4 shrink-0 hidden sm:flex flex-col gap-3">
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
          <div className="border-t bg-white px-5 py-4">
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

              {/* Status text */}
              <div className="flex items-center gap-2 h-5">
                {micState === "speaking" ? (
                  <WaveAnimation />
                ) : (
                  <p className="text-xs text-muted-foreground text-center">{micLabel}</p>
                )}
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
        </DialogContent>
      </Dialog>
    </>
  );
}
