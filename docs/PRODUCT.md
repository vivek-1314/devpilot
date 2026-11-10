# Product

## One-line product definition
DevPilot is a GitHub repository intelligence SaaS that helps teams understand codebases faster and catch quality/security issues before pull request merge.

## Use case as a business study
### Problem
Engineering teams lose time during review because:
- codebase context is fragmented
- ownership and file relationships are unclear
- security/quality checks are not always centralized early

### Target users
- solo developers maintaining multiple repos
- startup teams with fast release cycles
- engineering managers who want repository health signals
- reviewers who need faster technical context before approval

### Value proposition
DevPilot combines repository structure intelligence and scanner outputs in one workflow:
- graph-style code understanding
- static quality/security checks
- repository-level AI support for navigation and explanation

This reduces review friction and increases confidence in decision-making.

## Current product scope (what exists now)
- GitHub App based repository connection flow
- repository indexing and graph extraction pipeline
- static scanning (Ruff, Bandit, Gitleaks, ESLint)
- dashboard pages for repository and analysis workflows
- API and access control for repo-scoped actions

## SaaS direction and future
### SaaS model direction
- multi-tenant workspace model
- per-user and per-repository usage limits
- team plans based on scan/index volume

### Product moat (defensible advantage)
- repository graph context + scanner data in one product
- workflow integration with GitHub installation permissions
- faster onboarding to unknown repositories using generated repo intelligence
- long-term opportunity to build historical quality trends and PR risk scoring

### Future opportunities
- pull request assistant with risk summary
- compliance-oriented policy packs (security baseline checks)
- deeper code ownership and knowledge graph analytics
- org-wide quality posture dashboard

## Tech stack (brief)
- frontend: Next.js + TypeScript + Tailwind
- backend API: FastAPI
- analysis services: Python
- data: Supabase/PostgreSQL
- local deployment: Docker Compose

## Current stage
This is an MVP with real working parts and a clear SaaS direction. For a solo college project, the scope and execution are strong.
