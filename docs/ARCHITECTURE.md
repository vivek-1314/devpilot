# Architecture

## High-level architecture
DevPilot is structured as a modular monolith. The agent runtime lives inside the API layer rather than as a separate service.

### Components
- Web app: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- API service: Python, FastAPI
- Agent module: repository analysis and orchestration logic inside the API module boundary
- Scanners: Ruff, Bandit, Gitleaks
- Database: PostgreSQL
- GitHub App: repo access and webhook integration
- Sandbox: Docker initially, hardened later
- Model provider interface: small abstraction for LLM providers

## Communication model
- The web app calls the API for repository operations and user actions
- The API orchestrates repository analysis, graph building, and scan execution
- The agent module performs repo inspection and interpretation inside the API process boundary
- The GitHub App receives repo events and webhook payloads
- The API writes repo metadata and results to PostgreSQL
- Static analysis tools run in controlled execution paths; repository code is never run on the host

## Security boundaries
- Host environment is isolated from untrusted repository code
- Static analysis is preferred over dynamic execution in the early product scope
- Secrets and tokens are never logged or exposed
- The sandbox is required for any later automated verification or patch validation
- Permission boundaries should be explicit per repository and per user

## Data flow: scan a repository
1. User authenticates with GitHub
2. User selects or connects a repository
3. API receives the repository identifier and access context
4. Agent module clones or pulls the repository metadata into a controlled workspace
5. File tree is captured from the repository
6. Git and Tree-sitter are used to extract structure and relationships
7. Import and dependency analysis build the repo graph
8. Stack detection infers frameworks, build tooling, and runtime dependencies
9. Summary generation explains the repository purpose and likely responsibilities
10. Static scanners run quality and security checks
11. Findings are normalized into a report for API response and storage
12. Results are displayed in the web app and saved to the database

## Technology choices and reasons
### Web app: Next.js, TypeScript, Tailwind CSS, shadcn/ui
These tools provide a modern, maintainable frontend with good DX and a clear path for product UI work.

### API: Python, FastAPI
FastAPI is well suited for structured APIs, validation, and rapid service development in a Python-first product.

### Modular monolith
Keeping the agent runtime in the API module instead of a separate service reduces complexity early while still allowing future modular boundaries.

### Database: PostgreSQL
PostgreSQL is a strong fit for relational metadata, events, usage tracking, and future billing and audit data.

### GitHub App + GitHub login
GitHub App access is appropriate for repository-level permissions and webhook events, while GitHub login supports user authentication.

### Code intelligence: Git and Tree-sitter
These technologies are suitable for repository tree extraction, structural parsing, and import graph analysis without requiring full dynamic execution.

### Security scanners: Ruff, Bandit, Gitleaks
These scanners align with Python-focused static quality and security analysis and do not require running the target repository code.

### Sandbox: Docker initially
Docker is a practical initial sandbox technology for controlled verification and later hardening.

### Model provider abstraction
A small abstraction prevents vendor lock-in while keeping the interface simple and testable.

## Open questions
- Billing provider: OPEN QUESTION
- Hosting platform: OPEN QUESTION
- Sandbox technology beyond Docker: OPEN QUESTION
- Specific GitHub App permission model: OPEN QUESTION
