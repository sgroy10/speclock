---
name: speclock-guardrails
description: Check planned AI coding actions and patches against explicit project constraints with SpecLock. Use before protected edits, architecture changes, destructive commands, or commits in projects using constraint files or active SpecLock locks.
---

# SpecLock Guardrails

Read the project constraints and check the intended action with SpecLock. Stop on a blocking violation. Proceed only when an authorized user explicitly identifies the constraint to amend or override; do not infer permission from a conflicting implementation request. Check the resulting patch before committing it.

Report `ALLOW`, `WARN`, or `BLOCK`, the relevant constraint, planned action, affected files or commands, reason, and safest next step. Direct contradiction is `BLOCK`; ask for clarification when a semantic match is uncertain.

Treat MCP integrations as assisted verification unless the host exposes a native pre-action hook. SpecLock complements memory, skills, tests, and review; it does not guarantee correctness or eliminate hallucinations.
