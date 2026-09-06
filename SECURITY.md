# Security

This repository is a research MVP, not a production confidential messenger.

## Important limitations

- committed messages are stored in browser localStorage;
- no authentication or authorization layer exists;
- no end-to-end encryption exists;
- no database or multi-user network transport exists;
- when an AI provider is configured, private drafts are transmitted to that provider through the server-side adapter.

Do not deploy this MVP for sensitive communications without an appropriate threat model, access controls, secure persistence, encryption, abuse protections, and provider-specific privacy review.
