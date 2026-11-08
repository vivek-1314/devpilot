# Local setup guide

This repo is still in an active MVP state, so the setup is intentionally lightweight and environment-driven. The current implementation does not yet include a single canonical Python packaging manifest for the backend, so setup is based on local environment configuration and the code as it exists in the repo.

## Repository layout

- `web/` — Next.js app and dashboard UI
- `services/api/` — FastAPI app and routes
- `services/code_intelligence/` — repo graph, indexing, and static analysis logic
- `services/quality/` — static lint + security scanners
- `services/db.py` — Supabase client helper
- `docker-compose.yml` — infrastructure scaffold

## Required tools

- Python 3.11+
- Node.js 18+
- npm
- Git
- a Supabase project / credentials
- GitHub App credentials for repository access flows

## Python backend setup

The project does not currently include a checked-in `requirements.txt` or `pyproject.toml` for the backend, so the environment is still expected to be created locally.

Typical local flow:

```bash
cd /path/to/pr1
python3 -m venv .venv
. .venv/bin/activate
pip install fastapi uvicorn python-dotenv supabase httpx tree_sitter tree_sitter_typescript langchain-groq langgraph langchain-core python-jose PyJWT
```

Then run the API from the repo root:

```bash
cd /path/to/pr1
PYTHONPATH=. uvicorn services.api.main:app --host 0.0.0.0 --port 8000 --reload
```

The app entrypoint is `services.api.main:app`, not a nested `gateway.main` module.

## Web app setup

```bash
cd /path/to/pr1/web
npm install
npm run dev
```

The web app expects the relevant environment variables to already be configured before auth and repo flows can work.

## Required environment variables

At minimum, set the following variables before running the app locally:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`
- `INTERNAL_API_KEY`
- `CODE_INTEL_API_URL`
- `GITHUB_APP_ID`
- `GITHUB_APP_CLIENT_ID`
- `GITHUB_APP_PRIVATE_KEY_PATH`
- Any additional GitHub or Groq-related variables used by the repo

Do not commit secrets to source control. Keep them in a local `.env`, shell environment, or a secret manager.

## Recommended local workflow

1. Start or connect a Supabase project.
2. Export the required environment variables.
3. Activate the Python environment.
4. Start the FastAPI backend.
5. Start the Next.js frontend.
6. Sign in and connect a repository from the dashboard.
7. Trigger repo indexing or a quality scan.

## Verification checks

To confirm the backend is running:

```bash
curl http://127.0.0.1:8000/health
```

This should return a JSON payload with `{"ok": true}` if the service is up.

## Notes

- The repo currently emphasizes static analysis over dynamic execution.
- Repository code is cloned into a temporary directory for analysis and scans; it is not executed on the host machine.
- The setup is intentionally flexible because the project is still evolving and not yet standardized around a single packaging model.
- Future automation should remain isolated from the host system and local secrets.
