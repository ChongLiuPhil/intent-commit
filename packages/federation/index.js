import { createHash, sign, verify } from "node:crypto";

export const FEDERATION_VERSION = "1.1";
export const SUPPORTED_FEDERATION_VERSIONS = Object.freeze(["1.0", "1.1"]);
export const FEDERATION_TYPE = "federated-committed-utterance";
export const RETRACTION_TYPE = "federated-retraction";
export const REVISION_TYPE = "federated-revision";
export const PROOF_TYPE = "IntentCommitEd25519Signature2026";

export function normalizeIssuer(value) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("PUBLIC_BASE_URL is required when federation is enabled.");
  const url = new URL(raw);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Federation issuer must use http or https.");
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/$/, "");
}

export function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

export function publicKeyFingerprint(publicKey) {
  const der = publicKey.export({ type: "spki", format: "der" });
  return `sha256-${createHash("sha256").update(der).digest("base64url")}`;
}

function proofFor(issuer, publicKey) {
  const base = normalizeIssuer(issuer);
  return {
    type: PROOF_TYPE,
    algorithm: "Ed25519",
    keyId: `${base}/.well-known/intent-commit#${publicKeyFingerprint(publicKey)}`,
  };
}

function signedEnvelope(unsigned, privateKey) {
  const signature = sign(null, Buffer.from(stableStringify(unsigned)), privateKey).toString("base64url");
  return { ...unsigned, proof: { ...unsigned.proof, signature } };
}

function verifyEnvelopeSignature(envelope, publicKey) {
  const signature = String(envelope?.proof?.signature || "").trim();
  if (!signature) return { ok: false, errors: ["proof.signature is required"] };
  const { signature: _signature, ...proofWithoutSignature } = envelope.proof;
  const unsigned = { ...envelope, proof: proofWithoutSignature };
  try {
    const ok = verify(null, Buffer.from(stableStringify(unsigned)), publicKey, Buffer.from(signature, "base64url"));
    return { ok, errors: ok ? [] : ["signature verification failed"] };
  } catch {
    return { ok: false, errors: ["proof.signature is not valid base64url"] };
  }
}

function validFederationVersion(value) {
  return SUPPORTED_FEDERATION_VERSIONS.includes(String(value || ""));
}

function canonicalUtteranceUri(value, issuer) {
  const uri = String(value || "").trim();
  if (!uri) throw new Error("Canonical utterance URI is required.");
  const parsed = new URL(uri);
  const base = normalizeIssuer(issuer);
  if (!uri.startsWith(`${base}/federation/utterances/`)) {
    throw new Error("Federation relation must reference an utterance from the same issuer.");
  }
  parsed.hash = "";
  return parsed.toString();
}

function normalizedActor(actor) {
  const value = {
    id: String(actor?.id || "").trim(),
    displayName: String(actor?.displayName || "").trim(),
  };
  if (!value.id || !value.displayName) throw new Error("Federation relation actor is required.");
  return value;
}

function unsignedUtterance({ issuer, message, publishedAt, publicKey }) {
  const base = normalizeIssuer(issuer);
  const id = `${base}/federation/utterances/${encodeURIComponent(message.id)}`;
  return {
    protocol: "intent-commit",
    protocolVersion: String(message.protocolVersion || "1.0"),
    federationVersion: FEDERATION_VERSION,
    type: FEDERATION_TYPE,
    id,
    issuer: base,
    publishedAt: String(publishedAt || ""),
    message,
    proof: proofFor(base, publicKey),
  };
}

export function createFederatedUtterance({ issuer, message, publishedAt = new Date().toISOString(), privateKey, publicKey }) {
  if (!privateKey || !publicKey) throw new Error("Federation signing keys are required.");
  if (!message || message.state !== "COMMITTED") throw new Error("Only COMMITTED messages may be federated.");
  if (Number.isNaN(Date.parse(publishedAt))) throw new Error("publishedAt must be an ISO-compatible timestamp.");
  return signedEnvelope(unsignedUtterance({ issuer, message, publishedAt, publicKey }), privateKey);
}

export function verifyFederatedUtterance(envelope, publicKey) {
  const errors = [];
  if (!envelope || typeof envelope !== "object") return { ok: false, errors: ["envelope must be an object"] };
  if (envelope.protocol !== "intent-commit") errors.push("protocol must be intent-commit");
  if (!validFederationVersion(envelope.federationVersion)) errors.push("unsupported federationVersion");
  if (envelope.type !== FEDERATION_TYPE) errors.push(`type must be ${FEDERATION_TYPE}`);
  if (envelope.message?.state !== "COMMITTED") errors.push("message.state must be COMMITTED");
  if (envelope.proof?.algorithm !== "Ed25519") errors.push("proof.algorithm must be Ed25519");
  if (envelope.proof?.type !== PROOF_TYPE) errors.push(`proof.type must be ${PROOF_TYPE}`);
  if (errors.length) return { ok: false, errors };
  return verifyEnvelopeSignature(envelope, publicKey);
}

function unsignedRelation({ type, issuer, eventId, actor, subject, replacement = null, reason = "", publishedAt, publicKey }) {
  if (![RETRACTION_TYPE, REVISION_TYPE].includes(type)) throw new Error("Unknown federation relation type.");
  const base = normalizeIssuer(issuer);
  const idPart = String(eventId || "").trim();
  if (!idPart) throw new Error("Federation event id is required.");
  if (Number.isNaN(Date.parse(publishedAt))) throw new Error("publishedAt must be an ISO-compatible timestamp.");
  const normalizedReason = String(reason || "").trim();
  if (normalizedReason.length > 1000) throw new Error("Federation relation reason is too long.");
  const value = {
    protocol: "intent-commit",
    protocolVersion: "1.0",
    federationVersion: FEDERATION_VERSION,
    type,
    id: `${base}/federation/events/${encodeURIComponent(idPart)}`,
    issuer: base,
    publishedAt: String(publishedAt),
    actor: normalizedActor(actor),
    subject: canonicalUtteranceUri(subject, base),
    reason: normalizedReason,
    proof: proofFor(base, publicKey),
  };
  if (type === REVISION_TYPE) {
    const replacementUri = canonicalUtteranceUri(replacement, base);
    if (replacementUri === value.subject) throw new Error("A revision must point to a different utterance.");
    value.replacement = replacementUri;
  }
  return value;
}

export function createFederatedRetraction({ issuer, eventId, actor, subject, reason = "", publishedAt = new Date().toISOString(), privateKey, publicKey }) {
  if (!privateKey || !publicKey) throw new Error("Federation signing keys are required.");
  return signedEnvelope(unsignedRelation({
    type: RETRACTION_TYPE,
    issuer,
    eventId,
    actor,
    subject,
    reason,
    publishedAt,
    publicKey,
  }), privateKey);
}

export function createFederatedRevision({ issuer, eventId, actor, subject, replacement, reason = "", publishedAt = new Date().toISOString(), privateKey, publicKey }) {
  if (!privateKey || !publicKey) throw new Error("Federation signing keys are required.");
  return signedEnvelope(unsignedRelation({
    type: REVISION_TYPE,
    issuer,
    eventId,
    actor,
    subject,
    replacement,
    reason,
    publishedAt,
    publicKey,
  }), privateKey);
}

export function verifyFederationRelation(envelope, publicKey) {
  const errors = [];
  if (!envelope || typeof envelope !== "object") return { ok: false, errors: ["envelope must be an object"] };
  if (envelope.protocol !== "intent-commit") errors.push("protocol must be intent-commit");
  if (!validFederationVersion(envelope.federationVersion)) errors.push("unsupported federationVersion");
  if (![RETRACTION_TYPE, REVISION_TYPE].includes(envelope.type)) errors.push("type must be a federation relation");
  if (!String(envelope.id || "").startsWith(`${String(envelope.issuer || "")}/federation/events/`)) errors.push("id must be a canonical federation event URI");
  if (!String(envelope.actor?.id || "").trim() || !String(envelope.actor?.displayName || "").trim()) errors.push("actor is required");
  if (!String(envelope.subject || "").trim()) errors.push("subject is required");
  if (envelope.type === REVISION_TYPE && !String(envelope.replacement || "").trim()) errors.push("replacement is required for a revision");
  if (envelope.type === RETRACTION_TYPE && envelope.replacement) errors.push("retraction must not include replacement");
  if (envelope.proof?.algorithm !== "Ed25519") errors.push("proof.algorithm must be Ed25519");
  if (envelope.proof?.type !== PROOF_TYPE) errors.push(`proof.type must be ${PROOF_TYPE}`);
  if (errors.length) return { ok: false, errors };
  return verifyEnvelopeSignature(envelope, publicKey);
}

export function createInstanceDescriptor({ issuer, publicKey, protocolVersion = "1.0" }) {
  const base = normalizeIssuer(issuer);
  const fingerprint = publicKeyFingerprint(publicKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return {
    protocol: "intent-commit",
    protocolVersion: String(protocolVersion),
    federationVersion: FEDERATION_VERSION,
    supportedFederationVersions: [...SUPPORTED_FEDERATION_VERSIONS],
    issuer: base,
    publicKey: {
      id: `${base}/.well-known/intent-commit#${fingerprint}`,
      type: "Ed25519",
      pem: publicKeyPem,
    },
    endpoints: {
      utteranceTemplate: `${base}/federation/utterances/{messageId}`,
      relationTemplate: `${base}/federation/utterances/{messageId}/relations`,
      eventTemplate: `${base}/federation/events/{eventId}`,
    },
  };
}
