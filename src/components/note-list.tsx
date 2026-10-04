import type { Note } from "@/lib/notes";
import { deleteNoteAction } from "@/app/dashboard/actions";
import { PlanNoteButton } from "./planner-controls";

export function NoteList({
  notes,
  timeZone,
}: {
  notes: Note[];
  timeZone: string;
}) {
  if (notes.length === 0) {
    return <p className="text-sm text-ink-muted">No notes yet.</p>;
  }

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    // Keeps the panel row from growing past its neighbours; older notes
    // scroll inside it.
    <ul className="-mr-2 flex max-h-72 flex-col gap-2 overflow-y-auto pr-2">
      {notes.map((note) => (
        <li key={note.id} className="rounded-[10px] bg-raised px-3 py-2.5">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-soft">
            {note.content}
          </p>
          <div className="mt-1.5 flex items-center justify-between gap-4 text-xs text-ink-muted">
            <span>
              {fmt.format(new Date(note.created_at))}
              {note.source === "voice" && " · dictated"}
            </span>
            <div className="flex items-center gap-3">
              <PlanNoteButton noteId={note.id} />
              <form action={deleteNoteAction}>
                <input type="hidden" name="noteId" value={note.id} />
                <button
                  type="submit"
                  className="py-1 underline-offset-2 hover:text-ink hover:underline"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
