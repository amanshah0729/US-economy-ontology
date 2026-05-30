import Anthropic from "@anthropic-ai/sdk";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { naicsTree, nodeByCode } from "@/lib/industry";

export const runtime = "nodejs";

let anthropicClient: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!anthropicClient)
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

// Compact anchor list: the ~20 sectors plus their 3-digit subsectors. Keeps the
// prompt small (~120 lines) while giving the model real codes to anchor on. It
// may also emit deeper NAICS codes from its own knowledge — every returned code
// is validated against our tree below, so hallucinated codes are dropped.
function buildAnchors(): string {
  const lines: string[] = [];
  for (const sector of naicsTree.children) {
    lines.push(`${sector.code}  ${sector.title}`);
    for (const sub of sector.children) {
      lines.push(`  ${sub.code}  ${sub.title}`);
    }
  }
  return lines.join("\n");
}

const SORT_TOOL: Anthropic.Tool = {
  name: "assign_industries",
  description:
    "Assign the note to the NAICS industries it relates to — a mix of broad " +
    "sector codes and more specific deeper codes where clearly relevant.",
  input_schema: {
    type: "object",
    properties: {
      codes: {
        type: "array",
        items: { type: "string" },
        description:
          "NAICS codes (any depth) the note relates to. Include broad sector " +
          "codes plus specific codes where the note clearly fits.",
      },
    },
    required: ["codes"],
  },
};

export async function POST(request: Request) {
  // --- Auth: verify the caller's Firebase ID token (no open proxy). ---
  const authz = request.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : null;
  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 401 });
  }
  try {
    await getAdminAuth().verifyIdToken(token);
  } catch {
    return Response.json({ error: "Invalid token" }, { status: 401 });
  }

  const { noteText } = (await request.json().catch(() => ({}))) as {
    noteText?: string;
  };
  if (!noteText || !noteText.trim()) {
    return Response.json({ codes: [], labels: [] });
  }

  try {
    const msg = await anthropic().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: [SORT_TOOL],
      tool_choice: { type: "tool", name: "assign_industries" },
      messages: [
        {
          role: "user",
          content:
            `Here are the U.S. NAICS sectors and their main subsectors:\n\n${buildAnchors()}\n\n` +
            `A user logged this note about someone they talked to:\n"""\n${noteText}\n"""\n\n` +
            `Assign the NAICS industries this note relates to. Return a mix of ` +
            `broad sector codes and more specific deeper NAICS codes where the ` +
            `note clearly fits. Only include codes you are confident about.`,
        },
      ],
    });

    const toolUse = msg.content.find((c) => c.type === "tool_use");
    const raw =
      toolUse && toolUse.type === "tool_use"
        ? ((toolUse.input as { codes?: unknown }).codes ?? [])
        : [];

    // Validate every returned code against our real NAICS tree; drop unknowns.
    const valid = (Array.isArray(raw) ? raw : [])
      .filter((c): c is string => typeof c === "string")
      .map((c) => c.trim())
      .filter((c) => c && c !== "ROOT" && nodeByCode.has(c));

    const codes = [...new Set(valid)];
    const labels = codes.map((code) => ({
      code,
      title: nodeByCode.get(code)?.node.title ?? code,
    }));

    return Response.json({ codes, labels });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "AI sort failed" },
      { status: 500 },
    );
  }
}
