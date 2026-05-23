"use client";

import {
  formatEmployment,
  formatWage,
  shareOfEmployment,
  type SocNode,
} from "@/lib/occupation";

type Props = {
  node: SocNode;
  x: number;
  y: number;
  expanded: boolean;
};

const GROUP_LABEL: Record<SocNode["group"], string> = {
  total: "All occupations",
  major: "Major group",
  minor: "Minor group",
  broad: "Broad occupation",
  detailed: "Detailed occupation",
};

export function OccupationTooltip({ node, x, y, expanded }: Props) {
  const share = shareOfEmployment(node.totEmp);
  const hasWageBand =
    node.aPct10 != null && node.aPct90 != null;

  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-100 shadow-lg backdrop-blur-sm"
      style={{ left: x + 14, top: y + 14, maxWidth: 420 }}
    >
      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
        <span>SOC {node.code}</span>
        <span className="rounded bg-zinc-800 text-zinc-300 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal">
          {GROUP_LABEL[node.group]}
        </span>
      </div>
      <div className="font-semibold text-sm mb-1">{node.title}</div>

      {node.totEmp != null ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <span className="text-zinc-400">Employment</span>
          <span>{formatEmployment(node.totEmp)}</span>
          <span className="text-zinc-400">% of US jobs</span>
          <span>{share != null ? `${(share * 100).toFixed(2)}%` : "—"}</span>
          <span className="text-zinc-400">Mean wage</span>
          <span>{formatWage(node.aMean)}/yr</span>
          <span className="text-zinc-400">Median wage</span>
          <span>{formatWage(node.aMedian)}/yr</span>
          {hasWageBand && (
            <>
              <span className="text-zinc-400">10th – 90th</span>
              <span>
                {formatWage(node.aPct10)} – {formatWage(node.aPct90)}
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="text-zinc-500 italic">No OEWS data for this occupation</div>
      )}

      {node.children.length > 0 && (
        <div className="mt-1 text-zinc-500">
          {expanded ? "Click to collapse" : "Click to expand"} ({node.children.length} sub-occupations)
        </div>
      )}
    </div>
  );
}
