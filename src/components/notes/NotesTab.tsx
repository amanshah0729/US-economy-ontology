"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { deleteNoteDoc, subscribeOrgNotes } from "@/lib/db";
import { nodeByCode } from "@/lib/industry";
import { NoteForm } from "@/components/notes/NoteForm";
import { NoteCard } from "@/components/notes/NoteCard";
import type { Note } from "@/lib/types";

export function NotesTab() {
  const { orgId } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!orgId) return;
    const unsub = subscribeOrgNotes(orgId, setNotes);
    return unsub;
  }, [orgId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => {
      const codeTitles = n.linkedCodes
        .map((c) => nodeByCode.get(c)?.node.title ?? "")
        .join(" ")
        .toLowerCase();
      return (
        n.person.toLowerCase().includes(q) ||
        n.company.toLowerCase().includes(q) ||
        n.position.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        codeTitles.includes(q)
      );
    });
  }, [notes, search]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <input
          className="w-64 rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm outline-none focus:border-blue-500"
          placeholder="Search notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="text-xs text-zinc-500">{filtered.length} notes</span>
        <button
          onClick={() => {
            setEditing(null);
            setCreating(true);
          }}
          className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + New note
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {(creating || editing) && (
          <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="mb-3 text-sm font-semibold">
              {editing ? "Edit note" : "New note"}
            </h3>
            <NoteForm
              note={editing ?? undefined}
              onDone={() => {
                setCreating(false);
                setEditing(null);
              }}
              onCancel={() => {
                setCreating(false);
                setEditing(null);
              }}
            />
          </div>
        )}

        {filtered.length === 0 && !creating ? (
          <p className="mt-12 text-center text-sm text-zinc-500">
            No notes yet. Click “New note” to add one.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => {
                  setCreating(false);
                  setEditing(note);
                }}
                onDelete={() => {
                  if (confirm("Delete this note?")) deleteNoteDoc(note.id);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
