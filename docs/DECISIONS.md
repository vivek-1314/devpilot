# Decisions log

## Decision log

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-11-04 | Keep the initial scope focused on repo intelligence and static analysis | This keeps the MVP reviewable and aligned with a real product need |
| 2026-11-04 | Use a Next.js frontend and FastAPI backend | This matches the current repo structure and keeps frontend and backend concerns clear |
| 2026-11-04 | Store repo metadata and graph results in Supabase | This gives the product a practical data layer without adding a separate service early |
| 2026-11-04 | Use a dedicated Python code-intelligence package | This isolates graph extraction, indexing, and imports from the web and API layers |
| 2026-11-04 | Prefer static analysis over runtime execution | This reduces risk when analyzing untrusted repository code |
| 2026-11-04 | Use GitHub App installation patterns for repo access | This fits the GitHub-connected repo intelligence architecture |
| 2026-11-04 | Keep findings phrased as check results, not absolute safety claims | This prevents overstating certainty when the analysis is limited to static data |

## Open questions
- final billing model
- final hosting platform
- sandbox and automated verification model
- long-term worker and event orchestration design

## Notes
The project remains intentionally conservative in architecture. The team should update this log whenever a choice becomes final or the repo direction changes.
