# Product overview

## Product vision
DevPilot is a repository intelligence product for GitHub repos. It gives engineering teams a clearer view of what a codebase does, how it is structured, where the risk areas live, and whether a PR is likely to introduce issues before merge.

## Primary users
- independent developers maintaining their own backend projects
- small teams with several repos and shared review cycles
- maintainers who need an at-a-glance repo summary before reading code deeply
- reviewers who want better pre-merge signal without manual repo exploration

## Current product focus
The active product scope is intentionally narrow and practical:

- repo indexing and graph extraction
- file and symbol visibility
- static import relationship mapping
- GitHub repo connection and installation flow
- security and quality reporting in a dashboard

## Problems addressed
- repo structure is hard to understand without reading many files
- module and dependency relationships are not obvious in large repos
- stack and project intent are often inferred manually
- code quality and security issues can be missed during quick review
- PR review benefits from repository context and static signal

## Milestone status
The current repo already includes:
- dashboard pages and project shell
- an API gateway for repository intelligence requests
- a Python graph/indexing package
- repo metadata integration through Supabase
- GitHub App installation plumbing

This means the product has moved past pure planning into an initial implementation stage.

## Product principles
- prioritize static, secure analysis over dynamic execution
- keep the initial scope small and reviewable
- avoid broad claims like "safe" or "secure" based on limited checks
- make repo permissions and usage boundaries explicit
- favor clarity and operational safety over speculative automation
