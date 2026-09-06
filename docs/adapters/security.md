# Adapter security rules

1. External adapters accept only protocol-valid COMMITTED message envelopes.
2. Room commitment does not imply consent to expand the audience.
3. External publication requires a separate explicit approval from the original human author.
4. Room owners and moderators cannot publish another person's committed message externally.
5. Provider credentials remain server-side and must not be embedded in browser code, logs, committed configuration, or protocol envelopes.
6. Every successful bridge should create an auditable local record containing the adapter, target, external URL, message id and publication time.
7. Duplicate publication of the same message to the same target should be rejected by default.
