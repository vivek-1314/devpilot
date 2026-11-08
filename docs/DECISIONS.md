# Decisions log

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-07 | Keep the project as a modular monolith with a frontend, API, and Python service package | This matches the existing code structure and keeps the repo small and reviewable |
| 2026-11-07 | Use FastAPI as the backend boundary | The repo already exposes the API through `services.api.main` and route modules |
| 2026-11-07 | Use Supabase for repo metadata, session state, and graph persistence | This keeps the product operational without introducing an additional service layer early |
| 2026-11-07 | Keep analysis static and file-based by default | The repository intentionally avoids executing untrusted code on the host |
| 2026-11-07 | Use GitHub App installation access to fetch repo tokens | This is the current pattern for repository access and cloning workflows |
| 2026-11-07 | Use graph-based repo indexing as the core intelligence layer | This supports symbol, import, and relationship understanding across a codebase |
| 2026-11-07 | Report findings as specific check results rather than blanket safety claims | This keeps analysis honest and aligned with the actual checks being run |

## Current implementation realities

The repo currently reflects the following decisions in code:
- authentication and repo authorization are handled in the API layer
- repo indexing and graph extraction happen in the Python service package
- static checks are run against temporary clones rather than the host filesystem
- quality and repo chat features are treated as part of the same intelligence layer

## Open questions
- final hosting platform
- final billing/usage model
- final sandbox strategy for any future automated execution
- long-term orchestration and queueing model

## Notes
The project remains intentionally conservative in architecture. The team should revisit this log whenever a decision becomes final or the implementation direction changes.
