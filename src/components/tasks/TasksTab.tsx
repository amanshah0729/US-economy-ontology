"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  createTask,
  setTaskStatus,
  subscribeOrgMembers,
  subscribeOrgNotes,
  subscribeOrgTasks,
  type TaskInput,
} from "@/lib/db";
import type { Note, OrgMember, Task } from "@/lib/types";

export function TasksTab() {
  const { orgId, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    const unsubT = subscribeOrgTasks(orgId, setTasks);
    const unsubM = subscribeOrgMembers(orgId, setMembers);
    const unsubN = subscribeOrgNotes(orgId, setNotes);
    return () => {
      unsubT();
      unsubM();
      unsubN();
    };
  }, [orgId]);

  const nameByUid = useMemo(() => {
    const m = new Map<string, string>();
    for (const mem of members) m.set(mem.uid, mem.displayName);
    return m;
  }, [members]);

  const noteById = useMemo(() => {
    const m = new Map<string, Note>();
    for (const n of notes) m.set(n.id, n);
    return m;
  }, [notes]);

  const mine = tasks.filter(
    (t) => t.assigneeUid === user?.uid && t.status === "open",
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2">
        <span className="text-sm font-semibold">Tasks</span>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="ml-auto rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          + New task
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {showForm && (
          <TaskForm
            members={members}
            notes={notes}
            onDone={() => setShowForm(false)}
          />
        )}

        <Section title={`Assigned to me (${mine.length})`}>
          {mine.length === 0 ? (
            <Empty>No open tasks assigned to you.</Empty>
          ) : (
            mine.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                nameByUid={nameByUid}
                noteById={noteById}
              />
            ))
          )}
        </Section>

        <Section title={`All organization tasks (${tasks.length})`}>
          {tasks.length === 0 ? (
            <Empty>No tasks yet.</Empty>
          ) : (
            tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                nameByUid={nameByUid}
                noteById={noteById}
              />
            ))
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-500">{children}</p>;
}

function TaskRow({
  task,
  nameByUid,
  noteById,
}: {
  task: Task;
  nameByUid: Map<string, string>;
  noteById: Map<string, Note>;
}) {
  const done = task.status === "done";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={done}
          onChange={() => setTaskStatus(task.id, done ? "open" : "done")}
          className="mt-1 h-4 w-4 cursor-pointer accent-blue-600"
        />
        <div className="min-w-0 flex-1">
          <div
            className={
              "text-sm font-medium " +
              (done ? "text-zinc-500 line-through" : "text-zinc-100")
            }
          >
            {task.title}
          </div>
          {task.description && (
            <p className="mt-0.5 whitespace-pre-line text-xs text-zinc-400">
              {task.description}
            </p>
          )}
          <div className="mt-1 text-[11px] text-zinc-500">
            Assigned to {nameByUid.get(task.assigneeUid) ?? "—"} · by{" "}
            {nameByUid.get(task.assignerUid) ?? "—"}
          </div>

          {task.linkedNoteIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {task.linkedNoteIds.map((id) => {
                const n = noteById.get(id);
                return (
                  <span
                    key={id}
                    className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-300"
                    title={n?.body}
                  >
                    📎 {n ? `${n.person || n.company || "Note"}` : "Note"}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskForm({
  members,
  notes,
  onDone,
}: {
  members: OrgMember[];
  notes: Note[];
  onDone: () => void;
}) {
  const { orgId, user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeUid, setAssigneeUid] = useState(user?.uid ?? "");
  const [linkedNoteIds, setLinkedNoteIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const field =
    "rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-blue-500";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !user || !title.trim() || !assigneeUid) return;
    setBusy(true);
    setError(null);
    const input: TaskInput = { title, description, assigneeUid, linkedNoteIds };
    try {
      await createTask(orgId, user.uid, input);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mb-6 flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-4"
    >
      <input
        className={field}
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />
      <textarea
        className={field + " min-h-[70px] resize-y"}
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label className="text-xs text-zinc-400">Assign to</label>
      <select
        className={field}
        value={assigneeUid}
        onChange={(e) => setAssigneeUid(e.target.value)}
      >
        {members.map((m) => (
          <option key={m.uid} value={m.uid}>
            {m.displayName}
            {m.uid === user?.uid ? " (me)" : ""}
          </option>
        ))}
      </select>

      <label className="text-xs text-zinc-400">Link notes (optional)</label>
      <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-700 bg-zinc-950">
        {notes.length === 0 ? (
          <p className="px-3 py-2 text-xs text-zinc-500">No notes to link.</p>
        ) : (
          notes.map((n) => {
            const checked = linkedNoteIds.includes(n.id);
            return (
              <label
                key={n.id}
                className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-zinc-900"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setLinkedNoteIds((prev) =>
                      checked
                        ? prev.filter((id) => id !== n.id)
                        : [...prev, n.id],
                    )
                  }
                  className="h-3.5 w-3.5 accent-blue-600"
                />
                <span className="truncate">
                  {n.person || n.company || "Note"}
                  {n.company && n.person ? ` · ${n.company}` : ""}
                </span>
              </label>
            );
          })
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md px-3 py-2 text-sm text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create task"}
        </button>
      </div>
    </form>
  );
}
