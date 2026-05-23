import treeJson from "@/data/naics-tree.json";

export type NaicsNode = {
  code: string;
  title: string;
  depth: number;
  hasValue: boolean;
  valueLatest: number | null;
  shareOfGdp: number | null;
  growthYoY: number | null;
  growth2yr: number | null;
  children: NaicsNode[];
};

export const naicsTree = treeJson as NaicsNode;

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
