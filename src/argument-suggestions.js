import { normalizeArgumentMapContent } from "../packages/federation/index.js";
import { parseModelJson } from "./reflector.js";

const ARGUMENT_SYSTEM_PROMPT = `You analyze one already-COMMITTED human utterance and suggest a fine-grained argument structure for the same human to inspect privately.

NON-NEGOTIABLE RULES:
1. Do not invent claims, reasons, objections, qualifications, facts, examples, commitments, or intentions.
2. Use only content that is explicit in, or conservatively decomposable from, the supplied utterance.
3. If the utterance contains only one claim, return one claim node and no edges.
4. A reason node may only support another node.
5. An objection node may only challenge another node.
6. A qualification node may only qualify another node.
7. Keep uncertainty and modality intact.
8. This is only a private suggestion. The human must review and explicitly approve any public structure later.
9. Output JSON only. No markdown.

Return exactly:
{
  "nodes": [
    { "id": "claim-1", "kind": "claim", "text": "..." }
  ],
  "edges": [
    { "source": "reason-1", "target": "claim-1", "predicate": "supports" }
  ]
}`;

function extractText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) return response.output_text;
  const chunks = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

export function demoSuggestArgumentStructure(statement) {
  const text = String(statement || "").trim();
  if (!text) throw new Error("Committed statement is required.");
  return normalizeArgumentMapContent({
    nodes: [{ id: "claim-1", kind: "claim", text }],
    edges: [],
  });
}

export async function suggestArgumentStructureWithOpenAI({ statement }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");
  const text = String(statement || "").trim();
  if (!text) throw new Error("Committed statement is required.");
  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  const input = `${ARGUMENT_SYSTEM_PROMPT}\n\nCOMMITTED UTTERANCE:\n${text}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, input, reasoning: { effort: "low" } }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI API returned HTTP ${response.status}.`);
  const parsed = parseModelJson(extractText(data));
  return normalizeArgumentMapContent(parsed);
}
