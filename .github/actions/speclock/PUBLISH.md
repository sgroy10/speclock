# Publishing SpecLock to the GitHub Actions Marketplace

This directory contains a **composite action** that can be consumed two ways:

1. **In-repo** — reference it directly from workflows inside the `sgroy10/speclock` repo via `uses: ./.github/actions/speclock`.
2. **Marketplace** — extracted into a **standalone public repo** (`sgroy10/speclock-action`) so that anyone on GitHub can run `uses: sgroy10/speclock-action@v1`.

GitHub Marketplace requires the `action.yml` to live at the **root** of a dedicated public repo. This doc is the recipe for splitting this directory into that standalone repo.

---

## Requirements for Marketplace listing

Per [GitHub's rules](https://docs.github.com/en/actions/creating-actions/publishing-actions-in-github-marketplace):

1. The action must live in a **public** repo.
2. `action.yml` must be at the **repo root** (not in a subdirectory).
3. The repo must have a `README.md` at the root.
4. The action must have a unique `name:` that isn't already used on the Marketplace.
5. The action must have a `branding:` block with `icon` and `color`.
6. A **tagged release** (e.g. `v1.0.0`) must exist; Marketplace listings point at tags.
7. The repo owner must accept the GitHub Marketplace Developer Agreement (one-time).

---

## One-time setup: create the standalone repo

```bash
# From an empty working directory
mkdir speclock-action && cd speclock-action
git init -b main

# Copy the action files from flowkeeper/.github/actions/speclock/
cp /path/to/flowkeeper/.github/actions/speclock/action.yml   ./action.yml
cp /path/to/flowkeeper/.github/actions/speclock/entrypoint.sh ./entrypoint.sh
cp /path/to/flowkeeper/.github/actions/speclock/README.md     ./README.md
chmod +x entrypoint.sh

# MIT license file
curl -s https://raw.githubusercontent.com/sgroy10/speclock/main/LICENSE -o LICENSE || true

git add .
git commit -m "v1.0.0 — Initial SpecLock GitHub Action"

# Create the public repo on GitHub
gh repo create sgroy10/speclock-action --public --source=. --remote=origin --push

# Tag and release
git tag v1.0.0
git tag -f v1            # floating major tag
git push origin v1.0.0
git push origin v1 --force

# Create a GitHub Release (triggers Marketplace prompt)
gh release create v1.0.0 --title "v1.0.0" --notes "Initial SpecLock GitHub Action release."
```

When you create the Release via the GitHub UI, check **"Publish this Action to the GitHub Marketplace"**, accept the developer agreement, pick a primary category (`Code quality` or `Continuous integration`), and submit.

---

## Every release after that

```bash
# In speclock-action repo
git commit -am "vX.Y.Z — description"
git tag vX.Y.Z
git tag -f v1            # move the floating major tag forward
git push origin main
git push origin vX.Y.Z
git push origin v1 --force
gh release create vX.Y.Z --title "vX.Y.Z" --notes "Release notes..."
```

Users referencing `sgroy10/speclock-action@v1` pick up the new release automatically. Users pinning `@vX.Y.Z` stay on the exact version.

---

## Keeping this directory and the standalone repo in sync

Treat **this directory** (`.github/actions/speclock/`) as the **source of truth**. When you change `action.yml`, `entrypoint.sh`, or `README.md` here:

1. Commit the change in `flowkeeper`.
2. Copy the three files to `speclock-action/` and commit + tag + push there.

A simple sync script (run from `speclock-action/`):

```bash
FK=/c/Users/HR-02/flowkeeper
cp $FK/.github/actions/speclock/action.yml    ./action.yml
cp $FK/.github/actions/speclock/entrypoint.sh ./entrypoint.sh
cp $FK/.github/actions/speclock/README.md     ./README.md
git add -A && git diff --cached --quiet || git commit -m "Sync from flowkeeper"
```

---

## Why not just use a Docker action?

A Docker-based action would require a base image with Node already installed, slowing cold starts by 30-60 seconds on every run. The composite action:

- Runs natively on the runner (no Docker pull).
- Reuses the caller's `actions/setup-node@v4` step.
- Is much cheaper on GitHub Actions minutes.

---

## Marketplace listing metadata

When you submit the listing, use:

- **Name:** `SpecLock — Enforce AI Rule Files`
- **Primary category:** `Code quality`
- **Secondary category:** `Continuous integration`
- **Icon:** `shield`
- **Color:** `red`
- **Description:** Run SpecLock semantic audit on your repo. Enforces `CLAUDE.md`, `.cursorrules`, `AGENTS.md` as pre-commit / CI laws.
