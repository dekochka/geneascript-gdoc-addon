#!/usr/bin/env bash
# Fetches 7 days of Apps Script logs from GCP, parses OBS events and platform
# errors into NDJSON, and produces a compact weekly-summary.json.
#
# Usage:
#   fetch-weekly-logs.sh [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--out-dir PATH] [--fixture-dir PATH]
#
# --start        Start of window (inclusive). Default: 7 days before --end.
# --end          End of window (exclusive). Default: today (UTC).
# --out-dir      Where to write outputs. Default: /tmp/geneascript-weekly-<end>
# --fixture-dir  Skip gcloud; read raw entries from this dir (for tests).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

START=""
END=""
OUT_DIR=""
FIXTURE_DIR=""

usage() {
  grep '^# ' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --start)       START="$2";       shift 2 ;;
    --end)         END="$2";         shift 2 ;;
    --out-dir)     OUT_DIR="$2";     shift 2 ;;
    --fixture-dir) FIXTURE_DIR="$2"; shift 2 ;;
    -h|--help)     usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

# Date defaults (UTC, compatible with both macOS and GNU date).
date_iso() {
  if date -u -v-0d +%Y-%m-%d >/dev/null 2>&1; then
    # BSD date (macOS)
    if [[ $# -ge 1 && "$1" == "-d" ]]; then
      date -u -v"${2}d" +%Y-%m-%d
    else
      date -u +%Y-%m-%d
    fi
  else
    # GNU date
    if [[ $# -ge 1 && "$1" == "-d" ]]; then
      local n="${2//d/}"
      date -u -d "$n days" +%Y-%m-%d
    else
      date -u +%Y-%m-%d
    fi
  fi
}

[[ -z "$END"   ]] && END="$(date_iso)"
[[ -z "$START" ]] && START="$(date_iso -d -7)"
[[ -z "$OUT_DIR" ]] && OUT_DIR="/tmp/geneascript-weekly-$END"

# Preflight: tools.
command -v jq >/dev/null || { echo "jq is required" >&2; exit 3; }
if [[ -z "$FIXTURE_DIR" ]]; then
  command -v gcloud >/dev/null || { echo "gcloud is required (unless --fixture-dir is given)" >&2; exit 3; }
  PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ -z "$PROJECT" || "$PROJECT" == "(unset)" ]]; then
    echo "No gcloud project configured. Run 'gcloud config set project <id>' first." >&2
    exit 4
  fi
else
  [[ -d "$FIXTURE_DIR" ]] || { echo "Fixture dir not found: $FIXTURE_DIR" >&2; exit 5; }
fi

mkdir -p "$OUT_DIR"
echo "Window:  $START → $END"
echo "Output:  $OUT_DIR"
[[ -n "$FIXTURE_DIR" ]] && echo "Fixtures: $FIXTURE_DIR"
