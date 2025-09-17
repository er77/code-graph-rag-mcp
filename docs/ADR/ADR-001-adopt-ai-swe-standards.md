# ADR-001: Adopt AI SWE Standards for Agent-Led Development

Status: Accepted
Date: 2025-09-17
Related: AGENTS.md, docs/ADR/README.md, README.md (AI SWE Compliance), CLAUDE.md

## Context
The project previously relied on informal, ad hoc agent usage (“vibe coding”). The repository already contains an MCP server, multi-agent orchestration, and structured logging, but lacked a unified governance standard for planning, complexity gates, approvals, and decision documentation. Without a shared methodology, multi-file or architectural changes can be risky and hard to audit.

## Decision
Adopt an AI Software Engineering (AI SWE) methodology with the following repository-wide policies:
- Conductor-first workflow: route all non-trivial tasks via the Conductor/Orchestrator.
- Complexity gates: require proposals and explicit approval when complexity > 5; treat multi-step, multi-file tasks as complexity > 2.
- ADR policy: record significant architectural decisions under `docs/ADR/` using `ADR-XXX` IDs and the provided template.
- TASK tracking: use `TASK-XXX` tags for significant work; reference in commits/PRs/logs.
- Structured logging categories: SYSTEM, MCP_REQUEST, MCP_RESPONSE, MCP_ERROR, AGENT_ACTIVITY, PERFORMANCE.
- Safety guardrails: respect resource constraints; stage risky changes; require ADR + approval for destructive operations and data migrations.

## Alternatives
- Continue ad hoc (status quo): lower overhead but poor traceability and higher risk.
- Partial guidelines (informal checklists): improves consistency but still weak on approvals and architectural traceability.
- External heavy frameworks: may add unnecessary complexity versus right-sized, repo-native standards.

## Consequences
Positive:
- Clear governance for agents and contributors; better change traceability and safety.
- Repeatable planning with visible progress and approvals.
- Decisions discoverable via ADRs; simpler onboarding.

Trade-offs:
- Small overhead for writing ADRs and following checklists.
- Contributors must learn minimal workflow conventions (Conductor-first, TASK/ADR tags).

## Migrations & Follow-ups
- Done: Add `AGENTS.md` (governance), add `docs/ADR/README.md` (template), update README with AI SWE compliance note, clarify CLAUDE.md ownership.
- Recommended: Add PR template with checklists (ADR required? TASK tags? docs updated?).
- Optional: Enforce commit format (`TASK-XXX`, `ADR-XXX`) via pre-commit or CI.

## Links
- Repository governance: `AGENTS.md`
- ADR template and usage: `docs/ADR/README.md`
- Overview: README.md (AI SWE Compliance)
- Reference article: AI SWE methodology (Habr, 934806)

