import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Papa from "papaparse";
import * as XLSX from "xlsx";

const DATA_DIR = join(process.cwd(), "data");
const OUT_PATH = join(process.cwd(), "src/data/naics-tree.json");

const NAICS_XLSX = "2022_NAICS_Structure.xlsx";
const NAICS_DESC_XLSX = "2022_NAICS_Descriptions_use.xlsx";
const NOMINAL_CSV = "valueByIndustry.csv";
const REAL_CSV = "realValueAdded.csv";

const QUARTERS = 12;
const LATEST = QUARTERS - 1;
const ONE_YEAR_AGO = LATEST - 4;
const TWO_YEARS_AGO = LATEST - 8;
const CSV_HEADER_ROWS = 5;

type NaicsNode = {
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

// ----------------- NAICS xlsx ----------------------------

type NaicsRow = { code: string; title: string };

function parseNaics(): NaicsRow[] {
  const wb = XLSX.readFile(join(DATA_DIR, NAICS_XLSX));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown as string[][];

  const out: NaicsRow[] = [];
  for (const r of rows) {
    if (!r || r.length < 3) continue;
    const code = String(r[1] ?? "").trim();
    const title = String(r[2] ?? "").trim().replace(/T+$/, "").replace(/\*+$/, "").trim();
    if (!/^(\d{2,6}|\d{2}-\d{2})$/.test(code)) continue;
    out.push({ code, title });
  }
  return out;
}

function parseDescriptions(): Map<string, string> {
  const wb = XLSX.readFile(join(DATA_DIR, NAICS_DESC_XLSX));
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown as string[][];

  const raw = new Map<string, string>();
  for (const r of rows) {
    if (!r || r.length < 3) continue;
    const code = String(r[0] ?? "").trim();
    const desc = String(r[2] ?? "").trim();
    if (!/^(\d{2,6}|\d{2}-\d{2})$/.test(code) || !desc) continue;
    raw.set(code, desc);
  }

  // Resolve "See industry description for XXXXXX." pointers.
  // If the target isn't in the file, drop the pointer (inheritance from ancestors will fill it).
  const out = new Map<string, string>();
  for (const [code, desc] of raw) {
    const m = desc.match(/See industry description for (\d{2,6})\./i);
    if (m) {
      if (raw.has(m[1])) out.set(code, raw.get(m[1])!);
      // else: skip — leave unset
    } else {
      out.set(code, desc);
    }
  }
  return out;
}

function naicsDepth(code: string): number {
  // depth 0 = root, 1 = sectors (2-digit or range), 2 = 3-digit, 3 = 4-digit, 4 = 5-digit, 5 = 6-digit
  if (code.includes("-")) return 1;
  return code.length - 1; // 2→1, 3→2, 4→3, 5→4, 6→5
}

function findParentCode(code: string, byCode: Map<string, NaicsRow>): string | null {
  if (code.includes("-")) return null; // top-level
  for (let len = code.length - 1; len >= 2; len--) {
    const prefix = code.slice(0, len);
    if (byCode.has(prefix)) return prefix;
    // Check ranged parents (only at sector level: e.g. "31-33" covers 31, 32, 33)
    if (len === 2) {
      for (const k of byCode.keys()) {
        if (k.includes("-")) {
          const [lo, hi] = k.split("-").map(Number);
          const n = Number(prefix);
          if (n >= lo && n <= hi) return k;
        }
      }
    }
  }
  return null;
}

function buildNaicsTree(): { root: NaicsNode; allNodes: Map<string, NaicsNode> } {
  const rows = parseNaics();
  const descByCode = parseDescriptions();
  const byCode = new Map<string, NaicsRow>(rows.map((r) => [r.code, r]));

  const root: NaicsNode = {
    code: "ROOT",
    title: "United States Economy",
    description:
      "The full U.S. economy as classified by NAICS 2022. Children at each level subdivide industries into more specific categories, from 2-digit sectors down to 6-digit national industries.",
    depth: 0,
    hasValue: false,
    valueLatest: null,
    shareOfGdp: null,
    growthYoY: null,
    growth2yr: null,
    aiGenerated: false,
    children: [],
  };
  const nodes = new Map<string, NaicsNode>();
  nodes.set("ROOT", root);

  // First pass: create all nodes.
  for (const r of rows) {
    nodes.set(r.code, {
      code: r.code,
      title: r.title,
      description: descByCode.get(r.code) ?? "",
      depth: naicsDepth(r.code),
      hasValue: false,
      valueLatest: null,
      shareOfGdp: null,
      growthYoY: null,
      growth2yr: null,
      aiGenerated: false,
      children: [],
    });
  }

  // Second pass: link parents.
  for (const r of rows) {
    const node = nodes.get(r.code)!;
    const parentCode = findParentCode(r.code, byCode);
    const parent = parentCode ? nodes.get(parentCode)! : root;
    parent.children.push(node);
  }

  // Inherit description from nearest ancestor if a node has none.
  const inherit = (node: NaicsNode, ancestorDesc: string) => {
    const myDesc = node.description || ancestorDesc;
    if (!node.description && ancestorDesc) node.description = ancestorDesc;
    for (const c of node.children) inherit(c, myDesc);
  };
  inherit(root, root.description);

  return { root, allNodes: nodes };
}

// ----------------- BEA CSV ----------------------------

type BeaEntry = {
  rawName: string;
  valueLatest: number | null;
  realLatest: number | null;
  real1Y: number | null;
  real2Y: number | null;
};

function parseBeaCsv(file: string): { line: string; rawName: string; values: (number | null)[] }[] {
  const text = readFileSync(join(DATA_DIR, file), "utf8");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const out: { line: string; rawName: string; values: (number | null)[] }[] = [];
  for (let i = CSV_HEADER_ROWS; i < parsed.data.length; i++) {
    const r = parsed.data[i];
    if (!r || r.length < 2) continue;
    const line = (r[0] ?? "").trim();
    if (!/^\d+$/.test(line)) break;
    const rawName = (r[1] ?? "").trim();
    const values = r.slice(2, 2 + QUARTERS).map((v) => {
      const t = (v ?? "").trim();
      if (!t || t === "---" || t === "(D)" || t === "(NA)") return null;
      const n = Number(t.replace(/,/g, ""));
      return Number.isFinite(n) ? n : null;
    });
    out.push({ line, rawName, values });
  }
  return out;
}

function loadBea(): { entries: BeaEntry[]; gdp: number } {
  const nominal = parseBeaCsv(NOMINAL_CSV);
  const real = parseBeaCsv(REAL_CSV);
  const realByLine = new Map(real.map((r) => [r.line, r]));

  const entries: BeaEntry[] = [];
  let gdp = 0;
  for (const r of nominal) {
    const realVals = realByLine.get(r.line)?.values ?? [];
    const entry: BeaEntry = {
      rawName: r.rawName,
      valueLatest: r.values[LATEST],
      realLatest: realVals[LATEST] ?? null,
      real1Y: realVals[ONE_YEAR_AGO] ?? null,
      real2Y: realVals[TWO_YEARS_AGO] ?? null,
    };
    entries.push(entry);
    if (entry.rawName.trim().toLowerCase() === "gross domestic product") {
      gdp = entry.valueLatest ?? 0;
    }
  }
  return { entries, gdp };
}

// ----------------- Matching ----------------------------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function attachBea(allNodes: Map<string, NaicsNode>, root: NaicsNode, bea: BeaEntry[], gdp: number) {
  // Index NAICS nodes by normalized title; if multiple match a title, keep the shallowest.
  const byTitle = new Map<string, NaicsNode>();
  for (const node of allNodes.values()) {
    if (node === root) continue;
    const norm = normalize(node.title);
    if (!norm) continue;
    const existing = byTitle.get(norm);
    if (!existing || node.depth < existing.depth) {
      byTitle.set(norm, node);
    }
  }

  const unmatched: string[] = [];
  let matched = 0;
  for (const e of bea) {
    const norm = normalize(e.rawName);
    if (!norm) continue;
    let target = byTitle.get(norm);

    // Special-case the root
    if (norm === "gross domestic product") target = root;

    if (!target) {
      // Try matching with leading/trailing word variants — many BEA labels are pluralized
      // or have ", and" vs "and"; we already collapsed punctuation. Try without trailing "s".
      const trimmed = norm.endsWith("s") ? norm.slice(0, -1) : norm + "s";
      target = byTitle.get(trimmed);
    }

    if (!target) {
      unmatched.push(e.rawName);
      continue;
    }

    target.valueLatest = e.valueLatest;
    target.shareOfGdp = e.valueLatest != null && gdp > 0 ? e.valueLatest / gdp : null;
    target.growthYoY =
      e.realLatest != null && e.real1Y != null && e.real1Y !== 0
        ? (e.realLatest - e.real1Y) / e.real1Y
        : null;
    target.growth2yr =
      e.realLatest != null && e.real2Y != null && e.real2Y !== 0
        ? (e.realLatest - e.real2Y) / e.real2Y
        : null;
    target.hasValue = e.valueLatest != null;
    matched++;
  }

  return { matched, unmatched };
}

// ----------------- Main ----------------------------

function main() {
  const { root, allNodes } = buildNaicsTree();
  const { entries, gdp } = loadBea();
  const { matched, unmatched } = attachBea(allNodes, root, entries, gdp);

  // Sort children for nicer rendering (NAICS code ascending; ranges first)
  const sortChildren = (n: NaicsNode) => {
    n.children.sort((a, b) => {
      if (a.code.includes("-") && !b.code.includes("-")) return -1;
      if (!a.code.includes("-") && b.code.includes("-")) return 1;
      return a.code.localeCompare(b.code);
    });
    for (const c of n.children) sortChildren(c);
  };
  sortChildren(root);

  let count = 0;
  let withValue = 0;
  const walk = (n: NaicsNode) => {
    count++;
    if (n.hasValue) withValue++;
    for (const c of n.children) walk(c);
  };
  walk(root);

  writeFileSync(OUT_PATH, JSON.stringify(root, null, 2));

  console.log(`Wrote ${OUT_PATH}`);
  console.log(`NAICS nodes: ${count} | with BEA data: ${withValue}`);
  console.log(`BEA entries: ${entries.length} | matched: ${matched} | unmatched: ${unmatched.length}`);
  console.log(`Top-level sectors (${root.children.length}):`);
  for (const c of root.children.slice(0, 25)) {
    console.log(
      `  ${c.code}  ${c.title.slice(0, 50).padEnd(50)} kids=${c.children.length} ${c.hasValue ? "$" + c.valueLatest?.toFixed(0) + "B" : ""}`
    );
  }
  if (unmatched.length) {
    console.log(`\nUnmatched BEA labels:`);
    for (const u of unmatched) console.log(`  - ${u}`);
  }
}

main();
