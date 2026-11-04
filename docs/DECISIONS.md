# Decisions

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-04 | Focus DevPilot on Python backend repositories initially | Matches the product brief and keeps the MVP narrow and production-oriented |
| 2026-11-04 | Use a modular monolith architecture | Keeps the agent runtime inside the API module without creating extra service complexity early |
| 2026-11-04 | Use GitHub login and a GitHub App for auth and repo access | Supports user auth and repository-level webhooks and permissions |
| 2026-11-04 | Use static scanning as the default security model | Prevents execution of untrusted repo code on the host and fits the early product goals |
| 2026-11-04 | Use PostgreSQL as the primary data store | Suitable for repo metadata, events, and future audit or billing data |
| 2026-11-04 | Use Docker initially for the sandbox | Provides a practical first step for isolated verification while later hardening is still open |
| 2026-11-04 | Keep model provider integration behind a small interface | Preserves flexibility without premature abstraction |

## Open questions
- Billing provider: OPEN QUESTION
- Sandbox technology beyond Docker: OPEN QUESTION
- Hosting platform: OPEN QUESTION
- Final production hardening plan for untrusted repo analysis: OPEN QUESTION
- Long-term observability and worker architecture: OPEN QUESTION

## Notes
The decision log reflects the current product direction and intentionally leaves uncertain areas open rather than inventing requirements. Future architecture and delivery work should update this log as decisions are confirmed.
