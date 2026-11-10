# Architecture

## Current system summary
DevPilot is a full-stack project with:
- Next.js frontend in `web/`
- FastAPI API layer in `services/api/`
- Python analysis services in `services/code_intelligence/` and `services/quality/`
- Supabase as the main data store
- Docker Compose for local multi-service runtime

The current shape is a modular monolith with service-style folders, which is a strong structure for an MVP.

## Repository structure (current)
```text
.
|- docker-compose.yml
|- env.docker
|- services/
|  |- api/
|  |  |- main.py
|  |  |- access.py
|  |  |- security.py
|  |  |- routes/
|  |     |- code_intelligence_route.py
|  |     |- quality_route.py
|  |     |- repos_route.py
|  |     |- webhooks_route.py
|  |- code_intelligence/
|  |  |- main.py
|  |  |- pipeline.py
|  |  |- chat.py
|  |  |- graph/
|  |  |- integrations/
|  |- quality/
|  |  |- main.py
|  |  |- router.py
|  |  |- ruff.py
|  |  |- bandit.py
|  |  |- gitleaks.py
|  |  |- eslint.py
|  |- common/
|  |  |- db.py
|  |  |- github.py
|- web/
|  |- app/
|  |  |- api/
|  |  |- dashboard/
|  |- components/
|  |- lib/
|  |- public/
|- docs/
	|- ARCHITECTURE.md
	|- PRODUCT.md
	|- SECURITY.md
	|- .gitkeep
```

## Docker usage in this project
Docker is used to run the system as separate local services:
- API service container
- Code intelligence service container
- Quality scanner service container
- PostgreSQL (from `docker-compose.yml`)

The folder design supports this by giving each Python service its own `main.py` and, where needed, its own `Dockerfile` and requirements.

## Runtime request flow
1. User interacts with the Next.js dashboard.
2. Next.js API routes call backend endpoints.
3. API layer validates auth context and repository access.
4. API routes forward work to code intelligence or quality modules.
5. Services clone repo content (with GitHub App credentials), run static analysis, and store/read results from Supabase.
6. UI renders findings, graph context, and repo insights.

## What is good about your current structure
- Clear separation between UI, API, and analysis logic.
- Good service boundaries for future scaling.
- Security checks are placed near API entry points.
- Docs, product, and security concerns are now separated cleanly.

## Gaps to improve later
- Shared config validation and typed settings across all services.
- Stronger error consistency between service responses and frontend messages.
- Additional tests around route contracts and scanner edge cases.

Overall, this is a very good architecture for a solo college MVP that can grow into a SaaS.
