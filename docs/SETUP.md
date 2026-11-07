# Local setup guide

This guide explains the minimum steps needed to run the project locally and connect the web app, API gateway, and repo-intelligence service.

## Repository layout

- `web/` — Next.js app and dashboard UI
- `services/api/` — FastAPI gateway
- `services/code_intelligence/` — repo graph and static-analysis package
- `docker-compose.yml` — local infrastructure scaffolding

## Required tools

- Python 3.11+
- Node.js 18+
- npm
- Git
- a local Supabase project or configured Supabase environment

## Python service setup

From the repo root:

```bash
cd services/code_intelligence
python3 -m venv .venv
. .venv/bin/activate
pip install -e .
```

This installs the package defined in `services/code_intelligence/pyproject.toml`.

## API gateway setup

From the repo root:

```bash
cd services/api
. ../code_intelligence/.venv/bin/activate
uvicorn gateway.main:app --host 0.0.0.0 --port 8000 --reload
```

The main app is defined in `services/api/gateway/main.py` and exposes the health route and repo-intelligence router.

## Web application setup

From the repo root:

```bash
cd web
npm install
npm run dev
```

The Next.js app will expect the relevant environment variables to be present before it can authenticate against Supabase and route to the API service.

## Required environment variables

At minimum, configure the following values locally:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INTERNAL_API_KEY`
- `CODE_INTEL_API_URL`
- GitHub App values such as `GITHUB_APP_ID`, `GITHUB_APP_CLIENT_ID`, and the private key config

Store these in a local environment file or shell environment and do not commit them to the repository.

## Recommended local workflow

1. start Supabase or ensure your project is available
2. set the required environment variables in the terminal or local env files
3. activate the Python environment and start the API gateway
4. run the Next.js app
5. sign in and connect a repository from the dashboard
6. trigger indexing through the code-intelligence flow

## Verification checks

To confirm that the API is up:

```bash
curl http://127.0.0.1:8000/health
```

This should return a JSON object with `ok: true` if the service is running correctly.

## Notes

- this project currently emphasizes static analysis and graph extraction over dynamic execution
- future automation and sandboxed verification should remain isolated from the host machine
- all secrets and tokens should stay out of source control and out of logs
