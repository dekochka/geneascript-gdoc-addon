# Inputs (via --slurpfile / --arg):
#   $obs:          array of OBS event objects (from parse-obs-events.jq output)
#   $platform:     array of platform error objects
#   $windowStart:  "YYYY-MM-DD"
#   $windowEnd:    "YYYY-MM-DD"
#
# Output: single JSON object = the full weekly-summary.json
#
# This file is extended across tasks 5, 6, 7, 8 — each task adds fields.

def uniq_count(key): map(.[key]) | unique | length;

def event_counts:
  $obs | group_by(.event) | map({ key: .[0].event, value: length }) | from_entries;

def transcription_stats:
  ($obs | map(select(.event == "transcribe_image_start")) | length) as $started
  | ($obs | map(select(.event == "transcribe_image_done" and .status == "success")) | length) as $succeeded
  | ($obs | map(select(.event == "transcribe_image_error")) | length) as $failed
  | {
      started: $started,
      succeeded: $succeeded,
      failed: $failed,
      successRate: (if $started > 0 then ($succeeded * 1.0 / $started) else null end)
    };

{
  window: { start: $windowStart, end: $windowEnd },
  totals: {
    uniqueUsers: ($obs | uniq_count("userKey")),
    uniqueDocs: ($obs | map(.docId) | map(select(. != null)) | unique | length),
    eventsCount: ($obs | length),
    platformErrorsCount: ($platform | length)
  },
  eventCounts: event_counts,
  transcription: transcription_stats,
  errorCodeBreakdown: [],
  perUser: [],
  platformErrorCategories: [],
  latency: {},
  tokens: {},
  versionTransitions: null,
  retryEffectiveness: {}
}
