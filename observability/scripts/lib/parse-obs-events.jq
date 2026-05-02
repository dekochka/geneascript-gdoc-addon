# Input: array of gcloud log entries.
# Output: one JSON object per line, each being the parsed OBS event
#   augmented with gcloud's entry-level timestamp and severity.
.[]
| select(.jsonPayload.message | startswith("OBS:"))
| .jsonPayload.message as $msg
| ($msg | ltrimstr("OBS:") | fromjson) as $evt
| $evt + {
    _entryTimestamp: .timestamp,
    _severity: .severity
  }
