import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  X,
  ChevronRight,
} from "lucide-react";
import {
  useChat,
  getActionCardMeta,
  ActionPayload,
  ChatMessage,
} from "../hooks/useChat";
import {
  useSpeechRecognition,
  LANGUAGE_CODES,
} from "../hooks/useVoice";
import { useAppState } from "@/hooks/use-app-state";

interface ChatProps {
  onActionApplied?: (action: ActionPayload) => void;
}

function ActionCard({
  payload,
  onApply,
  onDismiss,
}: {
  payload:   ActionPayload;
  onApply:   (p: ActionPayload) => void;
  onDismiss: () => void;
}) {
  const meta = getActionCardMeta(payload);

  const borderStyle = {
    primary: "border-green-500  bg-green-50",
    warning: "border-yellow-500 bg-yellow-50",
    info:    "border-blue-500   bg-blue-50",
  }[meta.variant];

  const btnStyle = {
    primary: "bg-green-600  hover:bg-green-700  text-white",
    warning: "bg-yellow-600 hover:bg-yellow-700 text-white",
    info:    "bg-blue-600   hover:bg-blue-700   text-white",
  }[meta.variant];

  return (
    <div className={`rounded-xl border-l-4 p-3 mb-2 flex flex-col gap-2 shadow-sm ${borderStyle}`}>
      <p className="text-sm text-gray-700">{meta.description}</p>
      <div className="flex gap-2 items-center">
        <button
          onClick={() => onApply(payload)}
          className={`flex items-center gap-1 text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${btnStyle}`}
        >
          {meta.buttonLabel}
          <ChevronRight size={14} />
        </button>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 p-1 rounded-lg transition-colors"
          aria-label="Dismiss suggestion"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-green-600 text-white rounded-br-sm"
            : "bg-white text-gray-800 border border-gray-100 shadow-sm rounded-bl-sm"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.text}</p>
        {message.isStreaming && (
          <span className="inline-block w-1.5 h-3.5 bg-current opacity-75 animate-pulse ml-0.5 align-middle" />
        )}
      </div>
    </div>
  );
}

export default function Chat({ onActionApplied }: ChatProps) {
  const [inputText,        setInputText]        = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [isVoiceEnabled,   setIsVoiceEnabled]   = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);

  const { activeFamily } = useAppState();

  const languageCode = useMemo(
    () => LANGUAGE_CODES[selectedLanguage] ?? "en-IN",
    [selectedLanguage]
  );

  const {
    messages,
    pendingAction,
    isLoading,
    error,
    sendMessage,
    dismissAction,
    clearError,
    isSpeaking,
    cancelSpeech,
  } = useChat({ language: languageCode, enableVoice: isVoiceEnabled, familyId: activeFamily?.id ?? null });

  const handleTranscriptReady = useCallback(
    (transcript: string) => {
      if (transcript.trim()) sendMessage(transcript.trim());
    },
    [sendMessage]
  );

  const {
    isListening,
    isSupported: isMicSupported,
    transcript,
    error:       voiceError,
    startListening,
    stopListening,
    resetTranscript,
  } = useSpeechRecognition(handleTranscriptReady);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendText = useCallback(() => {
    if (!inputText.trim() || isLoading) return;
    sendMessage(inputText.trim());
    setInputText("");
    if (inputRef.current) {
      inputRef.current.style.height = "44px";
    }
    inputRef.current?.focus();
  }, [inputText, isLoading, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendText();
      }
    },
    [handleSendText]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInputText(e.target.value);
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
    },
    []
  );

  const handleMicClick = useCallback(() => {
    if (isListening) {
      stopListening();
      return;
    }
    cancelSpeech();
    startListening(languageCode);
  }, [isListening, cancelSpeech, languageCode, startListening, stopListening]);

  const handleClearAllErrors = useCallback(() => {
    clearError();
    resetTranscript();
  }, [clearError, resetTranscript]);

  const handleActionApply = useCallback(
    (payload: ActionPayload) => {
      onActionApplied?.(payload);
      dismissAction();
    },
    [onActionApplied, dismissAction]
  );

  const activeError = error ?? voiceError;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] sm:h-[calc(100vh-5.5rem)] md:h-screen p-3 sm:p-4 md:p-6 w-full animate-fade-up">
      <div className="glass-elevated flex-1 rounded-3xl flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-4 py-3 border-b border-white/60 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-green-700 text-sm font-bold">PS</span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>ParivarSehat</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>ICMR-Grounded Family Health OS</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white"
            >
              {Object.keys(LANGUAGE_CODES).map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
            </select>

            <button
              onClick={() => setIsVoiceEnabled((v) => !v)}
              className={`p-1.5 rounded-lg transition-colors ${
                isVoiceEnabled
                  ? "text-green-600 bg-green-50"
                  : "text-gray-400 bg-gray-100"
              }`}
              title={isVoiceEnabled ? "Disable voice responses" : "Enable voice responses"}
            >
              {isVoiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 hide-scrollbar">
          {messages.length === 0 && (
            <div className="text-center text-sm mt-8 px-4" style={{ color: 'var(--text-tertiary)' }}>
              <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Namaskar!</p>
              <p>Ask about your family's meals, health questions, or leftovers.</p>
              <p className="mt-2 text-xs opacity-70">
                Try: "Can Papa eat tonight's dinner?" or "We had samosas for lunch"
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {pendingAction && (
            <div className="mt-1">
              <ActionCard
                payload={pendingAction}
                onApply={handleActionApply}
                onDismiss={dismissAction}
              />
            </div>
          )}

          {activeError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700 mt-2">
              <span className="flex-1">{activeError}</span>
              <button
                onClick={handleClearAllErrors}
                className="text-red-400 hover:text-red-600 flex-shrink-0"
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {isListening && transcript && (
            <div className="flex justify-end mb-1 mt-2">
              <div className="max-w-[80%] rounded-2xl px-4 py-2.5 text-sm bg-green-100 text-green-700 italic opacity-75">
                {transcript}...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="px-4 py-3 border-t border-white/60">
          {isSpeaking && (
            <div className="flex items-center gap-1.5 mb-2 text-xs text-green-600">
              <span className="flex gap-0.5 items-end">
                <span className="w-1 h-2 bg-green-500 rounded animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-3 bg-green-500 rounded animate-bounce" style={{ animationDelay: "120ms" }} />
                <span className="w-1 h-2 bg-green-500 rounded animate-bounce" style={{ animationDelay: "240ms" }} />
              </span>
              <span>Speaking... tap mic to interrupt</span>
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? "Listening..." : "Type a message or tap the mic..."}
              disabled={isListening}
              rows={1}
              style={{ minHeight: "44px", maxHeight: "96px" }}
              className="flex-1 resize-none overflow-y-auto rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
            />

            {isMicSupported && (
              <button
                onClick={handleMicClick}
                className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                  isListening
                    ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-200"
                    : isSpeaking
                    ? "bg-yellow-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title={
                  isListening ? "Stop listening"
                  : isSpeaking ? "Interrupt AI (barge-in)"
                  : "Start voice input"
                }
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}

            <button
              onClick={handleSendText}
              disabled={!inputText.trim() || isLoading}
              className="flex-shrink-0 w-11 h-11 rounded-xl bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
