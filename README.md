# FlowKeeper

FlowKeeper is a repo-level continuity engine for AI coding agents. It maintains structured project memory, an append-only event log, and context packs to prevent loss of critical decisions and constraints.

## Install

```powershell
npm install
npm link
```

```bash
npm install
npm link
```

## Initialize

```powershell
flowkeeper init
```

```bash
flowkeeper init
```

This creates:

```
.flowkeeper/
  brain.json
  events.log
  patches/
  context/
    latest.md
```

## Set Goal

```powershell
flowkeeper goal "Ship V1 with all SpecLock items"
```

```bash
flowkeeper goal "Ship V1 with all SpecLock items"
```

## Add SpecLock and Decisions

```powershell
flowkeeper lock "No integrations in V1" --tags "scope,product" --source user
flowkeeper decide "Use JSONL for events" --tags "storage" --source agent
```

```bash
flowkeeper lock "No integrations in V1" --tags "scope,product" --source user
flowkeeper decide "Use JSONL for events" --tags "storage" --source agent
```

## Update Deploy Facts

```powershell
flowkeeper facts deploy --provider railway --autoDeploy true --branch main --notes "auto"
```

```bash
flowkeeper facts deploy --provider railway --autoDeploy true --branch main --notes "auto"
```

## Watch Repo

```powershell
flowkeeper watch
```

```bash
flowkeeper watch
```

Watches for file changes (excluding `node_modules`, `.git`, `.flowkeeper`) and records events and patches (if git is available).

## Generate Context Pack

```powershell
flowkeeper context
```

```bash
flowkeeper context
```

The context pack is written to:

```
.flowkeeper/context/latest.md
```

## Where FlowKeeper Stores Data

- `brain.json`: compact structured state
- `events.log`: append-only JSONL log
- `patches/`: per-event patch snapshots (git diff when possible)
- `context/latest.md`: minimal context pack

## Notes

- Works on macOS and Windows.
- Requires Node.js 18+.
- No network, no cloud sync, no UI.