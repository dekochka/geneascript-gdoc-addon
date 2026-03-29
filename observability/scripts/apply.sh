#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DASHBOARD_FILE="$ROOT_DIR/observability/dashboards/geneascript-observability.json"
DEBUG_LOG_PATH="$ROOT_DIR/.cursor/debug-b78b55.log"
DEBUG_RUN_ID="apply_$(date +%s)"

debug_log() {
  local hypothesis_id="$1"
  local location="$2"
  local message="$3"
  local data="$4"
  # #region agent log
  printf '{"sessionId":"b78b55","runId":"%s","hypothesisId":"%s","location":"%s","message":"%s","data":%s,"timestamp":%s}\n' \
    "$DEBUG_RUN_ID" "$hypothesis_id" "$location" "$message" "$data" "$(($(date +%s)*1000))" >> "$DEBUG_LOG_PATH"
  # #endregion
}

echo "Using gcloud project: $(gcloud config get-value project)"
debug_log "H1" "apply.sh:project" "active project detected" "{\"project\":\"$(gcloud config get-value project 2>/dev/null || echo unknown)\"}"
debug_log "H2" "apply.sh:gcloud-version" "gcloud version captured" "{\"version\":\"$(gcloud --version 2>/dev/null | tr '\n' ' ' | sed 's/\"/\\"/g')\"}"
debug_log "H2" "apply.sh:create-help" "checked if create supports value-extractor" "{\"supportsValueExtractor\":$(gcloud logging metrics create --help 2>/dev/null | rg -q -- '--value-extractor' && echo true || echo false)}"

upsert_counter_metric() {
  local name="$1"
  local description="$2"
  local filter="$3"
  local with_model="${4:-false}"
  if [[ "$with_model" == "true" ]]; then
    local tmp_config
    tmp_config="$(mktemp)"
    cat > "$tmp_config" <<EOF
description: "$description"
filter: '$filter'
metricDescriptor:
  metricKind: DELTA
  valueType: INT64
  unit: "1"
  labels:
    - key: model
      valueType: STRING
      description: "Gemini model id"
labelExtractors:
  model: 'REGEXP_EXTRACT(jsonPayload.message, ".*\"model\":\"([^\"]+)\".*")'
EOF
    if gcloud logging metrics describe "$name" >/dev/null 2>&1; then
      echo "Updating metric: $name"
      gcloud logging metrics update "$name" --config-from-file="$tmp_config" >/dev/null
    else
      echo "Creating metric: $name"
      gcloud logging metrics create "$name" --config-from-file="$tmp_config" >/dev/null
    fi
    rm -f "$tmp_config"
  else
    if gcloud logging metrics describe "$name" >/dev/null 2>&1; then
      echo "Updating metric: $name"
      gcloud logging metrics update "$name" \
        --description="$description" \
        --log-filter="$filter" >/dev/null
    else
      echo "Creating metric: $name"
      gcloud logging metrics create "$name" \
        --description="$description" \
        --log-filter="$filter" >/dev/null
    fi
  fi
}

upsert_distribution_metric() {
  local name="$1"
  local description="$2"
  local filter="$3"
  local extractor="$4"
  local with_model="${5:-false}"
  debug_log "H3" "apply.sh:upsert_distribution_metric" "distribution metric branch entered" "{\"metric\":\"$name\"}"
  local tmp_config
  tmp_config="$(mktemp)"
  {
    cat <<EOF
description: "$description"
filter: '$filter'
valueExtractor: '$extractor'
metricDescriptor:
  metricKind: DELTA
  valueType: DISTRIBUTION
  unit: "1"
EOF
    if [[ "$with_model" == "true" ]]; then
      cat <<'EOF'
  labels:
    - key: model
      valueType: STRING
      description: "Gemini model id"
labelExtractors:
  model: 'REGEXP_EXTRACT(jsonPayload.message, ".*\"model\":\"([^\"]+)\".*")'
EOF
    fi
    cat <<EOF
bucketOptions:
  exponentialBuckets:
    numFiniteBuckets: 40
    growthFactor: 2
    scale: 1
EOF
  } > "$tmp_config"
  if gcloud logging metrics describe "$name" >/dev/null 2>&1; then
    echo "Updating metric: $name"
    debug_log "H3" "apply.sh:upsert_distribution_metric" "using update path for metric" "{\"metric\":\"$name\"}"
    gcloud logging metrics update "$name" --config-from-file="$tmp_config" >/dev/null
  else
    echo "Creating metric: $name"
    debug_log "H4" "apply.sh:upsert_distribution_metric" "using create path for metric with value extractor" "{\"metric\":\"$name\"}"
    gcloud logging metrics create "$name" --config-from-file="$tmp_config" >/dev/null
  fi
  rm -f "$tmp_config"
}

echo "Upserting log-based metrics..."

upsert_counter_metric \
  "geneascript_transcribe_images_count" \
  "Count successful image transcriptions" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_done\".*\"status\":\"success\""' \
  "true"

upsert_counter_metric \
  "geneascript_import_runs_count" \
  "Count completed import runs" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"import_drive_done\".*\"status\":\"success\""'

upsert_counter_metric \
  "geneascript_errors_count" \
  "Count error events across operations" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"status\":\"error\""'

upsert_distribution_metric \
  "geneascript_prompt_tokens" \
  "Prompt tokens per image" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"promptTokens\\\":([0-9]+).*")' \
  "true"

upsert_distribution_metric \
  "geneascript_output_tokens" \
  "Output tokens per image" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"outputTokens\\\":([0-9]+).*")' \
  "true"

upsert_distribution_metric \
  "geneascript_total_tokens" \
  "Total tokens per image" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"totalTokens\\\":([0-9]+).*")' \
  "true"

upsert_distribution_metric \
  "geneascript_transcribe_latency_ms" \
  "End-to-end transcription latency in milliseconds" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"latencyMs\\\":([0-9]+).*")' \
  "true"

upsert_distribution_metric \
  "geneascript_image_bytes" \
  "Input image size in bytes for transcriptions" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"imageBytes\\\":([0-9]+).*")' \
  "true"

upsert_distribution_metric \
  "geneascript_images_imported_count" \
  "Images imported per completed import run" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"import_drive_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"addedCount\\\":([0-9]+).*")'

upsert_distribution_metric \
  "geneascript_import_image_latency_ms" \
  "Per-image import latency in milliseconds" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"import_drive_image_processed\".*\"status\":\"success\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"imageImportLatencyMs\\\":([0-9]+).*")'

echo "Upserting dashboard..."
dashboard_name="$(gcloud monitoring dashboards list --filter='displayName="GeneaScript Observability"' --format='value(name)' | head -n 1)"
if [[ -n "${dashboard_name}" ]]; then
  echo "Updating dashboard: $dashboard_name"
  if ! gcloud monitoring dashboards update "$dashboard_name" --config-from-file="$DASHBOARD_FILE" >/dev/null 2>&1; then
    echo "Dashboard update failed (likely etag mismatch), recreating..."
    gcloud monitoring dashboards delete "$dashboard_name" --quiet >/dev/null
    gcloud monitoring dashboards create --config-from-file="$DASHBOARD_FILE" >/dev/null
  fi
else
  echo "Creating dashboard"
  gcloud monitoring dashboards create --config-from-file="$DASHBOARD_FILE" >/dev/null
fi

echo "Done. Observability assets applied."
