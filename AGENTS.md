# DevPilot Agent Guide

## Purpose
This repository is the codebase for DevPilot, a SaaS that analyzes GitHub repositories and provides repo intelligence, quality checks, and automation for pull requests.

## Product direction
- Product name: DevPilot
- Initial focus: Python backend repositories
- Web frontend: Next.js, TypeScript, Tailwind CSS, shadcn/ui
- API: Python, FastAPI
- Architecture: modular monolith. The agent runtime is a module inside services/api, not a separate service.
- Database: PostgreSQL
- Auth: GitHub login + GitHub App for repo access and webhooks
- Code intelligence: Git and Tree-sitter
- Static scanners: Ruff, Bandit, Gitleaks
- Sandbox: Docker initially, hardened later
- Model provider abstraction: one small interface
- Out of scope for now: Redis workers, observability, billing, VS Code extension

## Engineering principles
- Production-oriented, security-first, small testable modules
- Never run untrusted repository code on the host
- Scan repositories statically; never execute them outside the sandbox
- Never expose or log secrets or tokens
- Never claim tests passed unless they were actually executed
- Enforce per-user usage limits in the design
- Ask before destructive actions or major architectural changes
- Do not invent requirements; record unknowns as OPEN QUESTIONS

## Repository structure
```text
.
├── AGENTS.md
├── CLAUDE.md
├── README.md
├── .gitignore
├── apps/
│   └── web/
├── services/
│   └── api/
├── docs/
└── .github/
    └── workflows/
```

## Commands
If a command is not yet defined, mark it as TODO rather than guessing.

### Repository hygiene
- `git status` — check modified files
- `git add .` — stage all changes
- `git commit -m "..."` — commit work

### Project lifecycle
- `TODO: install dependencies for web app`
- `TODO: install dependencies for API service`
- `TODO: run web app locally`
- `TODO: run API locally`
- `TODO: run tests`
- `TODO: run linting`
- `TODO: run security scans`

### Documentation
- Use Markdown files in the root and docs directory
- Keep docs factual and scoped to current decisions
- Record unknowns as OPEN QUESTIONS

## Rules for contribution
- Work on one milestone at a time and stay within the scope of the request
- Do not install dependencies unless asked
- Do not invent cloud, billing, sandbox, or hosting providers
- Do not claim completion of tests, builds, or linting without executing them
- Add tests for new modules and show real test output before calling a task done
- Keep changes narrow and easy to review
- Prefer simple, explicit project structure over abstraction

## Security rules
- Treat all GitHub tokens, app credentials, and secrets as sensitive
- Avoid logging secrets, tokens, or environment values
- Do not execute cloned repositories on the host without explicit sandbox controls
- Prefer static scanning and metadata analysis over dynamic execution in early phases
- Word scan results as "no issues found by these checks", never "safe" or "secure"

## Open questions
- Billing provider: OPEN QUESTION
- Sandbox technology: OPEN QUESTION
- Hosting platform: OPEN QUESTION

## Style guidance
- Use clear headings in Markdown docs
- Prefer short, concrete statements over marketing language
- Keep TODOs visible when a decision cannot yet be made
- Separate product direction from implementation decisions

## Working conventions
- Keep each task scoped to explicit instructions
- Prefer a minimal, working implementation over speculative features
- Update this file when a new rule or command is agreed