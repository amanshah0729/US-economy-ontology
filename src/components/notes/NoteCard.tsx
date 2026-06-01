"use client";

import { useState } from "react";
import { nodeByCode } from "@/lib/industry";
import { NoteDetailModal } from "@/components/notes/NoteDetailModal";
import { NoteForm } from "@/components/notes/NoteForm";
import { deleteNoteDoc } from "@/lib/db";
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
  compact,
}: {
  note: Note;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"closed" | "view" | "edit">("closed");
  const codes = displayCodes(note.linkedCodes);

  async function handleDelete() {
    if (!confirm("Delete this note?")) return;
    await deleteNoteDoc(note.id);
    setMode("closed");
  }

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setMode("view")}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setMode("view");
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
          <div
            className="flex shrink-0 gap-1 text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setMode("edit")}
              className="rounded px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="rounded px-1.5 py-0.5 text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
            >
              Delete
            </button>
          </div>
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

      {mode === "view" && (
        <NoteDetailModal
          note={note}
          onClose={() => setMode("closed")}
          onEdit={() => setMode("edit")}
          onDelete={handleDelete}
        />
      )}

      {mode === "edit" && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setMode("closed")}
        >
          <div
            className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">Edit note</h3>
              <button
                onClick={() => setMode("closed")}
                className="text-zinc-500 hover:text-white"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <NoteForm
              note={note}
              onDone={() => setMode("closed")}
              onCancel={() => setMode("closed")}
            />
          </div>
        </div>
      )}
    </>
  );
}
