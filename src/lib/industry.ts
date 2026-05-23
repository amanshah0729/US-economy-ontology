import treeJson from "@/data/naics-tree.json";

export type NaicsNode = {
  code: string;
  title: string;
  description: string;
  depth: number;
  hasValue: boolean;
  valueLatest: number | null;
  shareOfGdp: number | null;
  growthYoY: number | null;
  growth2yr: number | null;
  aiGenerated: boolean;
  children: NaicsNode[];
};

export const naicsTree = treeJson as NaicsNode;

// Flat index of every node, plus a parent-chain map for fast ancestor lookup.
type FlatEntry = { node: NaicsNode; ancestors: string[] };
function buildFlat(): { all: FlatEntry[]; byCode: Map<string, FlatEntry> } {
  const all: FlatEntry[] = [];
  const byCode = new Map<string, FlatEntry>();
  const walk = (n: NaicsNode, ancestors: string[]) => {
    const entry: FlatEntry = { node: n, ancestors };
    all.push(entry);
    byCode.set(n.code, entry);
    const nextAncestors = [...ancestors, n.code];
    for (const c of n.children) walk(c, nextAncestors);
  };
  walk(naicsTree, []);
  return { all, byCode };
}

const flat = buildFlat();
export const allNodes = flat.all;
export const nodeByCode = flat.byCode;

export type SearchResult = {
  node: NaicsNode;
  ancestors: string[];
  score: number;
  matchedIn: "title" | "code" | "description";
};

export function searchNaics(query: string, limit = 15): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: SearchResult[] = [];

  for (const entry of allNodes) {
    const { node } = entry;
    const title = node.title.toLowerCase();
    const code = node.code.toLowerCase();
    const desc = node.description.toLowerCase();

    let score = 0;
    let matchedIn: SearchResult["matchedIn"] = "description";

    if (code === q) {
      score = 1000;
      matchedIn = "code";
    } else if (code.startsWith(q)) {
      score = 800;
      matchedIn = "code";
    } else if (title === q) {
      score = 700;
      matchedIn = "title";
    } else if (title.startsWith(q)) {
      score = 500 - node.depth * 5;
      matchedIn = "title";
    } else if (title.includes(q)) {
      score = 300 - node.depth * 5;
      matchedIn = "title";
    } else if (desc.includes(q)) {
      // Prefer earlier mentions and shallower (broader) nodes
      const idx = desc.indexOf(q);
      score = Math.max(50 - Math.floor(idx / 50), 5) - node.depth * 3;
      matchedIn = "description";
    } else {
      continue;
    }

    results.push({ node, ancestors: entry.ancestors, score, matchedIn });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export function formatBillions(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1000) return `$${(v / 1000).toFixed(2)}T`;
  return `$${v.toFixed(1)}B`;
}

export function formatPct(v: number | null | undefined, digits = 1): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export function formatSigned(v: number | null | undefined, digits = 2): string {
  if (v == null) return "—";
  const s = (v * 100).toFixed(digits);
  return `${v >= 0 ? "+" : ""}${s}%`;
}
