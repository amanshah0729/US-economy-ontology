/**
 * AI-fill missing NAICS value-added + growth using Claude Haiku 4.5 with web search.
 *
 * Reads src/data/naics-tree.json, recursively fills nodes at depth 1-3 that lack
 * BEA data by asking Claude (one batched call per parent), and writes the tree
 * back to disk after every successful batch (resumable).
 *
 * Usage:
 *   node --env-file=.env --import tsx scripts/ai-fill-naics.ts [--limit N] [--depth-max D] [--dry-run]
 *   or:  npm run ai-fill -- --limit 9999
 *
 * Defaults: --limit 1, --depth-max 3 (hard ceiling at 3).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

const TREE_PATH = join(process.cwd(), "src/data/naics-tree.json");
const MODEL = "claude-haiku-4-5-20251001";
const CONCURRENCY = 5;
const MAX_DEPTH_HARD_CEILING = 3;

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

// ---------- args ----------

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { limit: 1, depthMax: MAX_DEPTH_HARD_CEILING, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--limit") out.limit = parseInt(args[++i], 10);
    else if (a === "--depth-max") out.depthMax = Math.min(parseInt(args[++i], 10), MAX_DEPTH_HARD_CEILING);
    else if (a === "--dry-run") out.dryRun = true;
  }
  return out;
}

// ---------- tree IO ----------

function loadTree(): NaicsNode {
  return JSON.parse(readFileSync(TREE_PATH, "utf8"));
}
function saveTree(t: NaicsNode) {
  writeFileSync(TREE_PATH, JSON.stringify(t, null, 2));
}

// ---------- Claude ----------

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an economist estimating U.S. industry value-added in 2025 Q4 (annualized, USD billions) and real year-over-year growth (% from 2024 Q4 to 2025 Q4) for specific NAICS industries.

Use the web_search tool to find recent BLS QCEW, Census County Business Patterns, industry reports, and company financials. Rely on multiple sources when possible.

You will be given a parent NAICS industry with its known value, and a list of sibling/child industries to estimate. Your estimates for the missing children should be plausible such that, combined with already-known children, they sum to roughly the parent's value.

Output via the submit_estimates tool. Be conservative with growth rates — most industries fall between -10% and +15% YoY.`;

const SUBMIT_TOOL = {
  name: "submit_estimates",
  description: "Submit value-added and growth estimates for the missing NAICS children.",
  input_schema: {
    type: "object" as const,
    properties: {
      estimates: {
        type: "array",
        items: {
          type: "object",
          required: ["code", "valueLatest_billions", "growthYoY_percent"],
          properties: {
            code: { type: "string", description: "NAICS code of the child being estimated" },
            valueLatest_billions: {
              type: "number",
              description: "Estimated annualized value-added for 2025 Q4 in USD billions",
            },
            growthYoY_percent: {
              type: "number",
              description: "Estimated real YoY growth in percent (e.g. 3.5 means +3.5%)",
            },
          },
        },
      },
    },
    required: ["estimates"],
  },
};

const WEB_SEARCH_TOOL = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 4,
};

function buildPrompt(parent: NaicsNode, known: NaicsNode[], toEstimate: NaicsNode[]): string {
  const knownSum = known.reduce((s, n) => s + (n.valueLatest ?? 0), 0);
  const budget = (parent.valueLatest ?? 0) - knownSum;

  const parentBlock = parent.code === "ROOT"
    ? `Parent: U.S. Economy (total GDP)
  Value: $${parent.valueLatest?.toFixed(1)}B (annualized 2025 Q4)`
    : `Parent: NAICS ${parent.code} — ${parent.title}
  Value: $${parent.valueLatest?.toFixed(1)}B (annualized 2025 Q4)
  Real YoY growth: ${parent.growthYoY != null ? (parent.growthYoY * 100).toFixed(2) + "%" : "unknown"}
  Description: ${parent.description.slice(0, 500)}`;

  const knownBlock = known.length
    ? "\n\nAlready-known children (do NOT re-estimate):\n" +
      known
        .map((n) => `  - ${n.code} ${n.title}: $${n.valueLatest?.toFixed(1)}B, ${n.growthYoY != null ? (n.growthYoY * 100).toFixed(1) + "%" : "—"} YoY`)
        .join("\n")
    : "";

  const estBlock =
    `\n\nChildren to estimate (remaining budget ≈ $${budget.toFixed(1)}B):\n` +
    toEstimate
      .map(
        (n) =>
          `  - ${n.code} ${n.title}\n    Description: ${n.description.slice(0, 300).replace(/\s+/g, " ")}`
      )
      .join("\n");

  return `${parentBlock}${knownBlock}${estBlock}\n\nFor each "Child to estimate", web-search if helpful, then call submit_estimates with one entry per child (using the exact NAICS code given).`;
}

type Estimate = { code: string; valueLatest_billions: number; growthYoY_percent: number };

async function callClaude(prompt: string): Promise<Estimate[]> {
  const initial = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    tools: [WEB_SEARCH_TOOL as never, SUBMIT_TOOL as never],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: prompt }],
  });

  // Iterative tool loop: handle web_search calls (server-side, no roundtrip needed
  // with the built-in tool — Anthropic auto-executes) and surface submit_estimates.
  let response = initial;
  for (let i = 0; i < 6; i++) {
    const submitBlock = response.content.find(
      (b) => b.type === "tool_use" && b.name === "submit_estimates"
    );
    if (submitBlock && submitBlock.type === "tool_use") {
      const input = submitBlock.input as { estimates: Estimate[] };
      return input.estimates;
    }
    if (response.stop_reason !== "tool_use") break;
    // Web search is a server-side tool — Claude executes it itself and responds.
    // If we get here without submit_estimates, just break (no client-side tool to fulfill).
    break;
  }
  throw new Error("No submit_estimates call returned");
}

// ---------- planning ----------

type Batch = { parent: NaicsNode; known: NaicsNode[]; missing: NaicsNode[] };

function findBatches(tree: NaicsNode, depthMax: number): Batch[] {
  const batches: Batch[] = [];
  const walk = (node: NaicsNode) => {
    if (!node.hasValue) return; // we can only fill children if we know the parent
    if (node.depth >= depthMax) return; // don't fill beyond cap
    if (node.children.length === 0) return;

    const known: NaicsNode[] = [];
    const missing: NaicsNode[] = [];
    for (const c of node.children) {
      if (c.hasValue) known.push(c);
      else missing.push(c);
    }
    if (missing.length > 0) batches.push({ parent: node, known, missing });
    for (const c of node.children) walk(c);
  };
  walk(tree);
  return batches;
}

// Sectors without data — fill via ROOT-as-parent batch.
function findRootBatch(tree: NaicsNode): Batch | null {
  const known: NaicsNode[] = [];
  const missing: NaicsNode[] = [];
  for (const c of tree.children) {
    if (c.hasValue) known.push(c);
    else missing.push(c);
  }
  if (missing.length === 0) return null;
  return { parent: tree, known, missing };
}

// ---------- concurrency ----------

async function withConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = await fn(items[i], i);
      } catch (e) {
        console.error(`  ❌ item ${i} failed:`, e instanceof Error ? e.message : e);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ---------- main ----------

async function main() {
  const args = parseArgs();
  console.log(`Args: limit=${args.limit} depthMax=${args.depthMax} dryRun=${args.dryRun} model=${MODEL}`);

  if (!process.env.ANTHROPIC_API_KEY && !args.dryRun) {
    console.error("Set ANTHROPIC_API_KEY (e.g. via .env + --env-file=.env)");
    process.exit(1);
  }

  const tree = loadTree();
  const GDP = tree.valueLatest ?? 0;
  if (GDP <= 0) {
    console.error("Root GDP is not set; aborting.");
    process.exit(1);
  }

  // Build batches: root-batch first (fills sectors), then per-depth from 1 to depthMax-1.
  const allBatches: Batch[] = [];
  const rootB = findRootBatch(tree);
  if (rootB) allBatches.push(rootB);
  // Note: subsequent batches need depth-by-depth processing because filling a parent
  // unlocks its children for processing. We re-scan after each pass.

  const processBatch = async (b: Batch, index: number, total: number) => {
    const prompt = buildPrompt(b.parent, b.known, b.missing);
    const tag = `[${index + 1}/${total}] ${b.parent.code} ${b.parent.title.slice(0, 30)} → ${b.missing.length} children`;
    if (args.dryRun) {
      console.log(`\n=== ${tag} (DRY RUN) ===\n${prompt}\n`);
      return;
    }
    console.log(tag);
    try {
      const estimates = await callClaude(prompt);
      const byCode = new Map(estimates.map((e) => [e.code, e]));
      for (const child of b.missing) {
        const est = byCode.get(child.code);
        if (!est) {
          console.log(`  ⚠️  no estimate returned for ${child.code} ${child.title}`);
          continue;
        }
        child.valueLatest = est.valueLatest_billions;
        child.growthYoY = est.growthYoY_percent / 100;
        child.growth2yr = null;
        child.shareOfGdp = est.valueLatest_billions / GDP;
        child.hasValue = true;
        child.aiGenerated = true;
        console.log(
          `  ✓ ${child.code} ${child.title.slice(0, 36)}: $${est.valueLatest_billions.toFixed(1)}B ${est.growthYoY_percent >= 0 ? "+" : ""}${est.growthYoY_percent.toFixed(1)}%`
        );
      }
      saveTree(tree); // checkpoint after every batch
    } catch (e) {
      console.error(`  ❌ batch failed:`, e instanceof Error ? e.message : e);
    }
  };

  let processed = 0;
  let pass = 0;

  // Process root-batch first (sequentially — small).
  if (rootB) {
    await processBatch(rootB, 0, 1);
    processed++;
    pass++;
  }
  if (processed >= args.limit) {
    console.log(`\nReached limit=${args.limit}. Stopping.`);
    summarize(tree);
    return;
  }

  // Now repeatedly scan for new batches (since filling a parent enables its children's batch).
  while (true) {
    const batches = findBatches(tree, args.depthMax);
    if (batches.length === 0) break;
    const remaining = args.limit - processed;
    const slice = batches.slice(0, remaining);
    console.log(`\n--- Pass ${++pass}: ${batches.length} batches found, processing ${slice.length} with concurrency=${CONCURRENCY} ---`);

    await withConcurrency(slice, CONCURRENCY, (b, i) => processBatch(b, processed + i, processed + batches.length));
    processed += slice.length;

    if (processed >= args.limit) break;
    if (slice.length < batches.length) break; // we limited mid-pass
  }

  summarize(tree);
}

function summarize(tree: NaicsNode) {
  let total = 0, withVal = 0, ai = 0;
  const walk = (n: NaicsNode) => {
    total++;
    if (n.hasValue) withVal++;
    if (n.aiGenerated) ai++;
    for (const c of n.children) walk(c);
  };
  walk(tree);
  console.log(`\nDone. Total: ${total} | with value: ${withVal} | AI-generated: ${ai}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
