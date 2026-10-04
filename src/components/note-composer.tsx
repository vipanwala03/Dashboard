"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { addNoteAction } from "@/app/dashboard/actions";

// TypeScript's DOM types include the speech *result* types but not the
// recognizer itself, so declare just the parts used here.
type Recognizer = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { resultIndex: number; results: SpeechRecognitionResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};
type RecognizerConstructor = new () => Recognizer;

function getRecognizerConstructor(): RecognizerConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognizerConstructor;
    webkitSpeechRecognition?: RecognizerConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// Firefox has no speech recognition; hide the mic there. Server render
// assumes "no" so the button only appears once the browser confirms it.
function useSpeechSupported() {
  return useSyncExternalStore(
    () => () => {},
    () => getRecognizerConstructor() !== undefined,
    () => false
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="h-10 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
    >
      {pending ? "Saving…" : "Save note"}
    </button>
  );
}

export function NoteComposer() {
  const speechSupported = useSpeechSupported();
  const [text, setText] = useState("");
  // Words still being recognized — shown greyed out, not yet in `text`.
  const [interim, setInterim] = useState("");
  const [listening, setListening] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);

  // Stop listening if the component goes away mid-dictation.
  useEffect(() => () => recognizerRef.current?.stop(), []);

  const startListening = () => {
    const Recognizer = getRecognizerConstructor();
    if (!Recognizer) return;

    const recognizer = new Recognizer();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = navigator.language;

    recognizer.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += transcript;
        else interimText += transcript;
      }
      if (finalText) {
        setText((prev) =>
          prev && !/\s$/.test(prev)
            ? `${prev} ${finalText.trim()}`
            : prev + finalText.trim()
        );
        setUsedVoice(true);
      }
      setInterim(interimText);
    };
    recognizer.onerror = (event) => {
      setMicError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was blocked — allow it in your browser's site settings."
          : event.error === "no-speech"
            ? null
            : `Voice input stopped (${event.error}).`
      );
    };
    recognizer.onend = () => {
      setListening(false);
      setInterim("");
      recognizerRef.current = null;
    };

    setMicError(null);
    recognizerRef.current = recognizer;
    recognizer.start();
    setListening(true);
  };

  const stopListening = () => recognizerRef.current?.stop();

  return (
    <form
      action={async (formData) => {
        stopListening();
        await addNoteAction(formData);
        setText("");
        setUsedVoice(false);
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="source" value={usedVoice ? "voice" : "text"} />
      <textarea
        name="content"
        value={listening && interim ? `${text}${text ? " " : ""}${interim}` : text}
        onChange={(e) => setText(e.target.value)}
        // Typing while dictating would fight with the incoming transcript.
        readOnly={listening}
        rows={3}
        placeholder={
          speechSupported ? "Type a note, or tap the mic and talk" : "Type a note"
        }
        className="w-full resize-y rounded-lg border border-zinc-300 bg-white p-3 text-black placeholder:text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />
      <div className="flex items-center justify-between gap-2">
        {speechSupported ? (
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            aria-pressed={listening}
            className={`flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors ${
              listening
                ? "border-red-500 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${listening ? "animate-pulse bg-red-500" : "bg-zinc-400"}`}
            />
            {listening ? "Stop" : "Dictate"}
          </button>
        ) : (
          <span />
        )}
        <SaveButton disabled={!text.trim() || listening} />
      </div>
      {micError && (
        <p className="text-sm text-red-600 dark:text-red-400">{micError}</p>
      )}
    </form>
  );
}
