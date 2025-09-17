# AGENTS.md — AI SWE Agent Standards for This Repository

Scope: Entire repository. Applies to all AI agents (CLI, IDE, terminal) and contributors working with automation.

1) Conductor-First Workflow (Mandatory)
- Always route non-trivial work via the Conductor/Orchestrator.
- Complexity policy: if a task involves multiple steps or affects multiple files/components, treat complexity > 2 and use Conductor.
- For high complexity (> 5), require: method proposals, risk assessment, and explicit approval before execution.
- **Anti-Over-Engineering Policy**: Do NOT over-engineer. You will receive penalty for each attempt to make codebase more complex.
- **Simplicity Mandate**: Keep code clear and simple as possible. Prefer straightforward solutions over elaborate architectures.

2) Method Proposals & Planning
- For complexity > 5: propose at least 5 alternative methods, compare trade-offs, select one, and record rationale.
- Maintain a compact step-by-step plan and update progress as you complete steps.
- **Task Completion Checklist**: At the end of each task, always proceed with checklist: what was required vs what was done, do you follow requirements.

3) ADRs (Architecture Decision Records)
- Any architectural change, new dependency, cross-cutting refactor, or policy change requires an ADR.
- Location: `docs/ADR/`. Naming: `ADR-XXX-title.md` (monotonic IDs).
- Template sections: Context, Decision, Alternatives, Consequences, Status, Links.
- Reference ADR IDs in code/comments like `ADR-004` and in commit messages.

4) TASK Tracking
- Tag significant work items in code comments and PRs as `TASK-XXX`.
- Keep TASK identifiers stable and reference them in logs/commits.

5) Safety, Approvals, and Guardrails
- Respect resource constraints (memory/CPU/concurrency) and abort or downgrade gracefully if limits are exceeded.
- Use staged rollouts for risky changes; prefer reversible changes.
- For destructive ops (schema changes, data migrations), require an ADR + explicit approval.

6) Logging and Telemetry
- Use structured logs with categories consistent with the codebase: SYSTEM, MCP_REQUEST, MCP_RESPONSE, MCP_ERROR, AGENT_ACTIVITY, PERFORMANCE.
- Ensure important actions include request IDs and timings.

7) Documentation Standards
- Keep README focused on what it is, how to use it, how to integrate (Claude/clients), and where to find deeper docs.
- Centralize agent governance in this AGENTS.md; keep client-specific tips in their own docs.
- Maintain `docs/ADR/README.md` with ADR usage and template.

8) Tools and Interfaces
- Expose tools consistently via MCP and document input schemas in README.
- Avoid breaking tool names or schemas without an ADR and migration notes.

9) Compliance Note
- These rules implement the AI SWE approach (systematic agent-led development) described in the referenced article. The repository already reflects this via Conductor usage, TASK/ADR tags, and MCP server tooling.

Quick Links
- README: project overview and MCP usage — `README.md`
- ADR guide and template — `docs/ADR/README.md`
- Performance guide — `PERFORMANCE_GUIDE.md`
- Publishing — `PUBLISHING.md`

