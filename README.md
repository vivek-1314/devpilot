# DevPilot

DevPilot is a repository intelligence platform for GitHub codebases. It helps developers understand repository structure, surface risky or low-quality areas, and prepare pull requests for review with clearer, more actionable signal.

## Current project status
This repository is not a blank scaffold anymore. It contains the working foundations for the product:

- a Next.js dashboard in `web/`
- a FastAPI gateway in `services/api/`
- a Python repository-analysis package in `services/code_intelligence/`
- Supabase integration for authentication, metadata, and repo state
- GitHub App support for installation and repo access flows
- a graph-based indexing pipeline for files, imports, and symbol relationships

The system is still intentionally narrow and production-oriented. The current focus is on static repository analysis rather than autonomous repository mutation.

## Product scope
### Core goals
- analyze a repository and extract file-level structure
- map import and symbol relationships in a graph
- detect likely technology stack and project intent
- run static quality and security checks
- present results in a dashboard for users and repos

### Current emphasis
- Python-first repo analysis
- GitHub-connected workflows
- static intelligence over dynamic execution
- secure handling of repo access and secret material

### Deferred or open areas
- billing
- observability
- worker orchestration
- broad multi-language support
- sandbox hardening and autonomous patching

## Repository layout
- `web/` — Next.js app and dashboard UI
- `services/api/` — FastAPI gateway, auth-facing routes, service integration layer
- `services/code_intelligence/` — repository graph indexing, AST extraction, and scanning logic
- `docs/` — architecture, setup, product, and policy docs
- `docker-compose.yml` — infrastructure scaffolding

## Architecture in one sentence
The web app calls the API gateway, the API asks the code-intelligence service to index a repo, and the analysis results are persisted in Supabase and returned through the dashboard.

## Local setup
See the setup guide in `docs/SETUP.md` for environment variables and the recommended local workflow.

### Quick start summary
1. install the Python package for repo analysis
2. start the API gateway
3. start the web app
4. configure the required environment variables in local env files
5. use the dashboard to connect a repo and trigger indexing

## Environment and configuration
The system expects a small set of environment values, including:

- `INTERNAL_API_KEY` between the web layer and the API service
- `CODE_INTEL_API_URL` for the web app to reach the gateway
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- GitHub App configuration values such as `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, and the private key path or PEM payload

Do not commit secrets or tokens to the repo. Keep them in local env files or a secure secret store.

## Security posture
The project intentionally avoids executing untrusted repository code on the host. The product focuses on static analysis and metadata extraction. Findings should be reported as results from selected checks, not as a blanket claim that a repo is secure.

## Documentation map
- `docs/ARCHITECTURE.md` — current system architecture
- `docs/SETUP.md` — local setup and configuration
- `docs/SECURITY.md` — security posture and risk model
- `docs/ROADMAP.md` — delivery plan and milestone status
- `docs/DECISIONS.md` — architecture and product decisions

## Notes
- The repo currently reflects a working MVP foundation rather than a complete SaaS rollout.
- Unknown platform and billing decisions remain intentionally open until they are confirmed.
