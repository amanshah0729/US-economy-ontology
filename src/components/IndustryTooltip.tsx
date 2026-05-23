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
      style={{ left: x + 14, top: y + 14, maxWidth: 440 }}
    >
      <div className="flex items-center gap-2 text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
        <span>NAICS {node.code === "ROOT" ? "—" : node.code}</span>
        {node.aiGenerated && (
          <span className="rounded bg-amber-900/40 text-amber-300 px-1.5 py-0.5 text-[9px] font-medium normal-case tracking-normal">
            AI-estimated
          </span>
        )}
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
      {node.aiGenerated && (
        <div className="mt-1 text-[10px] text-amber-400/80">
          Values estimated by Claude with web search — not BEA-official.
        </div>
      )}
      {node.description && (
        <p className="mt-2 text-[11px] leading-snug text-zinc-400 whitespace-pre-line">
          {node.description}
        </p>
      )}
      {node.children.length > 0 && (
        <div className="mt-1 text-zinc-500">
          {expanded ? "Click to collapse" : "Click to expand"} ({node.children.length} sub-industries)
        </div>
      )}
    </div>
  );
}

