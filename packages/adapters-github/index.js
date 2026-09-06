import { validateCommittedMessage } from "../protocol/index.js";

const API_VERSION = "2026-03-10";

export function normalizeRepository(value) {
  const repository = String(value || "").trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("Repository must use owner/name format.");
  }
  return repository;
}

export function formatIssueComment(message) {
  const validation = validateCommittedMessage(message);
  if (!validation.ok) throw new Error(validation.errors.join("; "));
  const metadata = JSON.stringify({
    protocol: message.protocol,
    protocolVersion: message.protocolVersion,
    messageId: message.id,
    room: message.room.code,
    state: message.state,
  });
  return `${message.statement}\n\n---\n*Intent Commit · ${message.state} · ${message.author.displayName} · room ${message.room.code}*\n\n<!-- intent-commit:${metadata} -->`;
}

export function createIssueCommentRequest({ token, repository, issueNumber, message }) {
  const repo = normalizeRepository(repository);
  const number = Number(issueNumber);
  if (!Number.isInteger(number) || number < 1) throw new Error("Issue number must be a positive integer.");
  const authToken = String(token || "").trim();
  if (!authToken) throw new Error("GITHUB_TOKEN is not configured.");

  return {
    url: `https://api.github.com/repos/${repo}/issues/${number}/comments`,
    init: {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        "User-Agent": "intent-commit",
        "X-GitHub-Api-Version": API_VERSION,
      },
      body: JSON.stringify({ body: formatIssueComment(message) }),
    },
  };
}

export async function publishIssueComment({ token, repository, issueNumber, message, fetchImpl = fetch }) {
  const { url, init } = createIssueCommentRequest({ token, repository, issueNumber, message });
  const response = await fetchImpl(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.message || `GitHub API returned HTTP ${response.status}.`;
    throw new Error(`GitHub publication failed: ${detail}`);
  }
  return {
    id: String(data.id || ""),
    apiUrl: String(data.url || ""),
    htmlUrl: String(data.html_url || ""),
  };
}
