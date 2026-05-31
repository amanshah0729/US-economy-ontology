"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  createInvite,
  kickMember,
  leaveOrg,
  subscribeOrg,
  subscribeOrgMembers,
} from "@/lib/db";
import type { OrgMember } from "@/lib/types";

// Header control: shows the org name, the full member roster (everyone in the
// organization), and lets any member mint a shareable invite link.
export function OrgMenu() {
  const { orgId, user } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    const unsubOrg = subscribeOrg(orgId, (org) => setOrgName(org?.name ?? ""));
    const unsubMembers = subscribeOrgMembers(orgId, setMembers);
    return () => {
      unsubOrg();
      unsubMembers();
    };
  }, [orgId]);

  async function generate() {
    if (!orgId || !user) return;
    setBusy(true);
    try {
      const token = await createInvite(orgId, orgName, user.uid);
      setLink(`${window.location.origin}/invite/${token}`);
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleLeave() {
    if (!orgId || !user) return;
    if (
      !confirm(
        `Leave ${orgName}? You'll lose access to its notes and tasks until you're invited back.`,
      )
    )
      return;
    setLeaving(true);
    try {
      // Clears users/{uid}.orgId → AuthGate flips back to onboarding.
      await leaveOrg(orgId, user.uid);
    } catch {
      setLeaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-zinc-900 hover:text-white"
      >
        <span className="max-w-[140px] truncate font-medium text-zinc-200">
          {orgName || "Team"}
        </span>
        <span className="rounded-full bg-zinc-800 px-1.5 text-[10px] text-zinc-300">
          {members.length}
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-72 rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-xl">
          {/* Members roster */}
          <div className="mb-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Members ({members.length})
            </p>
            <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto">
              {members.map((m) => (
                <li
                  key={m.uid}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-xs"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[10px] uppercase text-zinc-200">
                    {(m.displayName || m.email || "?").slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-zinc-100">
                      {m.displayName}
                      {m.uid === user?.uid && (
                        <span className="text-zinc-500"> (you)</span>
                      )}
                    </span>
                    <span className="block truncate text-[10px] text-zinc-500">
                      {m.email}
                    </span>
                  </span>
                  {m.uid !== user?.uid && (
                    <button
                      onClick={() => {
                        if (orgId && confirm(`Remove ${m.displayName} from ${orgName}?`))
                          kickMember(orgId, m.uid);
                      }}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 hover:bg-red-950/40 hover:text-red-400"
                      title="Remove from organization"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Invite link */}
          <div className="border-t border-zinc-800 pt-3">
            <p className="mb-2 text-xs text-zinc-400">
              Invite people to <b>{orgName}</b>.
            </p>
            {link ? (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={link}
                  className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px]"
                />
                <button
                  onClick={copy}
                  className="shrink-0 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            ) : (
              <button
                onClick={generate}
                disabled={busy}
                className="w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? "Generating…" : "Generate invite link"}
              </button>
            )}
          </div>

          {/* Leave organization */}
          <div className="mt-3 border-t border-zinc-800 pt-3">
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="w-full rounded-md border border-red-900/60 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40 disabled:opacity-50"
            >
              {leaving ? "Leaving…" : "Leave organization"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
