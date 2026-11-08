# Product overview

## Product vision
DevPilot is a repository intelligence product for GitHub-based codebases. Its current purpose is to help a user understand what a repository is doing, how its files and symbols are connected, and where likely quality or security issues appear before review.

## Primary users
- developers who need faster repository context
- engineering teams reviewing multiple repositories
- maintainers trying to understand a codebase without reading everything manually
- reviewers who want static repo signal before approval

## Current product scope
The project is intentionally narrow and practical. The implementation currently focuses on:
- repository indexing and graph extraction
- file, symbol, and import visibility
- GitHub repo connection and installation flow
- static quality and security scanning
- repo-level chat and repository guide generation

## Problems the repo is trying to solve
- repo structure is hard to understand without reading a large number of files
- dependency and import relationships are not obvious in large repos
- stack and project intent are often inferred manually
- security and quality issues can be missed during quick review
- repository context is useful before a PR is approved or merged

## Current implementation state
The codebase already includes:
- a Next.js dashboard shell
- a FastAPI backend with repo-scoped routes
- a Python indexing and graph pipeline
- repository access checks tied to user + installation ownership
- GitHub App token retrieval for repo access
- static scanners for Ruff, Bandit, Gitleaks, and ESLint
- a repo chat agent built on graph metadata

This means the project has moved beyond planning into a working MVP foundation.

## Product principles
- keep analysis static and safe by default
- keep the initial scope small and reviewable
- do not claim absolute safety from a limited number of checks
- make repo access and permissions explicit
- favor evidence-based repo intelligence over speculation

## Scope boundaries
The current implementation does not yet include:
- full PR automation
- sandbox execution for untrusted repos
- final production hosting and billing decisions
- large-scale multi-language expansion
- broad observability and operations tooling
