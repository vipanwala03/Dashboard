import type { Note } from "@/lib/notes";
import { deleteNoteAction } from "@/app/dashboard/actions";

export function NoteList({
  notes,
  timeZone,
}: {
  notes: Note[];
  timeZone: string;
}) {
  if (notes.length === 0) {
    return (
      <p className="text-zinc-600 dark:text-zinc-400">No notes yet.</p>
    );
  }

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <ul className="flex flex-col gap-2">
      {notes.map((note) => (
        <li
          key={note.id}
          className="rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p className="whitespace-pre-wrap text-black dark:text-zinc-50">
            {note.content}
          </p>
          <div className="mt-2 flex items-center justify-between gap-4 text-sm text-zinc-500">
            <span>
              {fmt.format(new Date(note.created_at))}
              {note.source === "voice" && " · dictated"}
            </span>
            <form action={deleteNoteAction}>
              <input type="hidden" name="noteId" value={note.id} />
              <button
                type="submit"
                className="underline underline-offset-2 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Delete
              </button>
            </form>
          </div>
        </li>
      ))}
    </ul>
  );
}
