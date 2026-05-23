"use client";

import { useState } from "react";
import { IndustryTree } from "@/components/IndustryTree";

type Tab = "industry" | "occupation";

export default function Home() {
  const [tab, setTab] = useState<Tab>("industry");

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
      </header>

      <div className="relative flex-1 overflow-hidden">
        {tab === "industry" ? (
          <IndustryTree className="relative h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-500">
            Occupation map coming soon
          </div>
        )}
      </div>
    </main>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-md px-3 py-1 text-sm transition-colors " +
        (active
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:text-white hover:bg-zinc-900")
      }
    >
      {children}
    </button>
  );
}
