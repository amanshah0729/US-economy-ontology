"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { auth } from "@/lib/firebase";
import { getInvite, joinOrgViaInvite } from "@/lib/db";
import type { Invite } from "@/lib/types";

export default function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the invite (rules allow any signed-in user to read it). If the visitor
  // isn't signed in, bounce them to signup carrying the invite token along.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/signup?invite=${token}`);
      return;
    }
    getInvite(token)
      .then((inv) => {
        if (!inv || !inv.active) setState("invalid");
        else {
          setInvite(inv);
          setState("ready");
        }
      })
      .catch(() => setState("invalid"));
  }, [loading, user, token, router]);

  async function handleJoin() {
    const u = auth.currentUser;
    if (!u) return;
    setBusy(true);
    setError(null);
    try {
      await joinOrgViaInvite(token, u);
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 text-center shadow-xl">
        {state === "loading" && (
          <p className="text-sm text-zinc-400">Loading invite…</p>
        )}
        {state === "invalid" && (
          <p className="text-sm text-red-400">
            This invite link is invalid or has expired.
          </p>
        )}
        {state === "ready" && invite && (
          <>
            <h1 className="mb-1 text-lg font-semibold tracking-tight">
              Join {invite.orgName}
            </h1>
            <p className="mb-5 text-xs text-zinc-400">
              You&apos;ve been invited to collaborate in Economy Atlas.
            </p>
            {error && <p className="mb-3 text-xs text-red-400">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={busy}
              className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Joining…" : `Join ${invite.orgName}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
