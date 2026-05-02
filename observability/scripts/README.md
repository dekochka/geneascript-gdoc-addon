# observability/scripts

## apply.sh

Applies log-based metrics and the Cloud Monitoring dashboard. See repo-level
`CLAUDE.md` for usage.

## fetch-weekly-logs.sh

Pulls 7 days of Apps Script logs from GCP and produces a compact
`weekly-summary.json` consumed by the `/weekly-report` slash command.

### Usage

```bash
# Default: last 7 days ending today (UTC), output to /tmp/geneascript-weekly-<end>
observability/scripts/fetch-weekly-logs.sh

# Custom window
observability/scripts/fetch-weekly-logs.sh --start 2026-04-20 --end 2026-04-27

# Custom output directory
observability/scripts/fetch-weekly-logs.sh --out-dir ~/weekly-2026-04-27

# Test mode (skips gcloud, reads fixtures)
observability/scripts/fetch-weekly-logs.sh \
  --fixture-dir observability/scripts/tests/fixtures \
  --start 2026-04-20 --end 2026-04-26
```

### Requirements

- `gcloud` CLI authenticated with ADC (`gcloud auth application-default login`)
- Active project set: `gcloud config set project <geneascript-project-id>`
- `jq` 1.6+

### Output files (in `--out-dir`)

| File | Purpose |
|---|---|
| `raw-obs-gcloud.json` | Raw `gcloud logging read` response for OBS events |
| `raw-platform-gcloud.json` | Raw response for platform errors |
| `raw-obs-events.ndjson` | Parsed OBS events, one per line |
| `raw-platform-errors.ndjson` | Parsed platform errors, one per line |
| `weekly-summary.json` | Aggregated metrics consumed by the report generator |

### Tests

```bash
observability/scripts/tests/run-tests.sh
```

Runs the parsers and aggregator against handcrafted fixtures and compares
against the golden `expected-summary.json`.
