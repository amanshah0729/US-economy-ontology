"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import { scaleSqrt } from "d3-scale";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import {
  socTree,
  shareOfEmployment,
  type SocNode,
  type OccSearchResult,
} from "@/lib/occupation";
import { wageToColor, GRAY } from "@/lib/color";
import { OccupationTooltip } from "./OccupationTooltip";
import { OccupationSearchBar } from "./OccupationSearchBar";

const NODE_HSPACING = 60;
const NODE_VSPACING = 130;
const MIN_R = 4;
const MAX_R = 26;
const GRAY_R = 4;

type Props = { className?: string };

function collapseToMajors(root: SocNode): Set<string> {
  return new Set([root.code]);
}

function expandAll(root: SocNode): Set<string> {
  const set = new Set<string>();
  const walk = (n: SocNode) => {
    if (n.children.length > 0) {
      set.add(n.code);
      for (const c of n.children) walk(c);
    }
  };
  walk(root);
  return set;
}

export function OccupationTree({ className }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => collapseToMajors(socTree));
  const [hover, setHover] = useState<{ node: SocNode; x: number; y: number } | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [highlightCode, setHighlightCode] = useState<string | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = useMemo(() => {
    const root = hierarchy<SocNode>(socTree, (d) =>
      expanded.has(d.code) ? d.children : null
    );
    const layoutFn = tree<SocNode>().nodeSize([NODE_HSPACING, NODE_VSPACING]);
    return layoutFn(root);
  }, [expanded]);

  const bounds = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    layout.each((d) => {
      if (d.x < xMin) xMin = d.x;
      if (d.x > xMax) xMax = d.x;
      if (d.y < yMin) yMin = d.y;
      if (d.y > yMax) yMax = d.y;
    });
    return { xMin, xMax, yMin, yMax, w: xMax - xMin, h: yMax - yMin };
  }, [layout]);

  // Radius scaled by share of US employment. Root capped at MAX_R.
  const radius = useMemo(() => {
    return scaleSqrt<number, number>().domain([0, 1]).range([MIN_R, MAX_R]).clamp(true);
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const zoomer = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => setTransform(event.transform));
    zoomRef.current = zoomer;
    select(svgEl).call(zoomer).on("dblclick.zoom", null);
    return () => {
      select(svgEl).on(".zoom", null);
      zoomRef.current = null;
    };
  }, []);

  const applyTransform = (t: ZoomTransform) => {
    if (!svgRef.current || !zoomRef.current) {
      setTransform(t);
      return;
    }
    select(svgRef.current).call(zoomRef.current.transform, t);
  };

  const didFit = useRef(false);
  useEffect(() => {
    if (didFit.current) return;
    if (size.w < 50 || size.h < 50) return;
    if (!Number.isFinite(bounds.w) || bounds.w <= 0) return;
    const padding = 60;
    const k = Math.min(
      (size.w - padding * 2) / Math.max(bounds.w, 1),
      (size.h - padding * 2) / Math.max(bounds.h, 1),
      1
    );
    const tx = size.w / 2 - ((bounds.xMin + bounds.xMax) / 2) * k;
    const ty = padding - bounds.yMin * k;
    applyTransform(zoomIdentity.translate(tx, ty).scale(k));
    didFit.current = true;
  }, [size, bounds]);

  const resetView = () => {
    const padding = 60;
    if (bounds.w <= 0 || size.w < 50) return;
    const k = Math.min(
      (size.w - padding * 2) / Math.max(bounds.w, 1),
      (size.h - padding * 2) / Math.max(bounds.h, 1),
      1
    );
    const tx = size.w / 2 - ((bounds.xMin + bounds.xMax) / 2) * k;
    const ty = padding - bounds.yMin * k;
    applyTransform(zoomIdentity.translate(tx, ty).scale(k));
  };

  const onSearchSelect = (r: OccSearchResult) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const code of r.ancestors) next.add(code);
      if (r.node.children.length > 0) next.add(r.node.code);
      return next;
    });
    setPendingFocus(r.node.code);
  };

  useEffect(() => {
    if (!pendingFocus) return;
    if (size.w < 50) return;
    const target = layout.descendants().find((d) => d.data.code === pendingFocus);
    if (!target) return;
    const k = Math.max(transform.k, 1.2);
    const tx = size.w / 2 - target.x * k;
    const ty = size.h / 2 - target.y * k;
    applyTransform(zoomIdentity.translate(tx, ty).scale(k));
    setHighlightCode(pendingFocus);
    setPendingFocus(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocus, layout, size]);

  useEffect(() => {
    if (!highlightCode) return;
    const t = setTimeout(() => setHighlightCode(null), 3000);
    return () => clearTimeout(t);
  }, [highlightCode]);

  const toggle = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const nodeRadius = (d: SocNode) => {
    if (d.code === "00-0000") return MAX_R;
    const share = shareOfEmployment(d.totEmp);
    if (share == null) return GRAY_R;
    return radius(share);
  };

  const nodeFill = (d: SocNode) => {
    if (d.code === "00-0000") return "#3b82f6";
    if (d.aMean == null) return GRAY;
    return wageToColor(d.aMean);
  };

  const links = layout.links();
  const nodes = layout.descendants();
  const totalNodes = useMemo(() => {
    let n = 0;
    const walk = (x: SocNode) => {
      n++;
      for (const c of x.children) walk(c);
    };
    walk(socTree);
    return n;
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <div className="absolute top-3 left-4 right-4 z-10 flex items-start justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-start gap-2">
          <OccupationSearchBar onSelect={onSearchSelect} />
          <button
            type="button"
            onClick={resetView}
            className="rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm border border-zinc-800 hover:bg-zinc-800"
          >
            Reset view
          </button>
          <button
            type="button"
            onClick={() => setExpanded(expandAll(socTree))}
            className="rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm border border-zinc-800 hover:bg-zinc-800"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setExpanded(collapseToMajors(socTree))}
            className="rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm border border-zinc-800 hover:bg-zinc-800"
          >
            Collapse to majors
          </button>
          <div className="rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-sm border border-zinc-800">
            {nodes.length} visible / {totalNodes} total · scroll to zoom · drag to pan
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-3 rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-sm border border-zinc-800">
          <span>Mean annual wage:</span>
          <div className="flex items-center gap-1">
            <span>$30k</span>
            <div
              className="h-3 w-24 rounded-sm"
              style={{
                background:
                  "linear-gradient(to right, #ffffd9, #c7e9b4, #41b6c4, #225ea8, #081d58)",
              }}
            />
            <span>$150k+</span>
          </div>
          <span className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: GRAY }} />
            no data
          </span>
        </div>
      </div>

      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className="block bg-zinc-950"
        onMouseLeave={() => setHover(null)}
      >
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          <g stroke="#3f3f46" strokeWidth={1} fill="none">
            {links.map((l, i) => (
              <line
                key={i}
                x1={l.source.x}
                y1={l.source.y}
                x2={l.target.x}
                y2={l.target.y}
              />
            ))}
          </g>
          <g>
            {nodes.map((d) => {
              const node = d.data;
              const isExpanded = expanded.has(node.code);
              const r = nodeRadius(node);
              const fill = nodeFill(node);
              const hasKids = node.children.length > 0;
              return (
                <g
                  key={node.code}
                  transform={`translate(${d.x},${d.y})`}
                  style={{ cursor: hasKids ? "pointer" : "default" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (hasKids) toggle(node.code);
                  }}
                  onMouseEnter={(e) =>
                    setHover({ node, x: e.clientX, y: e.clientY })
                  }
                  onMouseMove={(e) =>
                    setHover({ node, x: e.clientX, y: e.clientY })
                  }
                  onMouseLeave={() => setHover(null)}
                >
                  {highlightCode === node.code && (
                    <circle
                      r={r + 8}
                      fill="none"
                      stroke="#facc15"
                      strokeWidth={3}
                      opacity={0.9}
                    >
                      <animate
                        attributeName="r"
                        from={r + 4}
                        to={r + 14}
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                      <animate
                        attributeName="opacity"
                        from={0.9}
                        to={0}
                        dur="1.2s"
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}
                  <circle
                    r={r}
                    fill={fill}
                    stroke={
                      highlightCode === node.code
                        ? "#facc15"
                        : isExpanded
                        ? "#fafafa"
                        : "#18181b"
                    }
                    strokeWidth={highlightCode === node.code ? 2 : isExpanded ? 2 : 1}
                  />
                  <NodeLabel
                    text={displayLabel(node)}
                    yOffset={node.code === "00-0000" ? -(r + 6) : r + 10}
                    above={node.code === "00-0000"}
                    fontSize={node.code === "00-0000" ? 12 : 8}
                  />
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {hover && (
        <OccupationTooltip
          node={hover.node}
          x={hover.x}
          y={hover.y}
          expanded={expanded.has(hover.node.code)}
        />
      )}
    </div>
  );
}

function displayLabel(node: SocNode): string {
  if (node.code === "00-0000") return "All Occupations";
  return node.title;
}

function wrapLabel(text: string, maxCharsPerLine = 14, maxLines = 3): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const candidate = cur ? cur + " " + w : w;
    if (candidate.length <= maxCharsPerLine) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      if (w.length > maxCharsPerLine) {
        cur = w.slice(0, maxCharsPerLine - 1) + "…";
      } else {
        cur = w;
      }
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  if (lines.length === maxLines) {
    const joinedSoFar = lines.join(" ").split(/\s+/).length;
    if (joinedSoFar < words.length) {
      const last = lines[maxLines - 1];
      lines[maxLines - 1] =
        last.length <= maxCharsPerLine - 1 ? last + "…" : last.slice(0, maxCharsPerLine - 1) + "…";
    }
  }
  return lines;
}

function NodeLabel({
  text,
  yOffset,
  above,
  fontSize,
}: {
  text: string;
  yOffset: number;
  above: boolean;
  fontSize: number;
}) {
  const lines = wrapLabel(text);
  return (
    <text
      y={yOffset}
      textAnchor="middle"
      fontSize={fontSize}
      fill="#e4e4e7"
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {lines.map((line, i) => (
        <tspan
          key={i}
          x={0}
          dy={i === 0 ? (above ? -(lines.length - 1) * 1.1 + "em" : 0) : "1.1em"}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}
