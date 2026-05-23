import treeJson from "@/data/soc-tree.json";

export type SocGroup = "total" | "major" | "minor" | "broad" | "detailed";

export type SocNode = {
  code: string;
  title: string;
  group: SocGroup;
  totEmp: number | null;
  aMean: number | null;
  aMedian: number | null;
  aPct10: number | null;
  aPct25: number | null;
  aPct75: number | null;
  aPct90: number | null;
  hMean: number | null;
  children: SocNode[];
};

export const socTree = treeJson as SocNode;

type FlatEntry = { node: SocNode; ancestors: string[] };
function buildFlat(): { all: FlatEntry[]; byCode: Map<string, FlatEntry> } {
  const all: FlatEntry[] = [];
  const byCode = new Map<string, FlatEntry>();
  const walk = (n: SocNode, ancestors: string[]) => {
    const entry: FlatEntry = { node: n, ancestors };
    all.push(entry);
    byCode.set(n.code, entry);
    const next = [...ancestors, n.code];
    for (const c of n.children) walk(c, next);
  };
  walk(socTree, []);
  return { all, byCode };
}

const flat = buildFlat();
export const allOccupations = flat.all;
export const occupationByCode = flat.byCode;

export type OccSearchResult = {
  node: SocNode;
  ancestors: string[];
  score: number;
  matchedIn: "title" | "code";
};

export function searchSoc(query: string, limit = 15): OccSearchResult[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results: OccSearchResult[] = [];
  const depthOfGroup: Record<SocGroup, number> = {
    total: 0,
    major: 1,
    minor: 2,
    broad: 3,
    detailed: 4,
  };

  for (const entry of allOccupations) {
    const { node } = entry;
    const title = node.title.toLowerCase();
    const code = node.code.toLowerCase();
    const depth = depthOfGroup[node.group];

    let score = 0;
    let matchedIn: OccSearchResult["matchedIn"] = "title";

    if (code === q) {
      score = 1000;
      matchedIn = "code";
    } else if (code.startsWith(q)) {
      score = 800;
      matchedIn = "code";
    } else if (title === q) {
      score = 700;
    } else if (title.startsWith(q)) {
      score = 500 - depth * 5;
    } else if (title.includes(q)) {
      score = 300 - depth * 5;
    } else {
      continue;
    }

    results.push({ node, ancestors: entry.ancestors, score, matchedIn });
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export const TOTAL_EMPLOYMENT = socTree.totEmp ?? 1;

export function shareOfEmployment(emp: number | null | undefined): number | null {
  if (emp == null || TOTAL_EMPLOYMENT <= 0) return null;
  return emp / TOTAL_EMPLOYMENT;
}

export function formatEmployment(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return `${v}`;
}

export function formatWage(v: number | null | undefined): string {
  if (v == null) return "—";
  return `$${Math.round(v).toLocaleString()}`;
}
