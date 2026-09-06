import { createHash, sign, verify } from "node:crypto";

export const FEDERATION_VERSION = "1.0";
export const FEDERATION_TYPE = "federated-committed-utterance";
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

function unsignedEnvelope({ issuer, message, publishedAt, publicKey }) {
  const base = normalizeIssuer(issuer);
  const fingerprint = publicKeyFingerprint(publicKey);
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
    proof: {
      type: PROOF_TYPE,
      algorithm: "Ed25519",
      keyId: `${base}/.well-known/intent-commit#${fingerprint}`,
    },
  };
}

export function createFederatedUtterance({ issuer, message, publishedAt = new Date().toISOString(), privateKey, publicKey }) {
  if (!privateKey || !publicKey) throw new Error("Federation signing keys are required.");
  if (!message || message.state !== "COMMITTED") throw new Error("Only COMMITTED messages may be federated.");
  if (Number.isNaN(Date.parse(publishedAt))) throw new Error("publishedAt must be an ISO-compatible timestamp.");
  const envelope = unsignedEnvelope({ issuer, message, publishedAt, publicKey });
  const signature = sign(null, Buffer.from(stableStringify(envelope)), privateKey).toString("base64url");
  return { ...envelope, proof: { ...envelope.proof, signature } };
}

export function verifyFederatedUtterance(envelope, publicKey) {
  const errors = [];
  if (!envelope || typeof envelope !== "object") return { ok: false, errors: ["envelope must be an object"] };
  if (envelope.protocol !== "intent-commit") errors.push("protocol must be intent-commit");
  if (envelope.federationVersion !== FEDERATION_VERSION) errors.push(`federationVersion must be ${FEDERATION_VERSION}`);
  if (envelope.type !== FEDERATION_TYPE) errors.push(`type must be ${FEDERATION_TYPE}`);
  if (envelope.message?.state !== "COMMITTED") errors.push("message.state must be COMMITTED");
  if (envelope.proof?.algorithm !== "Ed25519") errors.push("proof.algorithm must be Ed25519");
  if (envelope.proof?.type !== PROOF_TYPE) errors.push(`proof.type must be ${PROOF_TYPE}`);
  if (!String(envelope.proof?.signature || "").trim()) errors.push("proof.signature is required");
  if (errors.length) return { ok: false, errors };

  const { signature, ...proofWithoutSignature } = envelope.proof;
  const unsigned = { ...envelope, proof: proofWithoutSignature };
  let signatureBytes;
  try {
    signatureBytes = Buffer.from(signature, "base64url");
  } catch {
    return { ok: false, errors: ["proof.signature is not valid base64url"] };
  }
  const ok = verify(null, Buffer.from(stableStringify(unsigned)), publicKey, signatureBytes);
  return { ok, errors: ok ? [] : ["signature verification failed"] };
}

export function createInstanceDescriptor({ issuer, publicKey, protocolVersion = "1.0" }) {
  const base = normalizeIssuer(issuer);
  const fingerprint = publicKeyFingerprint(publicKey);
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  return {
    protocol: "intent-commit",
    protocolVersion: String(protocolVersion),
    federationVersion: FEDERATION_VERSION,
    issuer: base,
    publicKey: {
      id: `${base}/.well-known/intent-commit#${fingerprint}`,
      type: "Ed25519",
      pem: publicKeyPem,
    },
    endpoints: {
      utteranceTemplate: `${base}/federation/utterances/{messageId}`,
    },
  };
}
