# SpecLock Development Guide

## Project

SpecLock is an MIT-licensed Node.js AI constraint engine. Keep changes focused,
preserve the public CLI and MCP APIs, and do not weaken enforcement behavior.

## Required checks

- Run `npx speclock check "<planned action>"` before changing code.
- Run `npm test` before proposing a release.
- Changes under `src/` require a version bump in every location documented in
  `CLAUDE.md`. Documentation, metadata, tests, and plugin packaging do not.
- Never publish, deploy, tag, push, or create a pull request without explicit
  maintainer approval.

## Security

- Do not commit credentials, deployment identifiers, customer data, or rules
  copied from another project.
- Claude Code hook handlers must parse JSON from stdin, cap untrusted input
  sizes, and fail open on internal errors.
- Hard enforcement may deny an action only when SpecLock itself reports a
  blocked conflict. Advisory conflicts must remain warnings.

## Compatibility

- Node.js 18 and later are supported.
- Keep the local stdio MCP server compatible with Claude Code, Cursor,
  Windsurf, Cline, Codex, and other MCP clients.
- Use current official Claude Code plugin and hook schemas.
