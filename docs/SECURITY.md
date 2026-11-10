# Security

## Security objective
Protect user data, GitHub credentials, and repository confidentiality while running only controlled static analysis workflows.

## Current security posture
DevPilot currently follows a static-analysis-first model:
- user and repo-scoped access checks are enforced before analysis routes
- repository content is cloned to temporary working locations for analysis
- scanners run on repository files, not by executing repository applications
- tokens and secrets are expected through environment configuration

This is appropriate for an MVP and reduces major early-stage risk.

## Key controls in current design
### Access control
- API requests include internal auth validation and user context checks
- repository ownership/installation checks gate scan and indexing operations

### Secret handling
- GitHub App credentials and API keys are treated as sensitive
- secrets should never be hardcoded or committed
- logs should avoid token or credential leakage

### Analysis boundaries
- prefer static parsing and tool-based scanning
- do not run untrusted repository runtime code on host machine
- keep analysis temporary and scoped to explicit user requests

## Docker and isolation view
Current local architecture uses Docker-based service separation. This provides basic process isolation between API, quality, and code-intelligence modules.

For future SaaS hardening, isolation should be expanded with:
- locked-down container permissions
- resource limits (CPU/memory/time)
- restricted egress where possible
- short-lived workspaces for repo analysis

## Security reporting language
Use precise language in outputs:
- preferred: "No issues found by these checks."
- avoid: "This repository is secure."

Reason: scanner coverage is limited and should not be presented as absolute assurance.

## Security roadmap (next practical steps)
1. Centralize config validation for all security-sensitive env vars.
2. Add audit-safe logging rules (mask tokens, redact secrets).
3. Add stricter request rate and usage limits per user/repository.
4. Introduce hardened sandbox execution boundaries for future advanced analysis.
5. Add security-focused tests for access-control paths.

## Risk status for a college MVP
The current setup is solid for a student-built MVP and demonstrates good security thinking. The next level is hardening and operational guardrails for production SaaS scale.
