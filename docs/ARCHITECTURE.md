# Architecture

## Overview
DevPilot is organized around a simple flow: authenticate a user, connect a repository, analyze the repo structure, and surface findings in a dashboard. The current codebase already reflects that split across the web app, API gateway, and Python graph/indexing module.

## System components
### Web application
Location: `web/`

This is the product frontend. It includes:
- dashboard screens for overview, repos, pull requests, code intelligence, and settings
- Supabase auth sessions and middleware
- GitHub OAuth and installation flows
- API route proxies that validate the current user and call the analysis service

### API gateway
Location: `services/api/gateway/`

This is the boundary that the frontend talks to. The current gateway exposes a `health` endpoint and a `code-intelligence` router with:
- `POST /code-intelligence/repos/{repo_id}/index`
- `GET /code-intelligence/repos/{repo_id}/graph`

The gateway also enforces a shared internal service key before allowing requests.

### Code intelligence package
Location: `services/code_intelligence/`

This module is responsible for repository indexing and graph extraction. It includes:
- `app/graph/walker.py` for repository discovery and file enumeration
- `app/graph/extractor.py` for AST-based symbol extraction
- `app/graph/imports.py` for import and call-edge detection
- `app/graph/indexer.py` for graph persistence to Supabase
- `app/integrations/clone.py` and `app/integrations/github.py` for repository access and install token flows
- `app/db.py` for the Supabase client and data access layer

### Data layer
The code intelligence and web layers are backed by Supabase for:
- user auth
- repository metadata
- installation state
- findings and scan results
- code graph storage (`code_nodes`, `code_edges`, repository records)

## Data flow
1. A user signs in through the web app using Supabase auth.
2. The web app verifies that the repo belongs to the current user or installation.
3. The frontend calls the internal API route at `web/app/api/code-intelligence/route.ts`.
4. The API route validates the repository and calls the FastAPI service with the internal key.
5. The FastAPI gateway receives the request and calls the repo indexing or graph-loading flow.
6. The Python service clones or accesses the repo, walks the files, and extracts relationships.
7. Symbol and import data are normalized into a graph.
8. Results are saved as nodes and edges in the database.
9. The dashboard renders the indexed repo graph and repository summary data.

## Why this structure
This project favors a small, explicit architecture:

- the web app stays focused on UX and user flow
- the API gateway remains thin and authorization-aware
- the graph engine is isolated in a Python package with clear responsibilities
- Supabase handles storage and auth without introducing extra service complexity

## Security boundaries
- repository code is not executed directly on the host during the current static-analysis flow
- credentials are not committed to the repo
- internal service calls use a shared key rather than broad public endpoints
- GitHub App and repo access remain governed by explicit installation and user checks

## Open questions
- final production hosting model
- sandbox technology beyond the current static-analysis approach
- webhook and PR automation scope
- final billing and usage model
