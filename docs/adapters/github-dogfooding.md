# GitHub dogfooding target

Repository issue `#1` is reserved for end-to-end testing of the v0.5 GitHub Issues adapter.

Expected path:

```text
private draft
→ reflection
→ author approval
→ COMMITTED room message
→ separate external-publication approval by the same author
→ GitHub Issue #1 comment
→ external publication audit record
```

The test target is intentionally public. Never use raw drafts, clarification text, Intent Cards, credentials, or other private reflective material when exercising this bridge.
