# Contributing Guide

Thank you for contributing! This project follows an AI Software Engineering (AI SWE) workflow with agent governance.

Quick Links
- Agent governance and rules: `AGENTS.md`
- ADR template and usage: `docs/ADR/README.md`
- Publishing and release notes: `PUBLISHING.md`

## Getting Started
- Requirements: Node.js 18+ (20+ recommended)
- Install: `npm install`
- Build: `npm run build`
- Test: `npm test`
- Lint/format: `npm run lint` / `npm run format`

## Workflow (AI SWE)
- Conductor-first: route any multi-step or multi-file task via the Conductor/Orchestrator.
- Plan updates: outline steps and keep progress updated as you work.
- Complexity gates: if complexity > 5, provide multiple method proposals, evaluate trade-offs, and obtain approval.

## Proposing Changes
1) Small changes (single file, low risk): open a PR referencing any relevant TASK IDs.
2) Architectural or cross-cutting changes: write an ADR first under `docs/ADR/` and reference it in the PR.
3) Breaking MCP tool names/schemas or DB migrations: require ADR + migration notes + explicit approval.

## Commit Messages
- Reference TASK and ADR identifiers when applicable, e.g.:
  - `feat: improve query tool performance (TASK-123, ADR-005)`
  - `docs: add ADR for embedding provider switch (ADR-006)`

## PR Checklist
- [ ] ADR added/updated (if architecture or breaking change)
- [ ] Tests added/updated for changed behavior
- [ ] Lint/format passed (`npm run lint`, `npm run format`)
- [ ] Docs updated (README/AGENTS/ADR/CHANGELOG as needed)
- [ ] No breaking changes without ADR and migration notes

## Code Style
- TypeScript, ESM modules
- Biome for lint/format (`npm run lint`, `npm run format`)
- Keep changes focused and minimal; prefer small, reviewable PRs

## Releasing
- See `PUBLISHING.md` for packaging and release steps.

