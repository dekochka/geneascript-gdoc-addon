#!/usr/bin/env bash
# Runs the parsers + aggregator against the handcrafted fixtures and
# compares against the golden expected-summary.json. Exits non-zero on mismatch.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT_DIR="$ROOT/observability/scripts"
FIXTURES="$SCRIPT_DIR/tests/fixtures"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "Running parse-obs-events..."
jq -cf "$SCRIPT_DIR/lib/parse-obs-events.jq" "$FIXTURES/gcloud-obs-events.json" \
  > "$TMP/obs.ndjson"

echo "Running parse-platform-errors..."
jq -cf "$SCRIPT_DIR/lib/parse-platform-errors.jq" "$FIXTURES/gcloud-platform-errors.json" \
  > "$TMP/platform.ndjson"

echo "Running aggregate-weekly-summary..."
jq -n \
  --slurpfile obs "$TMP/obs.ndjson" \
  --slurpfile platform "$TMP/platform.ndjson" \
  --arg windowStart "2026-04-20" \
  --arg windowEnd   "2026-04-26" \
  -f "$SCRIPT_DIR/lib/aggregate-weekly-summary.jq" \
  > "$TMP/actual-summary.json"

echo "Comparing against golden expected-summary.json..."
# Compare semantically (ignore whitespace) using jq's --sort-keys + diff.
jq -S . "$FIXTURES/expected-summary.json" > "$TMP/expected-sorted.json"
jq -S . "$TMP/actual-summary.json"       > "$TMP/actual-sorted.json"

if diff -u "$TMP/expected-sorted.json" "$TMP/actual-sorted.json"; then
  echo "PASS: aggregator output matches golden summary."
else
  echo "FAIL: aggregator output differs from golden summary." >&2
  exit 1
fi
