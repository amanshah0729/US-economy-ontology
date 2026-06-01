"use client";

import { useState } from "react";
import { nodeByCode } from "@/lib/industry";
import { NoteDetailModal } from "@/components/notes/NoteDetailModal";
import type { Note } from "@/lib/types";

// Show only the most specific linked codes as chips (drop ancestors that are
// already implied by a deeper selected code) to keep the card readable.
function displayCodes(linkedCodes: string[]): string[] {
  const set = new Set(linkedCodes);
  return linkedCodes.filter((code) => {
    const node = nodeByCode.get(code)?.node;
    if (!node) return false;
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
  const [open, setOpen] = useState(false);
  const codes = displayCodes(note.linkedCodes);

  function handleEdit() {
    setOpen(false);
    onEdit?.();
  }

  function handleDelete() {
    setOpen(false);
    onDelete?.();
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900/70 focus:border-blue-600 focus:outline-none"
      >
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
            <div
              className="flex shrink-0 gap-1 text-xs"
              onClick={(e) => e.stopPropagation()}
            >
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
              (compact ? "line-clamp-3" : "line-clamp-4")
            }
          >
            {note.body}
          </p>
        )}

        {note.followUp && (
          <div className="mt-2 rounded border border-amber-800/50 bg-amber-900/15 px-2 py-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              Follow-up
            </div>
            <p className="line-clamp-2 text-xs text-amber-100/90">
              {note.followUp}
            </p>
          </div>
        )}

        {(codes.length > 0 || note.aiSorted) && (
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

      {open && (
        <NoteDetailModal
          note={note}
          onClose={() => setOpen(false)}
          onEdit={onEdit ? handleEdit : undefined}
          onDelete={onDelete ? handleDelete : undefined}
        />
      )}
    </>
  );
}
