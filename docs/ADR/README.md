# ADR — Architecture Decision Records

Purpose
- Capture significant architectural decisions with context and consequences.
- Make design intent explicit and discoverable for future contributors and agents.

When to write an ADR
- New dependency or SDK adoption
- Cross-cutting refactor or subsystem redesign
- Protocol/transport changes, tool schema changes
- Security, performance, or operational policy changes

File naming and location
- Store files in this folder: `docs/ADR/`
- Name as `ADR-XXX-title.md` with a zero-padded incremental number.

Template
```
# ADR-XXX: Title

Status: Proposed | Accepted | Superseded by ADR-YYY | Rejected
Date: YYYY-MM-DD
Related: TASK-XXX, Issues, PRs, Docs

## Context
What problem are we solving? What constraints apply? What was considered?

## Decision
What was decided and why (link to benchmarks or experiments if relevant)?

## Alternatives
Options considered with trade-offs and reasons for not choosing them.

## Consequences
Implications, risks, migrations, deprecations, and follow-up tasks.

## Links
References to code, specs, tickets, and external resources.
```

Conventions
- Reference ADR IDs in code comments where decisions are applied (e.g., `ADR-004`).
- Summarize ADR impacts in changelogs and release notes when applicable.

