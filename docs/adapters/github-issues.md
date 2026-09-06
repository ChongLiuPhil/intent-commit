# GitHub Issues adapter

Intent Commit v0.5 includes an outbound GitHub Issues adapter. Its purpose is narrow: publish an already committed human statement as an Issue or Pull Request conversation comment.

## Consent boundary

A room commit is **not** automatically consent to publish outside the room. The server requires a second explicit external-publication approval and verifies that the authenticated user is the original author of the committed message. Owners and moderators cannot export another person's statement.

## Server configuration

Set a server-side token only:

```env
GITHUB_TOKEN=...
```

Do not expose the token to browser JavaScript or commit it to Git. For a fine-grained token, GitHub documents the create-comment endpoint as requiring repository `Issues: write` or `Pull requests: write`, depending on the target.

## Endpoint

```text
POST /api/rooms/:code/adapters/github/issues/:issueNumber/publish
```

Body:

```json
{
  "repository": "owner/repo",
  "messageId": "committed-message-id",
  "approved": true
}
```

The server loads the message from persistent room history, verifies authorship and COMMITTED state, posts it using GitHub's REST create-issue-comment endpoint, and records the external URL in the local audit log.

## Audit

```text
GET /api/rooms/:code/exports
```

Room members can inspect which committed messages have been bridged and where. Raw drafts, Intent Cards and clarifications never enter the adapter.
