# Privacy model

Intent Commit treats the reflective workspace and the committed room as different trust domains.

## Private to the speaker

The reference client does not broadcast these fields to other room participants:

- raw draft;
- clarification text;
- Intent Card;
- private participant session token.

## Public inside a room

Room participants receive:

- display names and public participant ids;
- committed statements;
- commit timestamps;
- room name and room code.

## AI provider boundary

When `OPENAI_API_KEY` is configured, the server sends the current speaker's draft, clarification, and recent committed public context to the configured OpenAI model for reflection. Therefore "private" means private from other room participants, not invisible to the configured AI provider.

Without an API key, the deterministic demo reflector runs locally in the Node process.

## v0.2 session and storage limitations

Room sessions are bearer-style random tokens stored in the browser's local storage and in server memory. The SSE endpoint currently carries that token as a query parameter. Deployments should therefore use HTTPS and avoid request logging that records full query strings.

Rooms and committed messages are not persisted in v0.2. Restarting the process clears them.

## Future hardening

Production-oriented versions should add:

- authenticated accounts and revocable sessions;
- durable storage with explicit retention controls;
- encrypted transport and secure cookie/session options;
- database authorization checks;
- rate limiting and abuse controls;
- optional end-to-end or client-side privacy designs where compatible with AI reflection.
