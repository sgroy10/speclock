# SpecLock GitHub Action

Enforce your AI rule files (`CLAUDE.md`, `.cursorrules`, `AGENTS.md`, `SPECLOCK.md`) as first-class laws in CI/CD.

SpecLock reads your existing rule files, extracts the constraints, and runs a semantic audit against the changes in your pull request or push. If a change conflicts with a locked constraint, SpecLock fails the build.

> Stop AI from breaking code you told it not to touch.

## Usage

### Basic usage

```yaml
name: SpecLock Audit
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  speclock:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - uses: sgroy10/speclock-action@v1
```

### Strict mode (hard block on violations)

```yaml
      - uses: sgroy10/speclock-action@v1
        with:
          mode: strict
```

### Pin to a specific SpecLock version

```yaml
      - uses: sgroy10/speclock-action@v1
        with:
          speclock-version: 5.5.7
```

### Load explicit rule files

```yaml
      - uses: sgroy10/speclock-action@v1
        with:
          rule-files: 'CLAUDE.md,.cursorrules,AGENTS.md'
          mode: strict
```

### Don't fail on HIGH violations (report-only)

```yaml
      - uses: sgroy10/speclock-action@v1
        with:
          fail-on-high: 'false'
```

## Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `mode` | no | `warn` | Enforcement mode. `warn` reports violations; `strict` exits non-zero on violations. |
| `rule-files` | no | `` (auto-detect) | Comma-separated list of rule files to load (e.g. `CLAUDE.md,.cursorrules`). |
| `fail-on-high` | no | `true` | Fail the workflow when any HIGH-confidence violation is detected. |
| `speclock-version` | no | `latest` | SpecLock npm version to install. |

## Outputs

| Output | Description |
|--------|-------------|
| `passed` | `true` if the audit passed, `false` otherwise. |
| `violations` | Number of HIGH-confidence violations found. |

## Badge

Add a status badge to your README:

```markdown
[![SpecLock](https://github.com/<you>/<repo>/actions/workflows/speclock.yml/badge.svg)](https://github.com/<you>/<repo>/actions/workflows/speclock.yml)
```

## How it works

1. Installs `speclock` from npm on the runner.
2. If no `.speclock/` directory exists, runs `speclock protect` to bootstrap it from your existing rule files.
3. Runs `speclock audit-semantic` against the changes in the commit/PR.
4. Emits a GitHub step summary with the audit output.
5. Fails the job when HIGH-confidence violations are found (in `strict` mode, or when `fail-on-high: true`).

## What gets enforced

SpecLock automatically discovers and enforces rules declared in:

- `CLAUDE.md` — Claude Code / Anthropic project rules
- `.cursorrules` — Cursor editor rules
- `AGENTS.md` — OpenAI / generic agent rules
- `SPECLOCK.md` — Native SpecLock rules
- `.speclock/context/latest.md` — Locked constraints from previous sessions

## License

MIT — Developed by [Sandeep Roy](https://github.com/sgroy10).
