# GitHub REST API version

The v0.5 adapter sends `X-GitHub-Api-Version: 2026-03-10` and `Accept: application/vnd.github+json` when creating Issue comments. Keep this header centralized in the adapter package so future API-version changes do not leak into the core protocol.
