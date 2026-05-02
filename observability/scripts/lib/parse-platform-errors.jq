# Input: array of gcloud log entries already pre-filtered to severity>=ERROR
#   AND NOT matching OBS:.
# Output: one JSON object per line with a compact shape suitable for
#   substring-bucketing during aggregation.
.[]
| {
    ts: .timestamp,
    severity: .severity,
    message: (.jsonPayload.message // ""),
    functionName: (.resource.labels.function_name // null)
  }
