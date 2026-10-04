"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// TypeScript's DOM types include the speech *result* types but not the
// recognizer itself, so declare just the parts used here.
type Recognizer = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        resultIndex: number;
        results: SpeechRecognitionResultList;
      }) => void)
    | null;
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

// Browser speech-to-text (Web Speech API) for a text field. `onFinal` gets
// each finished phrase; `interim` holds words still being recognized so the
// field can show them greyed out. Firefox has no speech recognition —
// `supported` is false there (and during server render), so hide the mic.
export function useDictation(onFinal: (phrase: string) => void) {
  const supported = useSyncExternalStore(
    () => () => {},
    () => getRecognizerConstructor() !== undefined,
    () => false
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognizerRef = useRef<Recognizer | null>(null);
  // The latest callback, so a recognizer started earlier never calls a
  // stale one.
  const onFinalRef = useRef(onFinal);
  useEffect(() => {
    onFinalRef.current = onFinal;
  });

  // Stop listening if the component goes away mid-dictation.
  useEffect(() => () => recognizerRef.current?.stop(), []);

  const start = () => {
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
      if (finalText.trim()) onFinalRef.current(finalText.trim());
      setInterim(interimText);
    };
    recognizer.onerror = (event) => {
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was blocked — allow it in your browser's site settings."
          : event.error === "no-speech" || event.error === "aborted"
            ? null
            : `Voice input stopped (${event.error}).`
      );
    };
    recognizer.onend = () => {
      setListening(false);
      setInterim("");
      recognizerRef.current = null;
    };

    setError(null);
    recognizerRef.current = recognizer;
    recognizer.start();
    setListening(true);
  };

  const stop = () => recognizerRef.current?.stop();

  return { supported, listening, interim, error, start, stop };
}

// Appends a dictated phrase to existing text with a single space between.
export function appendPhrase(text: string, phrase: string) {
  return text && !/\s$/.test(text) ? `${text} ${phrase}` : text + phrase;
}
