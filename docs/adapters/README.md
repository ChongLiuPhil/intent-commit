# Adapters

Adapters connect Intent Commit's COMMITTED message envelope to external communication surfaces. They must not accept raw drafts, clarification text, Intent Cards, or unapproved reformulations as publishable input.

Current adapter:

- [`github-issues.md`](github-issues.md) — outbound GitHub Issue / Pull Request conversation comments.

A room-level commit and an external publication are separate consent events. An adapter should require explicit author approval for any audience expansion.
