---
name: speclock-guardrails
description: Check planned AI coding actions and patches against explicit project constraints with SpecLock. Use before protected edits, architecture changes, destructive commands, or commits in projects using constraint files or active SpecLock locks.
---

# SpecLock Guardrails

Read the project constraints, check the intended action with SpecLock, and stop on blocking violations unless the user explicitly authorizes an override. Check the resulting patch before committing it.

Treat MCP integrations as assisted verification unless the host exposes a native pre-action hook. SpecLock complements memory, skills, tests, and review; it does not guarantee correctness or eliminate hallucinations.
