"use client";

import { nodeByCode } from "@/lib/industry";
import type { Note } from "@/lib/types";

export function NoteDetailModal({
  note,
  onClose,
  onEdit,
  onDelete,
}: {
  note: Note;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-zinc-100">
              {note.person || "—"}
              {note.position && (
                <span className="text-zinc-400"> · {note.position}</span>
              )}
            </div>
            <div className="text-xs text-zinc-400">
              {note.company}
              {note.contactDate && (
                <span className="text-zinc-500">
                  {note.company ? " · " : ""}
                  {note.contactDate.toDate().toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {note.body ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">
              {note.body}
            </p>
          ) : (
            <p className="text-sm italic text-zinc-500">No note body.</p>
          )}

          {note.followUp && (
            <div className="mt-4 rounded-md border border-amber-800/60 bg-amber-900/20 p-3">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
                Next steps / follow-up
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-amber-100">
                {note.followUp}
              </p>
            </div>
          )}

          {note.linkedCodes.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Linked industries
              </div>
              <div className="flex flex-wrap gap-1">
                {note.linkedCodes.map((code) => (
                  <span
                    key={code}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-300"
                  >
                    {nodeByCode.get(code)?.node.title ?? code}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-3">
            {onDelete && (
              <button
                onClick={onDelete}
                className="rounded-md px-3 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-400"
              >
                Delete
              </button>
            )}
            {onEdit && (
              <button
                onClick={onEdit}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Edit
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
