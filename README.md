# DevPilot

## Product summary
DevPilot is a SaaS product that connects to a developer's GitHub repositories and builds a graph/tree view of the codebase. It detects the repository's tech stack, explains what the project does, scans for code quality and security issues, runs pre-flight checks on pull requests, monitors PR merges and CI failures via webhooks, and provides deeper repo-health analysis.

## Vision
Initial focus is on Python backend repositories. The product aims to help engineering teams understand repository health, detect risks early, and assist with PR validation and remediation.

## Tiers
### Free
- Connect a repository
- File tree and dependency graph
- Detected tech stack
- AI summary of repository purpose
- Basic quality and secret scanning

### Paid
- Webhooks
- PR monitoring
- Pre-flight checks
- CI failure tracking
- Repo health insights
- Event history

### Top tier
- Failed-PR analysis
- Patch generation
- Sandbox verification
- PR creation with human approval

## Stack direction
- Web: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- API: Python, FastAPI
- Database: PostgreSQL
- Auth: GitHub login and GitHub App for repo access and webhooks
- Code intelligence: Git and Tree-sitter
- Static scanners: Ruff, Bandit, Gitleaks
- Sandbox: Docker initially, hardened later
- Model provider abstraction: provider-agnostic interface

## Current status
This repository is the initial scaffold for the project. No application code, dependencies, or runtime setup has been created yet.

## How to run
TODO: define local development commands for web app and API service after the project scaffold is expanded.

## Notes
- Billing provider: OPEN QUESTION
- Sandbox technology: OPEN QUESTION
- Hosting: OPEN QUESTION
- Later phases such as Redis workers, observability, billing, and VS Code extension are intentionally deferred.
