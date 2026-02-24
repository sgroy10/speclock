# Code Signing Setup

## Windows (NSIS)

Electron Builder uses these environment variables:

- `WIN_CSC_LINK` (path to .pfx or base64 string)
- `WIN_CSC_KEY_PASSWORD`

Example (PowerShell):

```
$env:WIN_CSC_LINK = "C:\certs\flowkeeper.pfx"
$env:WIN_CSC_KEY_PASSWORD = "<password>"
```

Then run:

```
npm run build:win
```

## macOS (Notarization)

Set these secrets in GitHub Actions (Repository Settings → Secrets):

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`

The macOS build workflow will use them automatically.

If you build locally on Mac:

```
export APPLE_ID="you@domain.com"
export APPLE_APP_SPECIFIC_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="TEAMID"
```

Then run:

```
npm run build:mac
```