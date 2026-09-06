import test from "node:test";
import assert from "node:assert/strict";
import { demoReflect, normalizeCard, parseModelJson } from "../src/reflector.js";

test("demo reflector never fabricates a concrete reason", () => {
  const card = demoReflect({ draft: "我不同意这个方案。" });
  assert.equal(card.explicit_reasons.length, 0);
  assert.ok(card.questions_for_speaker.some((q) => q.includes("为什么")));
});

test("clarification is kept visible in proposed statement in demo mode", () => {
  const card = demoReflect({ draft: "这个方案有问题。", clarification: "我担心的是长期维护成本。" });
  assert.match(card.proposed_statement, /长期维护成本/);
});

test("normalization prevents missing list fields", () => {
  const card = normalizeCard({ core_claim: "x", proposed_statement: "y" });
  assert.deepEqual(card.assumptions, []);
  assert.deepEqual(card.ambiguities, []);
});

test("model JSON parser accepts fenced JSON", () => {
  const card = parseModelJson('```json\n{"core_claim":"x","proposed_statement":"y"}\n```');
  assert.equal(card.core_claim, "x");
  assert.equal(card.proposed_statement, "y");
});
