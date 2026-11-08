# Security and risk model

## Threat model
This project analyzes GitHub repositories that may come from third parties or untrusted sources. The key risk is not that the host will execute arbitrary repo code, but that untrusted repository content may contain malicious patterns, secrets, or risky code that needs to be treated as hostile input.

## Current implementation posture
The repo is built around static analysis and metadata inspection rather than runtime execution:
- the web app validates the caller before allowing analysis
- the API enforces the internal key and repo ownership checks
- the repo indexing pipeline clones repos into a temporary directory and analyzes files without running the host app
- external static tools such as Ruff, Bandit, Gitleaks, and ESLint run in a throwaway clone

This is the current security posture and it is intentionally conservative.

## Security principles
- never execute untrusted repository code on the developer host
- prefer static analysis and AST-based inspection over dynamic execution
- treat GitHub tokens, app credentials, and repo secrets as sensitive material
- enforce repo access checks before indexing or scanning
- avoid making blanket claims such as "safe" or "secure" based on a limited set of checks

## Secret handling
- never commit `.env` files or secret values into source control
- never log tokens, GitHub credentials, or environment values
- keep secret configuration in local shell state or a managed secret store
- ensure local or deployment configuration does not leak into logs or error output

## GitHub App and repository access
The repo includes GitHub App integration patterns, but the project still expects this to be tightly scoped:
- installation access must be verified before analysis starts
- a user must be allowed to access a repo before the repo is indexed
- repository reads should be limited to the requested installation and user scope
- any future mutating or automated repository actions should require explicit approval

## Static checks and honest language
Findings should be reported as results from specific checks, for example:
- "No issues found by these checks"

This wording is preferred over:
- "Safe"
- "Secure"
- "No issues at all"

The repo explicitly avoids over-claiming because the checks remain limited to static analysis.

## Future safety expectations
Any future automation that executes or validates repository content should run in an isolated sandbox with:
- restricted network access
- no access to developer credentials
- no persistence of untrusted repo state on the host
- explicit timeout and resource bounds

## Open questions
- final sandbox technology and hardening model
- production hosting and secret-management approach
- production-grade observability and operational controls
