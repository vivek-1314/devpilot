# Security

## Threat model
DevPilot may analyze repositories from third-party or untrusted sources. The core risk is that repository code can contain malicious or unsafe behavior even when the goal is static analysis.

## Security principles
- Never run untrusted repository code on the host
- Prefer static analysis and metadata inspection over dynamic execution
- Treat all GitHub tokens, app credentials, and repository secrets as sensitive
- Keep execution and scanning boundaries explicit
- Never claim a repo is safe or secure based on limited checks

## Secret handling
- Do not log tokens, client secrets, or environment values
- Do not print repository secrets into debug logs or application output
- Minimize secret exposure in configuration and environment files
- Use provider-managed secrets where available

## Permission boundaries
- GitHub App permissions should be scoped to the minimum necessary access
- Repository access should be specific to the user or organization that requested analysis
- User-level usage limits should be enforced in the design
- Destructive actions or broad automated changes should require explicit confirmation

## Sandbox requirements
The repository should not be executed directly on the host. Any later automated validation must run in a controlled sandbox.

Minimum expectations for the sandbox:
- isolated execution environment
- restricted host access
- no direct access to developer secrets or production credentials
- limited network access by default
- no persistence of untrusted repository state on the host

## Static analysis rule
Repository scanning is limited to static checks during the initial product scope. A finding should be phrased as:

- "No issues found by these checks"

It should never be phrased as:

- "Safe"
- "Secure"
- "No issues at all"

This keeps the language truthful and aligned with the limited scope of the checks being run.

## Risk posture
The system is designed to reduce exposure by avoiding host execution, limiting permissions, and maintaining strict output language. This is important because code from arbitrary repos may not be trustworthy even when it appears to be a normal project.

## Open questions
- Sandbox technology: OPEN QUESTION
- Hosting environment: OPEN QUESTION
- Production security controls and hardening plan: OPEN QUESTION
