# Roadmap

## Milestone 1: Walking skeleton
Create the initial repository scaffold and the project boundaries for web, API, docs, and workflow placeholders.

Goals:
- confirm repo structure
- define product and engineering guardrails
- establish docs and project conventions

## Milestone 2: Scan a local repo (tree and imports)
Support analysis of a local repository and extract:
- file tree
- import relationships
- module-level structure

This is the first working representation of repo intelligence.

## Milestone 3: Graph view
Build a graph or tree-based view of repository relationships. This should show how modules connect and where the main project boundaries are.

Goals:
- improve understanding of repo structure
- support dependency and code relationship visualization

## Milestone 4: Stack detection and summary
Detect the repository's likely tech stack and generate a short summary of the project purpose.

Goals:
- identify Python frameworks, tooling, and runtime signals
- explain what the repo appears to do

## Milestone 5: Security and quality scan
Run static checks for quality and security, including:
- Ruff
- Bandit
- Gitleaks

The output should be reported as findings from the selected checks, without claiming the repo is safe or secure.

## Milestone 6: GitHub login and GitHub App
Integrate GitHub login for users and GitHub App support for repo access and webhook delivery.

Goals:
- authenticate users
- connect repositories securely
- subscribe to repo events

## Milestone 7: Pre-flight, webhooks, sandbox, and auto-fix
Deliver the operational automation layer:
- pre-flight checks for pull requests
- webhook-driven monitoring
- sandbox-based validation
- auto-fix flow for failed PR analysis

This is the phase that expands DevPilot from analysis into actionable PR support, with human approval required for final PR creation.

## Notes
- The roadmap intentionally follows the product direction in the README and AGENTS guidance.
- Uncertain implementation details remain OPEN QUESTION until confirmed.
- Later phases such as billing, observability, and VS Code extension remain out of scope for this roadmap stage.
