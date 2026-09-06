export const PROTOCOL_NAME = "intent-commit";
export const PROTOCOL_VERSION = "1.0";

export const MESSAGE_STATES = Object.freeze([
  "DRAFT",
  "REFLECTED",
  "CLARIFYING",
  "APPROVED",
  "COMMITTED",
]);

export const ROOM_ROLES = Object.freeze(["owner", "moderator", "member"]);

const transitions = new Map([
  ["DRAFT", new Set(["REFLECTED"])],
  ["REFLECTED", new Set(["CLARIFYING", "APPROVED"])],
  ["CLARIFYING", new Set(["REFLECTED", "APPROVED"])],
  ["APPROVED", new Set(["COMMITTED"])],
  ["COMMITTED", new Set()],
]);

const listFields = [
  "explicit_reasons",
  "assumptions",
  "ambiguities",
  "possible_misinterpretations",
  "questions_for_speaker",
];

export function canTransition(from, to) {
  return transitions.get(String(from))?.has(String(to)) || false;
}

export function assertTransition(from, to) {
  if (!canTransition(from, to)) {
    throw new Error(`Protocol transition ${from} → ${to} is not allowed.`);
  }
  return true;
}

export function normalizeIntentCard(card = {}) {
  const result = {
    core_claim: String(card.core_claim || "").trim(),
    communicative_intention: String(card.communicative_intention || "").trim(),
    proposed_statement: String(card.proposed_statement || "").trim(),
  };
  for (const field of listFields) {
    result[field] = Array.isArray(card[field]) ? card[field].map(String).map((v) => v.trim()).filter(Boolean) : [];
  }
  return result;
}

export function validateIntentCard(card) {
  const normalized = normalizeIntentCard(card);
  const errors = [];
  if (!normalized.core_claim) errors.push("core_claim is required");
  if (!normalized.communicative_intention) errors.push("communicative_intention is required");
  if (!normalized.proposed_statement) errors.push("proposed_statement is required");
  return { ok: errors.length === 0, errors, value: normalized };
}

export function createCommittedMessage({ id, roomCode, author, statement, committedAt }) {
  const envelope = {
    protocol: PROTOCOL_NAME,
    protocolVersion: PROTOCOL_VERSION,
    type: "committed-message",
    state: "COMMITTED",
    id: String(id || "").trim(),
    room: { code: String(roomCode || "").trim().toUpperCase() },
    author: {
      id: String(author?.id || "").trim(),
      displayName: String(author?.displayName || "").trim(),
    },
    statement: String(statement || "").trim(),
    committedAt: String(committedAt || "").trim(),
  };
  const validation = validateCommittedMessage(envelope);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  return envelope;
}

export function validateCommittedMessage(value) {
  const errors = [];
  if (!value || typeof value !== "object") return { ok: false, errors: ["message must be an object"] };
  if (value.protocol !== PROTOCOL_NAME) errors.push(`protocol must be ${PROTOCOL_NAME}`);
  if (value.protocolVersion !== PROTOCOL_VERSION) errors.push(`protocolVersion must be ${PROTOCOL_VERSION}`);
  if (value.type !== "committed-message") errors.push("type must be committed-message");
  if (value.state !== "COMMITTED") errors.push("state must be COMMITTED");
  if (!String(value.id || "").trim()) errors.push("id is required");
  if (!String(value.room?.code || "").trim()) errors.push("room.code is required");
  if (!String(value.author?.id || "").trim()) errors.push("author.id is required");
  if (!String(value.author?.displayName || "").trim()) errors.push("author.displayName is required");
  if (!String(value.statement || "").trim()) errors.push("statement is required");
  if (!String(value.committedAt || "").trim() || Number.isNaN(Date.parse(value.committedAt))) errors.push("committedAt must be an ISO-compatible timestamp");
  return { ok: errors.length === 0, errors };
}

export function canManageMember(actorRole, targetRole) {
  if (actorRole === "owner") return targetRole !== "owner";
  if (actorRole === "moderator") return targetRole === "member";
  return false;
}
