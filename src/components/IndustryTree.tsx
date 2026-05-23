"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { hierarchy, tree } from "d3-hierarchy";
import { scaleSqrt } from "d3-scale";
import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from "d3-zoom";
import { naicsTree, type NaicsNode, type SearchResult } from "@/lib/industry";
import { growthToColor, GRAY } from "@/lib/color";
import { IndustryTooltip } from "./IndustryTooltip";
import { SearchBar } from "./SearchBar";

const NODE_HSPACING = 60;     // px between leaves horizontally
const NODE_VSPACING = 130;    // px between depth levels vertically
const MIN_R = 4;
const MAX_R = 26;
const GRAY_R = 4;

type Props = { className?: string };

function expandAll(root: NaicsNode): Set<string> {
  const set = new Set<string>();
  const walk = (n: NaicsNode) => {
    if (n.children.length > 0) {
      set.add(n.code);
      for (const c of n.children) walk(c);
    }
  };
  walk(root);
  return set;
}

function collapseToSectors(root: NaicsNode): Set<string> {
  // Only root expanded → visible: root + 20 sectors
  return new Set([root.code]);
}

export function IndustryTree({ className }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => collapseToSectors(naicsTree));
  const [hover, setHover] = useState<{ node: NaicsNode; x: number; y: number } | null>(null);
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

  // Build the visible hierarchy from the expanded set.
  const layout = useMemo(() => {
    const root = hierarchy<NaicsNode>(naicsTree, (d) =>
      expanded.has(d.code) ? d.children : null
    );

    // Use nodeSize so the tree extends naturally; we'll wrap in zoomable group.
    const layoutFn = tree<NaicsNode>().nodeSize([NODE_HSPACING, NODE_VSPACING]);
    return layoutFn(root);
  }, [expanded]);

  // Compute bounds for centering / initial fit.
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

  // d3-scale for radius by share of GDP. Root is ~1.0 → MAX_R.
  const radius = useMemo(() => {
    return scaleSqrt<number, number>().domain([0, 1]).range([MIN_R, MAX_R]).clamp(true);
  }, []);

  // Wire d3-zoom to the svg.
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

  // Auto-fit on first layout (when size known and tree non-trivial).
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
    didFit.current = false;
    // trigger fit by toggling expanded ref no-op — easier: just recompute
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

  // Focus a node from search: expand ancestors, then pan/zoom to it after layout recomputes.
  const onSearchSelect = (r: SearchResult) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      // Expand every ancestor so the node is visible
      for (const code of r.ancestors) next.add(code);
      // Also expand the node itself if it has children, so the user sees adjacency
      if (r.node.children.length > 0) next.add(r.node.code);
      return next;
    });
    setPendingFocus(r.node.code);
  };

  // When layout updates and we have a pending focus, center on it.
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

  // Clear highlight after a few seconds.
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

  const nodeRadius = (d: NaicsNode) => {
    if (!d.hasValue) return GRAY_R;
    if (d.code === "ROOT") return MAX_R;
    return radius(d.shareOfGdp ?? 0);
  };

  const nodeFill = (d: NaicsNode) => {
    if (d.code === "ROOT") return "#3b82f6"; // blue-500 for root
    if (!d.hasValue) return GRAY;
    return growthToColor(d.growthYoY);
  };

  const links = layout.links();
  const nodes = layout.descendants();

  return (
    <div ref={containerRef} className={className}>
      {/* HUD */}
      <div className="absolute top-3 left-4 right-4 z-10 flex items-start justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex flex-wrap items-start gap-2">
          <SearchBar onSelect={onSearchSelect} />
          <button
            type="button"
            onClick={resetView}
            className="rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm border border-zinc-800 hover:bg-zinc-800"
          >
            Reset view
          </button>
          <button
            type="button"
            onClick={() => setExpanded(expandAll(naicsTree))}
            className="rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm border border-zinc-800 hover:bg-zinc-800"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={() => setExpanded(collapseToSectors(naicsTree))}
            className="rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur-sm border border-zinc-800 hover:bg-zinc-800"
          >
            Collapse to sectors
          </button>
          <div className="rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-400 backdrop-blur-sm border border-zinc-800">
            {nodes.length} visible / 2,126 total · scroll to zoom · drag to pan
          </div>
        </div>
        <div className="pointer-events-auto flex items-center gap-3 rounded-md bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur-sm border border-zinc-800">
          <span>Real YoY growth:</span>
          <div className="flex items-center gap-1">
            <span>-5%</span>
            <div
              className="h-3 w-24 rounded-sm"
              style={{
                background:
                  "linear-gradient(to right, #a50026, #f7f7c5, #006837)",
              }}
            />
            <span>+5%</span>
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
          {/* Edges */}
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

          {/* Nodes */}
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
                    strokeDasharray={node.aiGenerated ? "2 2" : undefined}
                  />
                  <NodeLabel
                    text={displayLabel(node)}
                    yOffset={node.code === "ROOT" ? -(r + 6) : r + 10}
                    above={node.code === "ROOT"}
                    fontSize={node.code === "ROOT" ? 12 : 8}
                  />
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {hover && (
        <IndustryTooltip
          node={hover.node}
          x={hover.x}
          y={hover.y}
          expanded={expanded.has(hover.node.code)}
        />
      )}
    </div>
  );
}

function displayLabel(node: NaicsNode): string {
  if (node.code === "ROOT") return "U.S. Economy";
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
      // Hard-truncate a single long word
      if (w.length > maxCharsPerLine) {
        cur = w.slice(0, maxCharsPerLine - 1) + "…";
      } else {
        cur = w;
      }
      if (lines.length >= maxLines) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);

  // If words remain, append ellipsis to last line.
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

