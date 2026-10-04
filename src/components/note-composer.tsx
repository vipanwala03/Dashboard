"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { addNoteAction } from "@/app/dashboard/actions";
import { appendPhrase, useDictation } from "@/lib/use-dictation";
import { fieldClass, MicButton, primaryButton } from "./ui";

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className={primaryButton}>
      {pending ? "Saving…" : "Save note"}
    </button>
  );
}

export function NoteComposer() {
  const [text, setText] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const dictation = useDictation((phrase) => {
    setText((prev) => appendPhrase(prev, phrase));
    setUsedVoice(true);
  });

  return (
    <form
      action={async (formData) => {
        dictation.stop();
        await addNoteAction(formData);
        setText("");
        setUsedVoice(false);
      }}
      className="flex flex-col gap-2.5"
    >
      <input type="hidden" name="source" value={usedVoice ? "voice" : "text"} />
      <label htmlFor="note-content" className="sr-only">
        New note
      </label>
      <textarea
        id="note-content"
        name="content"
        value={
          dictation.listening && dictation.interim
            ? appendPhrase(text, dictation.interim)
            : text
        }
        onChange={(e) => setText(e.target.value)}
        // Typing while dictating would fight with the incoming transcript.
        readOnly={dictation.listening}
        rows={3}
        placeholder={
          dictation.supported
            ? "Jot something down, or tap the mic and talk"
            : "Jot something down"
        }
        className={`${fieldClass} resize-none py-3`}
      />
      <div className="flex items-center justify-between gap-2">
        {dictation.supported ? (
          <MicButton
            listening={dictation.listening}
            label="Dictate"
            onClick={dictation.listening ? dictation.stop : dictation.start}
          />
        ) : (
          <span />
        )}
        <SaveButton disabled={!text.trim() || dictation.listening} />
      </div>
      {dictation.error && (
        <p className="text-sm text-danger-ink">{dictation.error}</p>
      )}
    </form>
  );
}
