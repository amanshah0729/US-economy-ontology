"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { subscribeNotesByCode } from "@/lib/db";
import { NoteCard } from "@/components/notes/NoteCard";
import type { Note } from "@/lib/types";

// Lists every org note linked to a given NAICS code — including notes created
// elsewhere whose AI sort (or ancestor expansion) tagged this industry.
export function NotesByIndustryPanel({ code }: { code: string }) {
  const { orgId } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    if (!orgId || !code) return;
    const unsub = subscribeNotesByCode(orgId, code, setNotes);
    return unsub;
  }, [orgId, code]);

  if (notes.length === 0) {
    return (
      <p className="px-1 py-2 text-xs text-zinc-500">
        No notes linked to this industry yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} compact />
      ))}
    </div>
  );
}
