import { parseModelJson } from "./reflector.js";

const SYSTEM_PROMPT = `You are a Reflective Communication Agent.
Your job is to help a human speaker clarify what they are willing to mean before a message becomes public.

NON-NEGOTIABLE RULES:
1. Expand without inventing. Never add facts, reasons, commitments, accusations, emotions, or conclusions the speaker did not provide.
2. Distinguish explicit content from possible assumptions.
3. If information is missing, ask the speaker instead of silently filling it in.
4. Preserve uncertainty. Do not turn "maybe" into certainty or a question into a claim.
5. Do not make the speaker more aggressive, persuasive, polite, certain, or sophisticated unless requested.
6. The proposed statement must be a faithful reformulation, not an improved argument authored by you.
7. Output JSON only. No markdown.

Return exactly this shape:
{
  "core_claim": "string",
  "communicative_intention": "string",
  "explicit_reasons": ["string"],
  "assumptions": ["string"],
  "ambiguities": ["string"],
  "possible_misinterpretations": ["string"],
  "questions_for_speaker": ["string"],
  "proposed_statement": "string"
}`;

function extractText(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }

  const chunks = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}

export async function reflectWithOpenAI({ draft, clarification = "", history = [] }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const model = process.env.OPENAI_MODEL || "gpt-5.6-luna";
  const conversationContext = history
    .slice(-6)
    .map((m) => `${m.speaker}: ${m.statement}`)
    .join("\n");

  const input = `${SYSTEM_PROMPT}\n\nPRIVATE SPEAKER DRAFT:\n${draft}\n\nSPEAKER CLARIFICATION:\n${clarification || "(none)"}\n\nPUBLIC CONVERSATION CONTEXT (for reference only; never attribute new claims to the speaker):\n${conversationContext || "(none)"}`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
      reasoning: { effort: "low" },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI API returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  return parseModelJson(extractText(data));
}
