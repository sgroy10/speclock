# Contributing to SpecLock

Thanks for helping make AI coding constraints more reliable.

## Development

Requirements: Node.js 18 or newer and npm.

```bash
git clone https://github.com/sgroy10/speclock.git
cd speclock
npm ci
npm test
npm run test:plugin
```

Keep pull requests focused. Add or update tests for behavior changes, and run the complete test gate before submitting.

## Reporting bugs

Use the bug-report issue form and include your operating system, Node version, AI client, enforcement mode, reproduction steps, and redacted `speclock doctor` output. Never post credentials, private constraints, or proprietary source code.

## Proposing features

Describe the constraint-enforcement problem first, then the proposed behavior. Small, testable changes are easier to review than broad rewrites.
