"use client";

import { useState } from "react";
import { IndustryTree } from "@/components/IndustryTree";
import { OccupationTree } from "@/components/OccupationTree";
import { NotesTab } from "@/components/notes/NotesTab";
import { TasksTab } from "@/components/tasks/TasksTab";
import { AuthGate } from "@/components/auth/AuthGate";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMyTaskCount } from "@/components/tasks/useMyTaskCount";
import { InviteButton } from "@/components/org/InviteButton";

type Tab = "industry" | "occupation" | "notes" | "tasks";

export default function Home() {
  return (
    <AuthGate>
      <AtlasApp />
    </AuthGate>
  );
}

function AtlasApp() {
  const [tab, setTab] = useState<Tab>("industry");
  const { userDoc, signOutUser } = useAuth();
  const taskCount = useMyTaskCount();

  return (
    <main className="flex h-screen w-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="flex items-center gap-1 border-b border-zinc-800 px-4 py-2">
        <h1 className="mr-4 text-base font-semibold tracking-tight">
          Economy Atlas
        </h1>
        <TabButton active={tab === "industry"} onClick={() => setTab("industry")}>
          Industry
        </TabButton>
        <TabButton active={tab === "occupation"} onClick={() => setTab("occupation")}>
          Occupation
        </TabButton>
        <TabButton active={tab === "notes"} onClick={() => setTab("notes")}>
          Notes
        </TabButton>
        <TabButton
          active={tab === "tasks"}
          onClick={() => setTab("tasks")}
          badge={taskCount}
        >
          Tasks
        </TabButton>

        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-400">
          <span className="hidden sm:inline">{userDoc?.displayName}</span>
          <InviteButton />
          <button
            type="button"
            onClick={() => signOutUser()}
            className="rounded-md px-2 py-1 transition-colors hover:bg-zinc-900 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {tab === "industry" && <IndustryTree className="relative h-full w-full" />}
        {tab === "occupation" && (
          <OccupationTree className="relative h-full w-full" />
        )}
        {tab === "notes" && <NotesTab />}
        {tab === "tasks" && <TasksTab />}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "relative rounded-md px-3 py-1 text-sm transition-colors " +
        (active
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:text-white hover:bg-zinc-900")
      }
    >
      {children}
      {badge != null && badge > 0 && (
        <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-medium text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
