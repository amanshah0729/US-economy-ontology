"use client";

import {
  formatBillions,
  formatPct,
  formatSigned,
  type NaicsNode,
} from "@/lib/industry";

type Props = {
  node: NaicsNode;
  x: number;
  y: number;
  expanded: boolean;
};

export function IndustryTooltip({ node, x, y, expanded }: Props) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-md border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-100 shadow-lg backdrop-blur-sm"
      style={{ left: x + 14, top: y + 14, maxWidth: 300 }}
    >
      <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
        NAICS {node.code === "ROOT" ? "—" : node.code}
      </div>
      <div className="font-semibold text-sm mb-1">{node.title}</div>
      {node.hasValue ? (
        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
          <span className="text-zinc-400">Value</span>
          <span>{formatBillions(node.valueLatest)}</span>
          <span className="text-zinc-400">% of GDP</span>
          <span>{formatPct(node.shareOfGdp, 2)}</span>
          <span className="text-zinc-400">YoY growth</span>
          <span>{formatSigned(node.growthYoY)}</span>
          <span className="text-zinc-400">2yr growth</span>
          <span>{formatSigned(node.growth2yr)}</span>
        </div>
      ) : (
        <div className="text-zinc-500 italic">No BEA data for this NAICS code</div>
      )}
      {node.children.length > 0 && (
        <div className="mt-1 text-zinc-500">
          {expanded ? "Click to collapse" : "Click to expand"} ({node.children.length} sub-industries)
        </div>
      )}
    </div>
  );
}
