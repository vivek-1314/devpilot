# Roadmap

## Current state
The repo has already progressed beyond the initial walking skeleton. The active implementation includes:

- a dashboard UI in the web app
- a FastAPI gateway with code intelligence routes
- a Python graph/indexing engine for repo analysis
- Supabase-backed auth and metadata workflows
- GitHub App installation plumbing

## Milestone 1: repo foundation and structure
Status: complete

Completed work:
- web app scaffold and dashboard shell
- API gateway and route structure
- code-intelligence package layout
- docs and project guardrails

## Milestone 2: repository indexing and graph extraction
Status: in progress

Goal:
- walk a repo and enumerate files
- extract imports and symbol relationships
- persist graph data for a repo and return it through the API

The repo already includes the core graph indexing flow and the `code_nodes` / `code_edges` model pattern.

## Milestone 3: repo intelligence dashboard
Status: in progress

Goal:
- show repository health and analysis state
- wire repo metadata to the dashboard
- expose API-driven graph and findings data in the UI

## Milestone 4: static security and quality checks
Status: planned

Planned checks may include:
- Ruff
- Bandit
- Gitleaks

This should remain a static-analysis layer and should never be communicated as a guarantee of safety.

## Milestone 5: GitHub integration cleanup and production hardening
Status: planned

Goal:
- finalize installation and repo linking flows
- define explicit permission boundaries
- tighten the environment and secret handling process

## Milestone 6: PR automation and review support
Status: planned

Goal:
- pre-flight checks for PRs
- webhook-based monitoring
- repo event awareness
- human approval gates for automation

## Milestone 7: sandbox and verification
Status: deferred

This stage is intentionally later and should only happen once the static-analysis foundation is stable and the security boundaries are explicit.

## Notes
- the roadmap is intentionally scoped to the current repo and implementation state
- open questions still remain around hosting, billing, and sandbox design
- multi-language support and full autonomous PR repair remain out of scope for the current milestone set
