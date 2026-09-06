const emptyList = () => [];

export function normalizeCard(card = {}) {
  return {
    core_claim: String(card.core_claim || "").trim(),
    communicative_intention: String(card.communicative_intention || "").trim(),
    explicit_reasons: Array.isArray(card.explicit_reasons) ? card.explicit_reasons.map(String).filter(Boolean) : emptyList(),
    assumptions: Array.isArray(card.assumptions) ? card.assumptions.map(String).filter(Boolean) : emptyList(),
    ambiguities: Array.isArray(card.ambiguities) ? card.ambiguities.map(String).filter(Boolean) : emptyList(),
    possible_misinterpretations: Array.isArray(card.possible_misinterpretations)
      ? card.possible_misinterpretations.map(String).filter(Boolean)
      : emptyList(),
    questions_for_speaker: Array.isArray(card.questions_for_speaker)
      ? card.questions_for_speaker.map(String).filter(Boolean)
      : emptyList(),
    proposed_statement: String(card.proposed_statement || "").trim(),
  };
}

export function demoReflect({ draft, clarification = "" }) {
  const cleaned = String(draft || "").trim();
  const extra = String(clarification || "").trim();

  if (!cleaned) {
    throw new Error("Draft is required.");
  }

  const firstSentence = cleaned.split(/(?<=[。！？.!?])\s*/)[0] || cleaned;
  const hasReasonMarker = /因为|由于|原因|所以|because|since|therefore|so\b/i.test(cleaned);
  const hasRequestMarker = /希望|请|建议|能否|是否|would you|could you|please|suggest/i.test(cleaned);

  const proposed = extra
    ? `${cleaned}\n\n补充澄清：${extra}`
    : cleaned;

  return normalizeCard({
    core_claim: firstSentence,
    communicative_intention: hasRequestMarker
      ? "表达一个立场，并推动对方回应其中的请求或建议。"
      : "表达当前立场，并让对方准确理解其重点。",
    explicit_reasons: hasReasonMarker ? ["原始表达中包含了显式的理由或因果线索。"] : [],
    assumptions: [],
    ambiguities: cleaned.length < 28 ? ["当前表达较短，关键概念、范围或理由可能仍需进一步说明。"] : [],
    possible_misinterpretations: /你|you/i.test(cleaned)
      ? ["涉及对方的表述可能被理解为对人的评价，而不是对观点或方案的评价。请确认这是你的本意。"]
      : [],
    questions_for_speaker: [
      ...(hasReasonMarker ? [] : ["你是否希望补充为什么你持有这个判断？"]),
      ...(hasRequestMarker ? [] : ["你希望对方在理解后做什么：回应、澄清、修改，还是仅仅知悉？"]),
    ],
    proposed_statement: proposed,
  });
}

export function parseModelJson(text) {
  const raw = String(text || "").trim();
  if (!raw) throw new Error("Model returned an empty response.");

  const unfenced = raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return normalizeCard(JSON.parse(unfenced));
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return normalizeCard(JSON.parse(unfenced.slice(start, end + 1)));
    }
    throw new Error("Model response was not valid JSON.");
  }
}
