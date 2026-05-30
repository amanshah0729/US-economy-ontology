"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { auth } from "@/lib/firebase";
import { createNote, updateNote, type NoteInput } from "@/lib/db";
import { IndustryCascadeSelect } from "@/components/industry/IndustryCascadeSelect";
import type { Note } from "@/lib/types";

type Props = {
  // When editing, the existing note. When creating from a node, initialCodes.
  note?: Note;
  initialCodes?: string[];
  onDone: () => void;
  onCancel?: () => void;
};

function toDateInputValue(d: Date): string {
  // yyyy-mm-dd in local time for <input type="date">
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function NoteForm({ note, initialCodes, onDone, onCancel }: Props) {
  const { orgId, user } = useAuth();
  const [person, setPerson] = useState(note?.person ?? "");
  const [company, setCompany] = useState(note?.company ?? "");
  const [position, setPosition] = useState(note?.position ?? "");
  const [date, setDate] = useState(
    note ? toDateInputValue(note.contactDate.toDate()) : toDateInputValue(new Date()),
  );
  const [body, setBody] = useState(note?.body ?? "");
  // Stored linkedCodes include ancestors; for editing we keep them all and let
  // the user prune. New notes start from initialCodes (e.g. the hovered node).
  const [codes, setCodes] = useState<string[]>(
    note?.linkedCodes ?? initialCodes ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAiSort() {
    if (!body.trim() && !company.trim()) {
      setError("Add some note text before AI sort.");
      return;
    }
    setAiBusy(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/ai-sort", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          noteText: [person, position, company, body].filter(Boolean).join("\n"),
        }),
      });
      if (!res.ok) throw new Error("AI sort failed");
      const data = (await res.json()) as { codes: string[] };
      setCodes((prev) => [...new Set([...prev, ...data.codes])]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI sort failed");
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !user) return;
    setBusy(true);
    setError(null);
    const input: NoteInput = {
      person,
      company,
      position,
      contactDate: new Date(date + "T00:00:00"),
      body,
      codes,
    };
    try {
      if (note) await updateNote(note.id, input);
      else await createNote(orgId, user.uid, input);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
      setBusy(false);
    }
  }

  const field =
    "rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-blue-500";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          className={field}
          placeholder="Person"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
        />
        <input
          className={field}
          placeholder="Company"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
        />
        <input
          className={field}
          placeholder="Position"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
        <input
          className={field}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <textarea
        className={field + " min-h-[120px] resize-y"}
        placeholder="Notes from the call…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-400">Industries</label>
        <button
          type="button"
          onClick={runAiSort}
          disabled={aiBusy}
          className="rounded-md border border-blue-700 bg-blue-900/30 px-2 py-1 text-xs text-blue-200 transition-colors hover:bg-blue-800/40 disabled:opacity-50"
        >
          {aiBusy ? "Sorting…" : "✦ AI sort"}
        </button>
      </div>
      <IndustryCascadeSelect value={codes} onChange={setCodes} />

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : note ? "Save changes" : "Add note"}
        </button>
      </div>
    </form>
  );
}
