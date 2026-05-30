"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createInvite, subscribeOrg } from "@/lib/db";

// Header control: any member can mint a shareable invite link for the org.
export function InviteButton() {
  const { orgId, user } = useAuth();
  const [orgName, setOrgName] = useState("");
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    return subscribeOrg(orgId, (org) => setOrgName(org?.name ?? ""));
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

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md px-2 py-1 transition-colors hover:bg-zinc-900 hover:text-white"
      >
        Invite
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-72 rounded-lg border border-zinc-800 bg-zinc-900 p-3 shadow-xl">
          <p className="mb-2 text-xs text-zinc-400">
            Share this link to invite people to <b>{orgName}</b>.
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
      )}
    </div>
  );
}
