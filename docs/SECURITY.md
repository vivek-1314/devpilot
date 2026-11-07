# Security and risk model

## Threat model
This project analyzes repositories that may originate from third parties or untrusted sources. The primary risk is not that a repo will be executed on the developer workstation, but that code from an arbitrary repo may contain malicious or unsafe patterns that should be treated as untrusted inputs.

## Security principles
- never execute untrusted repository code on the host machine
- prefer static analysis, metadata extraction, and AST-based inspection over runtime execution
- treat GitHub tokens, app credentials, and repo secrets as sensitive material
- keep repo access boundaries explicit and user-scoped
- avoid making blanket claims such as "safe" or "secure" based on a limited set of checks

## Current implementation posture
The current repo uses a static-analysis-first design:

- the web app validates user access before calling backend services
- the API gateway enforces a shared internal service key
- the graph/indexing package reads repository contents and metadata without running app code
- findings are described in terms of specific checks and specific results, not absolute trust

## Secret handling
- do not commit `.env` files or secret values into source control
- do not log tokens, client secrets, app keys, or environment variables
- keep secret configuration in local env files or a managed secret store
- prefer provider-managed credentials when a service already supports them

## GitHub App and repo access
- GitHub App access should be minimal and scoped to the required repo permissions
- installation and repo visibility checks must happen before indexing or analysis begins
- repository reads should be limited to the user or installation that requested the analysis
- destructive or mutating actions should require explicit approval before execution

## Sandbox expectations for later phases
Future automation that validates or patches repo content should run in an isolated sandbox. The expected model is:

- isolated execution environment
- restricted host and network access
- no direct access to developer secrets or production credentials
- no persistence of untrusted repo state on the host

## Language for findings
The accepted wording for a repo analysis should be:

- "No issues found by these checks"

It should not be phrased as:

- "Safe"
- "Secure"
- "No issues at all"

This keeps the product honest and aligned with the actual scope of the checks being performed.

## Open questions
- final sandbox technology and hardening plan
- production hosting model and secrets management
- observability and operational controls for repo analysis
