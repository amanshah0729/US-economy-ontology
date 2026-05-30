"use client";

import { NoteForm } from "@/components/notes/NoteForm";

// Modal wrapper around NoteForm, opened from the industry tree's pinned panel.
// Pre-links the note to the clicked industry via initialCodes.
export function AddNoteModal({
  initialCodes,
  onClose,
}: {
  initialCodes: string[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">Add note</h3>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <NoteForm
          initialCodes={initialCodes}
          onDone={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
