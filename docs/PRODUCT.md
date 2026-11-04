# Product

## Vision
DevPilot is a SaaS that connects to a developer's GitHub repositories and builds a graph/tree view of the codebase. It helps developers understand what a repo does, what technologies it uses, where the risky areas are, and whether a pull request is ready to merge.

The initial focus is Python backend repositories. The product is designed for developers and small engineering teams who want repository intelligence without needing to read every file manually.

## Target users
- Solo developers maintaining their own Python backend projects
- Small teams with multiple services and shared repositories
- Engineers who want a quick understanding of repo structure and health
- Teams that want lightweight PR validation and risk detection before merge

## Problems solved
- Repos are hard to understand without reading a large number of files
- Dependency and import relationships are not obvious in large repos
- Tech stack detection is manual and error-prone
- Security and code quality issues may be missed during review
- Pull requests can merge with avoidable CI or quality failures
- Teams need a fast, structured summary of what a repo is doing

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

## Core workflows
### 1. Analyze a repository
The user connects a repo or imports a local repo. DevPilot inspects the repository tree, parses imports and relationships, and extracts the detected stack.

### 2. Summarize repository intent
The platform produces a concise explanation of what the project appears to do based on the repository structure, dependencies, and code signals.

### 3. Run static quality and security checks
DevPilot runs static checks such as Ruff, Bandit, and Gitleaks to surface issues without executing the repository code.

### 4. Validate pull requests
Before merge, DevPilot can run a pre-flight check for likely issues and surface CI or repo health concerns.

### 5. Monitor repo events
For paid plans, the system tracks PR lifecycle events, CI statuses, and merge-related signals via webhooks.

### 6. Repair and verify in advanced tiers
Advanced flows focus on failed PR analysis, patch generation, sandbox verification, and creation of a follow-up PR for human approval.

## MVP scope
The MVP is intentionally narrow and production-oriented:
- scan a repo
- show the file tree
- show a dependency/import graph
- detect the tech stack
- summarize the repo
- run quality and security scanning

This MVP does not include final billing, full autonomous repair, or broad multi-language support. Those remain later phases.

## Product principles
- Production-oriented and security-first
- Static analysis only for early scanning
- No execution of untrusted repo code on the host
- Findings are worded as "no issues found by these checks" rather than "safe"
- Keep usage limits and permissions explicit
- Keep unknowns as OPEN QUESTION until confirmed
