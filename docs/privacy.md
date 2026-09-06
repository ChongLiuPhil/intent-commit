# Privacy Model — MVP

The reference client uses a privacy-by-default split.

## Public

Only committed statements are stored in the browser's public conversation history.

## Private

The current draft, agent interpretation, and clarification remain in the active browser UI and are not added to the public conversation history.

When `OPENAI_API_KEY` is configured, the draft, clarification, and a small window of already-public conversation context are sent from the server to the configured OpenAI model to perform reflection. The API key remains server-side.

When no API key is configured, the app runs a deterministic demo reflector and does not call an external AI service.

## Non-goals of v0.1

This MVP does not provide accounts, end-to-end encryption, multi-device sync, remote persistence, or private multi-user networking. Do not deploy it as a confidential production messenger without adding an appropriate security architecture.
