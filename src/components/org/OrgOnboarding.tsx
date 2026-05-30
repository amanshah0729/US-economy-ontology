"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createOrg } from "@/lib/db";

// Shown when a user is authenticated but not yet in an org. They can create a
// new org, or follow an invite link from a teammate (handled by /invite/[token]).
export function OrgOnboarding() {
  const { user, signOutUser } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createOrg(user, name);
      // users/{uid}.orgId now set → AuthProvider snapshot flips the gate.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create org");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl">
        <h1 className="mb-1 text-lg font-semibold tracking-tight">
          Create your organization
        </h1>
        <p className="mb-5 text-xs text-zinc-400">
          Set up a workspace for your team. To join an existing one, ask a
          teammate for their invite link.
        </p>

        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <input
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-blue-500"
            placeholder="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create organization"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => signOutUser()}
          className="mt-4 w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
