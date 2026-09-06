import test from "node:test";
import assert from "node:assert/strict";
import { createCommittedMessage } from "../packages/protocol/index.js";
import { createIssueCommentRequest, formatIssueComment, publishIssueComment } from "../packages/adapters-github/index.js";

const message = createCommittedMessage({
  id: "m1",
  roomCode: "ROOM42",
  author: { id: "u1", displayName: "Alice" },
  statement: "This is the statement I approved.",
  committedAt: "2026-09-06T08:00:00.000Z",
});

test("GitHub adapter formats only a valid committed message envelope", () => {
  const body = formatIssueComment(message);
  assert.match(body, /This is the statement I approved/);
  assert.match(body, /COMMITTED/);
  assert.match(body, /intent-commit:/);
  assert.throws(() => formatIssueComment({ ...message, state: "DRAFT" }), /state must be COMMITTED/i);
});

test("GitHub adapter builds the issue comment endpoint request", () => {
  const request = createIssueCommentRequest({ token: "secret", repository: "acme/project", issueNumber: 12, message });
  assert.equal(request.url, "https://api.github.com/repos/acme/project/issues/12/comments");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers["X-GitHub-Api-Version"], "2026-03-10");
});

test("GitHub adapter can publish with an injected fetch implementation", async () => {
  const calls = [];
  const result = await publishIssueComment({
    token: "secret",
    repository: "acme/project",
    issueNumber: 12,
    message,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return {
        ok: true,
        json: async () => ({ id: 99, url: "api", html_url: "https://github.com/acme/project/issues/12#issuecomment-99" }),
      };
    },
  });
  assert.equal(calls.length, 1);
  assert.equal(result.id, "99");
  assert.match(result.htmlUrl, /issuecomment-99/);
});
