"use client";

import { useMemo, useState } from "react";
import { naicsTree, nodeByCode, searchNaics, type NaicsNode } from "@/lib/industry";

type Props = {
  value: string[];
  onChange: (codes: string[]) => void;
};

// Cascading NAICS picker: starts at the ~20 sectors, drill into children level
// by level via a breadcrumb. Each node can be added to the multi-select.
// Also supports free-text search across the whole tree.
export function IndustryCascadeSelect({ value, onChange }: Props) {
  // Path of codes from root to the currently-browsed node (excludes ROOT).
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const currentNode: NaicsNode = useMemo(() => {
    let node = naicsTree;
    for (const code of path) {
      const child = node.children.find((c) => c.code === code);
      if (!child) break;
      node = child;
    }
    return node;
  }, [path]);

  const searchResults = useMemo(
    () => (search.trim().length >= 2 ? searchNaics(search, 20) : []),
    [search],
  );

  function add(code: string) {
    if (!value.includes(code)) onChange([...value, code]);
  }
  function remove(code: string) {
    onChange(value.filter((c) => c !== code));
  }

  const selectedSet = new Set(value);

  return (
    <div className="rounded-md border border-zinc-700 bg-zinc-950">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-zinc-800 p-2">
          {value.map((code) => {
            const node = nodeByCode.get(code)?.node;
            return (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded bg-blue-900/40 px-2 py-0.5 text-[11px] text-blue-200"
              >
                {node ? node.title : code}
                <button
                  type="button"
                  onClick={() => remove(code)}
                  className="text-blue-300 hover:text-white"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Search */}
      <div className="border-b border-zinc-800 p-2">
        <input
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs outline-none focus:border-blue-500"
          placeholder="Search industries…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Search results OR breadcrumb + level list */}
      {search.trim().length >= 2 ? (
        <ul className="max-h-56 overflow-y-auto py-1">
          {searchResults.length === 0 && (
            <li className="px-3 py-2 text-xs text-zinc-500">No matches.</li>
          )}
          {searchResults.map(({ node, ancestors }) => (
            <li
              key={node.code}
              className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-zinc-900"
            >
              <span className="min-w-0">
                <span className="block truncate">{node.title}</span>
                <span className="block truncate text-[10px] text-zinc-500">
                  {ancestors
                    .filter((a) => a !== "ROOT")
                    .map((a) => nodeByCode.get(a)?.node.title)
                    .filter(Boolean)
                    .join(" › ")}
                </span>
              </span>
              <button
                type="button"
                disabled={selectedSet.has(node.code)}
                onClick={() => add(node.code)}
                className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-200 hover:bg-blue-700 disabled:opacity-40"
              >
                {selectedSet.has(node.code) ? "✓" : "+"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <>
          {/* Breadcrumb */}
          <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 text-[11px] text-zinc-400">
            <button
              type="button"
              onClick={() => setPath([])}
              className="hover:text-white"
            >
              All sectors
            </button>
            {path.map((code, i) => (
              <span key={code} className="flex items-center gap-1">
                <span className="text-zinc-600">›</span>
                <button
                  type="button"
                  onClick={() => setPath(path.slice(0, i + 1))}
                  className="max-w-[140px] truncate hover:text-white"
                >
                  {nodeByCode.get(code)?.node.title ?? code}
                </button>
              </span>
            ))}
          </div>

          <ul className="max-h-56 overflow-y-auto py-1">
            {currentNode.children.map((child) => (
              <li
                key={child.code}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-zinc-900"
              >
                <button
                  type="button"
                  onClick={() =>
                    child.children.length > 0 && setPath([...path, child.code])
                  }
                  className={
                    "min-w-0 flex-1 text-left " +
                    (child.children.length > 0
                      ? "cursor-pointer"
                      : "cursor-default")
                  }
                >
                  <span className="block truncate">{child.title}</span>
                  {child.children.length > 0 && (
                    <span className="text-[10px] text-zinc-500">
                      {child.children.length} sub-industries ›
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={selectedSet.has(child.code)}
                  onClick={() => add(child.code)}
                  className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] text-zinc-200 hover:bg-blue-700 disabled:opacity-40"
                >
                  {selectedSet.has(child.code) ? "✓" : "+"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
