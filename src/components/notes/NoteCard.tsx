"use client";

import { nodeByCode } from "@/lib/industry";
import type { Note } from "@/lib/types";

// Show only the most specific linked codes as chips (drop ancestors that are
// already implied by a deeper selected code) to keep the card readable.
function displayCodes(linkedCodes: string[]): string[] {
  const set = new Set(linkedCodes);
  return linkedCodes.filter((code) => {
    const node = nodeByCode.get(code)?.node;
    if (!node) return false;
    // Hide this code if any other selected code is a descendant of it.
    return !linkedCodes.some((other) => {
      if (other === code) return false;
      const anc = nodeByCode.get(other)?.ancestors ?? [];
      return anc.includes(code);
    });
  }).filter((c) => set.has(c));
}

export function NoteCard({
  note,
  onEdit,
  onDelete,
  compact,
}: {
  note: Note;
  onEdit?: () => void;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const codes = displayCodes(note.linkedCodes);
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-100">
            {note.person || "—"}
            {note.position && (
              <span className="text-zinc-400"> · {note.position}</span>
            )}
          </div>
          <div className="truncate text-xs text-zinc-400">
            {note.company}
            {note.contactDate && (
              <span className="text-zinc-500">
                {note.company ? " · " : ""}
                {note.contactDate.toDate().toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        {(onEdit || onDelete) && (
          <div className="flex shrink-0 gap-1 text-xs">
            {onEdit && (
              <button
                onClick={onEdit}
                className="rounded px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {note.body && (
        <p
          className={
            "mt-2 whitespace-pre-line text-xs leading-snug text-zinc-300 " +
            (compact ? "line-clamp-3" : "")
          }
        >
          {note.body}
        </p>
      )}

      {codes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.aiSorted && (
            <span className="rounded bg-blue-900/40 px-1.5 py-0.5 text-[10px] text-blue-300">
              ✦ AI
            </span>
          )}
          {codes.map((code) => (
            <span
              key={code}
              className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300"
            >
              {nodeByCode.get(code)?.node.title ?? code}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
