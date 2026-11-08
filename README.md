# DevPilot

DevPilot is a GitHub repository intelligence product currently focused on repo structure analysis, static security and quality checks, and repository conversation tools.

## Current project status
This repository is no longer a blank scaffold. It currently contains a working MVP foundation for:

- a Next.js dashboard in `web/`
- a FastAPI backend in `services/api/`
- a Python repository analysis package in `services/code_intelligence/`
- static quality and security scanners in `services/quality/`
- Supabase-backed metadata and graph persistence
- GitHub App token integration for repository access

This project is still intentionally narrow and focused on static analysis rather than autonomous mutation or execution.

## Product scope
### Current goals
- analyze a repository and extract file and symbol structure
- map import and symbol relationships in a graph
- identify likely code ownership and dependency patterns
- run static quality and security checks
- present repository intelligence through the dashboard
- support repo-level chat and guide generation from indexed data

### Current emphasis
- Python-first repo analysis
- GitHub-connected workflows
- static analysis over dynamic execution
- careful handling of tokens and repo access boundaries

### Deferred or open areas
- billing and usage controls
- observability and production operations
- worker orchestration and queueing
- full sandbox automation
- broader multi-language support

## Repository layout
- `web/` — Next.js frontend and dashboard UI
- `services/api/` — FastAPI service with repo-scoped routes
- `services/code_intelligence/` — graph extraction and indexing logic
- `services/quality/` — static security and lint checks
- `docs/` — architecture, setup, product, and policy docs
- `docker-compose.yml` — local infrastructure scaffold

## Architecture in one sentence
The web app calls the FastAPI backend, the backend checks repo access, and the Python service indexes repository files and returns graph and scan results through the dashboard.

## Local setup
See the setup guide in `docs/SETUP.md` for the current local workflow.

## Environment and configuration
The repo expects a small set of runtime environment values, including:

- `INTERNAL_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_PRIVATE_KEY_PATH`
- additional provider-specific values used by repo scanning or chat features

Do not commit secrets or tokens to the repo. Keep them in local env files or a secure secret store.

## Security posture
The project intentionally avoids executing untrusted repository code on the host. The service clones repos into temporary directories and performs static checks and file inspection instead of running app code.

## Documentation map
- `docs/ARCHITECTURE.md` — current system architecture
- `docs/SETUP.md` — local setup and configuration notes
- `docs/PRODUCT.md` — current feature and scope summary
- `docs/SECURITY.md` — security posture and risk model
- `docs/ROADMAP.md` — delivery status and future work
- `docs/DECISIONS.md` — architecture and product decisions

## Notes
- The repo currently reflects a working MVP foundation rather than a complete SaaS rollout.
- The implementation is real, but several production and operational decisions remain open.
