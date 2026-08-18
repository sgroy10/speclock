---
name: speclock-guardrails
description: Check planned AI coding actions and patches against explicit project constraints through SpecLock MCP tools. Use before editing protected areas, changing architecture, running destructive commands, or committing changes in projects with CLAUDE.md, AGENTS.md, .cursorrules, or active SpecLock locks.
---

# SpecLock Guardrails

Use SpecLock as an action-verification layer. It complements memory, skills, reviews, and tests; it does not prove factual correctness or eliminate hallucinations.

## Workflow

1. Read the project briefing and active SpecLock constraints before changing files.
2. Check the intended action, affected files, and commands for conflicts.
3. Stop on a blocking or high-confidence violation unless the user explicitly authorizes an override.
4. Check the resulting patch or diff before presenting or committing it.
5. Record material constraint decisions when the project uses SpecLock decision history.
6. Preserve Git or CI enforcement as the universal fallback when the client cannot intercept actions natively.

## Boundaries

- Treat MCP-only integrations as assisted verification, not guaranteed interception.
- Never claim that SpecLock makes generated code correct or hallucination-free.
- Do not weaken or delete locks without explicit authorization.
- Do not send private project data to a remote service without consent.
