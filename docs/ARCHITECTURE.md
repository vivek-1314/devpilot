# Architecture

## Overview
DevPilot is currently a Python-first repository intelligence platform with a Next.js frontend and a FastAPI backend. The codebase is organized around a simple pattern: authenticate the caller, check repo access, analyze the repository statically, and surface the result through the dashboard.

This repo is not yet a fully productionized SaaS, but the core building blocks are already in place.

## Actual repository structure

### Web app
Location: `web/`

The frontend includes:
- dashboard screens and page templates under `web/app/dashboard/`
- GitHub OAuth and install/setup routes under `web/app/api/github/`
- Supabase auth/session helpers under `web/lib/supabase/`
- dashboard UI and styling under `web/app/...` and `web/components/`

### API service
Location: `services/api/`

The backend is a FastAPI service, not a nested gateway package. The main app is defined in:
- `services/api/main.py`

Route modules live in:
- `services/api/routes/code_intelligence_route.py`
- `services/api/routes/quality_route.py`

Cross-cutting auth and authorization logic lives in:
- `services/api/security.py`
- `services/api/access.py`

### Repository intelligence package
Location: `services/code_intelligence/`

This package is responsible for repo indexing and graph extraction. It contains:
- `graph/walker.py` — file discovery and repo scanning
- `graph/extractor.py` — symbol extraction
- `graph/imports.py` — import and call relationship extraction
- `graph/indexer.py` — save graph nodes/edges into Supabase
- `graph/docs.py` — repo guide generation and cached doc sections
- `integrations/clone.py` — temporary clone flow for analysis
- `integrations/github.py` — GitHub App token fetching
- `pipeline.py` — orchestration for indexing and graph saving
- `chat.py` — repo chat / AI agent layer

### Quality and scanning layer
Location: `services/quality/`

This package runs various static checks against a cloned repo via external tools:
- `ruff.py`
- `bandit.py`
- `gitleaks.py`
- `eslint.py`
- `shared.py`

### Data layer
The project currently uses Supabase as the persistence layer for:
- user/session metadata
- repo records
- installation membership
- indexed graph nodes and edges
- repo docs cache

The DB wrapper is in:
- `services/db.py`

## Runtime flow

1. A user signs in via the web app.
2. The frontend calls an internal route with the user context and internal API key.
3. The API validates the request and checks repo ownership using `owned_repo` and `current_user_id`.
4. The repo intelligence pipeline loads the repo and clones it using the installation token.
5. The graph engine walks files, extracts symbols and imports, and saves graph data.
6. Static quality tools can run against the cloned repository and return finding objects.
7. The dashboard displays repo metadata, graph data, and analysis results.

## Current architecture choices

The current design intentionally keeps boundaries clear:
- web app handles UI and user flow
- FastAPI backend handles validation and repo-scoped requests
- Python service handles indexing and static inspection
- Supabase stores repo state and graph data
- GitHub App access is used to fetch installation tokens

This is a modular monolith, not a microservice split.

## Security and safety boundaries

The implemented architecture follows a static-analysis-first model:
- repo contents are read from a temporary clone
- repo code is not executed on the developer host
- sensitive values are expected to live in environment variables or secret stores
- access checks happen before analysis or scans are allowed

## Current maturity level

The code is best described as a working MVP foundation:
- repo graph analysis is implemented
- API routes are implemented
- quality scans are implemented
- repo chat is implemented
- production hardening and orchestration remain future work

## Open questions
- final hosting platform
- final sandbox model for any future automated verification
- final billing and usage boundaries
- production observability and deployment pattern
