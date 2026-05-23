"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchNaics, type SearchResult } from "@/lib/industry";

type Props = {
  onSelect: (result: SearchResult) => void;
};

export function SearchBar({ onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchNaics(query), [query]);

  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const choose = (r: SearchResult) => {
    onSelect(r);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
      setOpen(true);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (results[highlight]) {
        e.preventDefault();
        choose(results[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="pointer-events-auto relative w-80">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => query && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search industries (e.g. landscaping, software, dentist)…"
        className="w-full rounded-md border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 backdrop-blur-sm outline-none focus:border-zinc-600"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 max-h-96 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900/95 shadow-lg backdrop-blur-sm">
          {results.map((r, i) => (
            <button
              key={r.node.code}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => choose(r)}
              className={
                "flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs " +
                (i === highlight
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-200 hover:bg-zinc-800/60")
              }
            >
              <span className="font-mono text-zinc-500 shrink-0 w-14">
                {r.node.code === "ROOT" ? "—" : r.node.code}
              </span>
              <span className="flex-1 min-w-0">
                <div className="truncate">{r.node.title}</div>
                {r.matchedIn === "description" && (
                  <div className="text-[10px] text-zinc-500">matched in description</div>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-md border border-zinc-800 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-500 backdrop-blur-sm">
          No matches.
        </div>
      )}
    </div>
  );
}
