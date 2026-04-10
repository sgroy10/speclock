#!/usr/bin/env bash
# SpecLock GitHub Action entrypoint
# Developed by Sandeep Roy (https://github.com/sgroy10)
#
# Environment:
#   SPECLOCK_MODE          - "warn" (default) or "strict"
#   SPECLOCK_RULE_FILES    - comma-separated list of rule files to load
#   SPECLOCK_FAIL_ON_HIGH  - "true" (default) or "false"

set -o pipefail

MODE="${SPECLOCK_MODE:-warn}"
RULE_FILES="${SPECLOCK_RULE_FILES:-}"
FAIL_ON_HIGH="${SPECLOCK_FAIL_ON_HIGH:-true}"

echo "=============================================="
echo " SpecLock — Enforce AI Rule Files"
echo "=============================================="
echo " Mode:            ${MODE}"
echo " Rule files:      ${RULE_FILES:-<auto-detect>}"
echo " Fail on HIGH:    ${FAIL_ON_HIGH}"
echo " Workspace:       $(pwd)"
echo "=============================================="

# Step 1: Ensure .speclock exists (run protect if not)
if [ -d ".speclock" ]; then
  echo "Existing .speclock found, running audit..."
else
  echo "No .speclock found, running 'speclock protect' to bootstrap..."
  speclock protect || {
    echo "WARNING: 'speclock protect' failed. Attempting to continue with audit anyway."
  }
fi

# Step 2: Optionally sync explicit rule files
if [ -n "${RULE_FILES}" ]; then
  echo ""
  echo "Loading explicit rule files: ${RULE_FILES}"
  IFS=',' read -ra FILES <<< "${RULE_FILES}"
  for f in "${FILES[@]}"; do
    f_trimmed="$(echo "$f" | xargs)"
    if [ -f "${f_trimmed}" ]; then
      echo "  - ${f_trimmed}"
      speclock sync-rules "${f_trimmed}" 2>/dev/null || \
        speclock ingest "${f_trimmed}" 2>/dev/null || \
        echo "    (no explicit sync command; SpecLock will auto-detect)"
    else
      echo "  - MISSING: ${f_trimmed}"
    fi
  done
fi

# Step 3: Run audit-semantic
echo ""
echo "Running: speclock audit-semantic"
STRICT_FLAG=""
if [ "${MODE}" = "strict" ]; then
  STRICT_FLAG="--strict"
fi

set +e
AUDIT_OUTPUT="$(speclock audit-semantic ${STRICT_FLAG} 2>&1)"
AUDIT_EXIT=$?
set -e

echo "${AUDIT_OUTPUT}"

# Step 4: Write GitHub step summary (if available)
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "## SpecLock Semantic Audit"
    echo ""
    echo "- **Mode:** ${MODE}"
    echo "- **Exit code:** ${AUDIT_EXIT}"
    echo ""
    echo '```'
    echo "${AUDIT_OUTPUT}"
    echo '```'
  } >> "${GITHUB_STEP_SUMMARY}"
fi

# Step 5: Count HIGH violations
HIGH_COUNT=$(echo "${AUDIT_OUTPUT}" | grep -c "\[HIGH\]" || true)
HIGH_COUNT=${HIGH_COUNT:-0}

# Step 6: Emit outputs
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  if [ "${AUDIT_EXIT}" -eq 0 ]; then
    echo "passed=true" >> "${GITHUB_OUTPUT}"
  else
    echo "passed=false" >> "${GITHUB_OUTPUT}"
  fi
  echo "violations=${HIGH_COUNT}" >> "${GITHUB_OUTPUT}"
fi

echo ""
echo "=============================================="
echo " Result: exit=${AUDIT_EXIT}, HIGH violations=${HIGH_COUNT}"
echo "=============================================="

# Step 7: Fail policy
if [ "${FAIL_ON_HIGH}" = "true" ] && [ "${HIGH_COUNT}" -gt 0 ]; then
  echo "FAIL: ${HIGH_COUNT} HIGH-confidence violation(s) detected."
  exit 1
fi

# In strict mode, propagate audit exit code
if [ "${MODE}" = "strict" ] && [ "${AUDIT_EXIT}" -ne 0 ]; then
  echo "FAIL: strict mode — audit exited with code ${AUDIT_EXIT}."
  exit "${AUDIT_EXIT}"
fi

exit 0
