# SpecLock action verification

Before editing protected areas, changing architecture, running destructive commands, or committing a patch, use the SpecLock MCP tools to check the intended action against the project's explicit constraints. Stop when SpecLock reports a blocking violation unless the user explicitly authorizes an override. Check the final diff as well as the plan.

SpecLock complements Gemini's context, memory, skills, tests, and review. It does not guarantee factual correctness or eliminate hallucinations. MCP verification depends on the agent invoking it; retain Git and CI enforcement for actions that must always be checked.
