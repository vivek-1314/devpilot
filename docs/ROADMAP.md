# Roadmap

## Current state
The repo is beyond a simple scaffold and is currently a working MVP foundation for repository intelligence. The codebase includes a web app, a FastAPI backend, a graph-based repo indexing engine, GitHub App access hooks, and a static quality scanning layer.

## Milestone 1: repo foundation and structure
Status: complete

Completed work:
- Next.js dashboard shell and route structure
- FastAPI backend and route modules
- Python-based repo intelligence package layout
- docs and project guardrails

## Milestone 2: repo indexing and graph extraction
Status: complete in foundation form

Completed work:
- repo file walking
- symbol extraction for JS/TS files
- import and call-edge extraction
- persistence of graph nodes and edges
- graph loading for API responses

This is the core repo intelligence foundation.

## Milestone 3: repo intelligence dashboard and API wiring
Status: in progress / partially complete

Completed work:
- web dashboard scaffolding
- repo ownership and user validation
- API calls for indexing and graph retrieval
- database-backed repo metadata flow

Remaining work:
- finalize end-to-end dashboard wiring for all repo states
- tighten UI handling of scan and graph results

## Milestone 4: static quality and security checks
Status: implemented in the service layer

Included checks:
- Ruff
- Bandit
- Gitleaks
- ESLint

These checks are exposed through API routes and operate on cloned repos in a controlled environment.

## Milestone 5: repo chat and guide generation
Status: implemented in foundation form

Included pieces:
- repo graph-based agent tooling
- file and symbol search
- static repo guide generation via facts and cached sections

This is useful but still not a fully hardened product-grade assistant.

## Milestone 6: production hardening and operations
Status: planned

Planned work:
- final deployment model
- observability and error handling
- stronger environment and secret management
- clearer production limits for repo analysis jobs

## Milestone 7: sandbox and verifier automation
Status: planned / deferred

This is intentionally later. The project should not move into automated repo execution until the safety boundaries and sandbox model are explicit.

## Milestone 8: PR automation and review support
Status: planned

Planned work:
- PR event awareness
- review signal summarization
- human approval gates before automation

## Notes
- The current repo is a meaningful MVP foundation, not a complete SaaS product.
- The project still has open questions around hosting, billing, and sandboxing.
- Multi-language support and broader automation remain intentionally out of scope until the security model is settled.
