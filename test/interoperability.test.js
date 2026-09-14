import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { canonicalizeJson, CANONICALIZATION_VERSION } from "../packages/protocol/index.js";
import { stableStringify } from "../packages/federation/index.js";
import { verifyJsonWithPublicKeyPem } from "../packages/verifier/index.js";

const vector = JSON.parse(await readFile(new URL("../test-vectors/v1.0.json", import.meta.url), "utf8"));

test("IC-C14N/1 matches the frozen canonicalization vector", () => {
  assert.equal(CANONICALIZATION_VERSION, vector.canonicalizationVersion);
  assert.equal(canonicalizeJson(vector.canonicalization.input), vector.canonicalization.expected);
});

test("protocol canonicalization matches historical federation canonicalization for signed objects", () => {
  const envelope = structuredClone(vector.signedUtterance);
  delete envelope.proof.signature;
  assert.equal(canonicalizeJson(envelope), vector.expectedUnsignedCanonical);
  assert.equal(stableStringify(envelope), vector.expectedUnsignedCanonical);
});

test("standalone verifier accepts the frozen Ed25519 test vector", () => {
  assert.deepEqual(verifyJsonWithPublicKeyPem(vector.signedUtterance, vector.publicKeyPem), { ok: true, errors: [] });
});

test("standalone verifier rejects a tampered signed statement", () => {
  const changed = structuredClone(vector.signedUtterance);
  changed.message.statement = "Tampered.";
  assert.equal(verifyJsonWithPublicKeyPem(changed, vector.publicKeyPem).ok, false);
});
