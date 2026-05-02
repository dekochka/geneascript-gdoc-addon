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

# Redact patterns that could leak PII or identifying content from a string.
# Applied to any free-text field that lands in the committed summary.
def scrub_pii:
  . as $s
  | if ($s | type) != "string" then $s
    else
      $s
      # Email addresses
      | gsub("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}"; "[redacted-email]")
      # Google Docs / Drive URLs with file IDs
      | gsub("https?://docs\\.google\\.com/[A-Za-z0-9/_?=.&#-]*";     "[redacted-gdoc-url]")
      | gsub("https?://drive\\.google\\.com/[A-Za-z0-9/_?=.&#-]*";    "[redacted-drive-url]")
      # Bare Drive/Docs file IDs (28+ char base64-ish runs)
      | gsub("[A-Za-z0-9_-]{28,}"; "[redacted-id]")
      # Any other http(s) URL (API URLs with quota tokens etc.)
      | gsub("https?://[^\\s\"]+"; "[redacted-url]")
      # Truncate to 200 chars after scrubbing (defense in depth)
      | .[0:200]
    end;

def error_code_breakdown:
  ($obs | map(select(.event == "transcribe_image_error"))) as $errs
  | $errs
    | group_by(.errorCode // "UNKNOWN")
    | map({
        code: (.[0].errorCode // "UNKNOWN"),
        count: length,
        uniqueUsers: (map(.userKey) | unique | length),
        sampleMessages: (
          map(.errorMessage // "")
          | map(scrub_pii)
          | unique
          | .[0:3]
        )
      })
    | sort_by(-.count);

def per_user:
  ($obs | map(select(.event == "transcribe_image_done" and .status == "success"))) as $succ
  | ($obs | map(select(.event == "transcribe_image_error"))) as $fail
  | (($succ + $fail) | map(.userKey) | unique) as $users
  | [ $users[] as $u
      | ($succ | map(select(.userKey == $u)) | length) as $s
      | ($fail | map(select(.userKey == $u)) | length) as $f
      | {
          userKeyHash: $u,
          successes: $s,
          failures: $f,
          failRate: (if ($s + $f) > 0 then ($f * 1.0 / ($s + $f)) else null end)
        }
    ]
  | sort_by(-.failures)
  | .[0:20];

def platform_error_categories:
  $platform
  | map(
      .message as $m
      | . + {
          category: (
            if ($m | test("openSidebarFromCard|renderActions.*action"; "i")) then "openSidebarFromCard"
            elif ($m | test("Exceeded maximum execution time"; "i")) then "execution_timeout"
            elif ($m | test("oauth|authoriz|permission"; "i")) then "oauth_permission"
            else "other"
            end
          )
        }
    )
  | group_by(.category)
  | map({
      category: .[0].category,
      count: length,
      firstSeen: (map(.ts) | min),
      lastSeen:  (map(.ts) | max),
      severity: (.[0].severity // "ERROR"),
      sampleMessage: (.[0].message[0:240])
    })
  | sort_by(-.count);

def retry_effectiveness:
  ($obs | map(select(.event == "transcribe_image_api_retry")) | map(.runId) | unique) as $retried
  | ($obs | map(select(.event == "transcribe_image_done" and .status == "success")) | map(.runId)) as $doneRuns
  | ($obs | map(select(.event == "transcribe_image_error")) | map(.runId)) as $errRuns
  | {
      retriesTriggered: ($retried | length),
      retriesSucceeded: ($retried | map(. as $r | $doneRuns | index($r)) | map(select(. != null)) | length),
      retriesFailed:    ($retried | map(. as $r | $errRuns  | index($r)) | map(select(. != null)) | length)
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
  errorCodeBreakdown: error_code_breakdown,
  perUser: per_user,
  platformErrorCategories: platform_error_categories,
  latency: {},
  tokens: {},
  versionTransitions: null,
  retryEffectiveness: retry_effectiveness
}
