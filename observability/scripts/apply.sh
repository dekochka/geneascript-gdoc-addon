#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DASHBOARD_FILE="$ROOT_DIR/observability/dashboards/geneascript-observability.json"

echo "Using gcloud project: $(gcloud config get-value project)"

upsert_counter_metric() {
  local name="$1"
  local description="$2"
  local filter="$3"
  local with_model="${4:-false}"
  local with_user="${5:-false}"
  if [[ "$with_model" == "true" || "$with_user" == "true" ]]; then
    local tmp_config
    tmp_config="$(mktemp)"
    {
      cat <<EOF
description: "$description"
filter: '$filter'
metricDescriptor:
  metricKind: DELTA
  valueType: INT64
  unit: "1"
EOF
      if [[ "$with_model" == "true" || "$with_user" == "true" ]]; then
        cat <<'EOF'
  labels:
EOF
      fi
      if [[ "$with_model" == "true" ]]; then
        cat <<'EOF'
    - key: model
      valueType: STRING
      description: "Gemini model id"
EOF
      fi
      if [[ "$with_user" == "true" ]]; then
        cat <<'EOF'
    - key: user
      valueType: STRING
      description: "Anonymized user key"
EOF
      fi
      if [[ "$with_model" == "true" || "$with_user" == "true" ]]; then
        cat <<'EOF'
labelExtractors:
EOF
      fi
      if [[ "$with_model" == "true" ]]; then
        cat <<'EOF'
  model: 'REGEXP_EXTRACT(jsonPayload.message, ".*\"model\":\"([^\"]+)\".*")'
EOF
      fi
      if [[ "$with_user" == "true" ]]; then
        cat <<'EOF'
  user: 'REGEXP_EXTRACT(jsonPayload.message, ".*\"userKey\":\"([^\"]+)\".*")'
EOF
      fi
    } > "$tmp_config"
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
  local with_user="${6:-false}"
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
    if [[ "$with_model" == "true" || "$with_user" == "true" ]]; then
      cat <<'EOF'
  labels:
EOF
    fi
    if [[ "$with_model" == "true" ]]; then
      cat <<'EOF'
    - key: model
      valueType: STRING
      description: "Gemini model id"
EOF
    fi
    if [[ "$with_user" == "true" ]]; then
      cat <<'EOF'
    - key: user
      valueType: STRING
      description: "Anonymized user key"
EOF
    fi
    if [[ "$with_model" == "true" || "$with_user" == "true" ]]; then
      cat <<'EOF'
labelExtractors:
EOF
    fi
    if [[ "$with_model" == "true" ]]; then
      cat <<'EOF'
  model: 'REGEXP_EXTRACT(jsonPayload.message, ".*\"model\":\"([^\"]+)\".*")'
EOF
    fi
    if [[ "$with_user" == "true" ]]; then
      cat <<'EOF'
  user: 'REGEXP_EXTRACT(jsonPayload.message, ".*\"userKey\":\"([^\"]+)\".*")'
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
    gcloud logging metrics update "$name" --config-from-file="$tmp_config" >/dev/null
  else
    echo "Creating metric: $name"
    gcloud logging metrics create "$name" --config-from-file="$tmp_config" >/dev/null
  fi
  rm -f "$tmp_config"
}

echo "Upserting log-based metrics..."

upsert_counter_metric \
  "geneascript_transcribe_images_count" \
  "Count successful image transcriptions" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_done\".*\"status\":\"success\""' \
  "true" \
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
  "true" \
  "true"

upsert_distribution_metric \
  "geneascript_output_tokens" \
  "Output tokens per image" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"outputTokens\\\":([0-9]+).*")' \
  "true" \
  "true"

upsert_distribution_metric \
  "geneascript_total_tokens" \
  "Total tokens per image" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"totalTokens\\\":([0-9]+).*")' \
  "true" \
  "true"

upsert_distribution_metric \
  "geneascript_estimated_cost_usd" \
  "Estimated USD cost per image from prompt/output tokens" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"estimatedCostUsd\\\":([0-9]+(?:\\.[0-9]+)?).*")' \
  "true" \
  "true"

upsert_distribution_metric \
  "geneascript_transcribe_latency_ms" \
  "End-to-end transcription latency in milliseconds" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"latencyMs\\\":([0-9]+).*")' \
  "true" \
  "true"

upsert_distribution_metric \
  "geneascript_transcribe_latency_s" \
  "End-to-end transcription latency in seconds" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"latencySec\\\":([0-9]+(?:\\.[0-9]+)?).*")' \
  "true" \
  "true"

upsert_distribution_metric \
  "geneascript_image_bytes" \
  "Input image size in bytes for transcriptions" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"imageBytes\\\":([0-9]+).*")' \
  "true" \
  "true"

upsert_distribution_metric \
  "geneascript_image_kbytes" \
  "Input image size in kilobytes for transcriptions" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_api_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"imageKBytes\\\":([0-9]+(?:\\.[0-9]+)?).*")' \
  "true" \
  "true"

upsert_distribution_metric \
  "geneascript_images_imported_count" \
  "Images imported per completed import run" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"import_drive_done\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"addedCount\\\":([0-9]+).*")' \
  "false" \
  "true"

upsert_distribution_metric \
  "geneascript_import_image_latency_ms" \
  "Per-image import latency in milliseconds" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"import_drive_image_processed\".*\"status\":\"success\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"imageImportLatencyMs\\\":([0-9]+).*")'

upsert_distribution_metric \
  "geneascript_estimated_cost_usd_total" \
  "Estimated USD cost per image for total cost visualization" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"transcribe_image_done\".*\"status\":\"success\""' \
  'REGEXP_EXTRACT(jsonPayload.message, ".*\\\"estimatedCostUsd\\\":([0-9]+(?:\\.[0-9]+)?).*")' \
  "true" \
  "true"

upsert_counter_metric \
  "geneascript_user_activity_count" \
  "Activity counter for unique-user approximation" \
  'resource.type="app_script_function" AND jsonPayload.message=~"OBS:.*\"event\":\"(transcribe_image_done|import_drive_done)\".*\"status\":\"success\""' \
  "false" \
  "true"

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
