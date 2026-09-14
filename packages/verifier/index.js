import { createPublicKey } from "node:crypto";
import { validateCommittedMessage } from "../protocol/index.js";
import {
  verifyFederatedUtterance,
  verifyFederationRelation,
  verifyFederatedProvenanceEdge,
  verifyFederatedArgumentMap,
  FEDERATION_TYPE,
  RETRACTION_TYPE,
  REVISION_TYPE,
  PROVENANCE_TYPE,
  ARGUMENT_MAP_TYPE,
} from "../federation/index.js";

export function publicKeyFromPem(pem) {
  return createPublicKey(String(pem || ""));
}

export function verifyIntentCommitObject(value, { publicKey = null } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["object must be a JSON object"] };
  if (value.type === "committed-message") return validateCommittedMessage(value);
  if (!publicKey) return { ok: false, errors: ["publicKey is required for signed federation objects"] };
  if (value.type === FEDERATION_TYPE) return verifyFederatedUtterance(value, publicKey);
  if (value.type === RETRACTION_TYPE || value.type === REVISION_TYPE) return verifyFederationRelation(value, publicKey);
  if (value.type === PROVENANCE_TYPE) return verifyFederatedProvenanceEdge(value, publicKey);
  if (value.type === ARGUMENT_MAP_TYPE) return verifyFederatedArgumentMap(value, publicKey);
  return { ok: false, errors: [`unsupported Intent Commit object type: ${String(value.type || "(missing)")}`] };
}

export function verifyJsonWithPublicKeyPem(value, pem) {
  return verifyIntentCommitObject(value, { publicKey: publicKeyFromPem(pem) });
}
