/**
 * Shared observability helpers for structured telemetry events.
 * Kept in a separate file to reduce noise in core business flows.
 */

/** Prefix for machine-parseable structured observability logs. */
var OBS_EVENT_PREFIX = 'OBS:';

/** Emits a structured observability log line while keeping existing human-readable logs. */
function logObsEvent(eventName, payload) {
  var data = payload || {};
  data.event = eventName;
  if (!data.ts) data.ts = new Date().toISOString();
  Logger.log(OBS_EVENT_PREFIX + JSON.stringify(data));
}

/** Creates a short run id for correlating multiple events in one operation. */
function createRunId(prefix) {
  var p = prefix || 'run';
  var rand = Math.floor(Math.random() * 0xFFFFFF).toString(16);
  return p + '_' + Date.now() + '_' + rand;
}

/** Hashes an identifier so dashboards can correlate without storing raw IDs. */
function hashId(value) {
  if (!value) return null;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value));
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    var s = b.toString(16);
    if (s.length === 1) s = '0' + s;
    hex += s;
  }
  return 'sha256:' + hex.substring(0, 16);
}

/** Normalizes low-level errors into a small stable taxonomy. */
function classifyErrorCode(errorMessage, httpCode) {
  var msg = String(errorMessage || '').toLowerCase();
  if (httpCode === 429 || msg.indexOf('quota') !== -1 || msg.indexOf('rate') !== -1) return 'API_RATE_LIMIT';
  if (httpCode && httpCode >= 400) return 'API_HTTP_ERROR';
  if (msg.indexOf('authorisation is required') !== -1 || msg.indexOf('authorization is required') !== -1) return 'AUTH_REQUIRED';
  if (msg.indexOf('no candidates returned') !== -1) return 'API_EMPTY_CANDIDATES';
  if (msg.indexOf('no image found') !== -1) return 'DOC_IMAGE_NOT_FOUND';
  if (msg.indexOf('select') !== -1 && msg.indexOf('image') !== -1) return 'DOC_SELECTION_INVALID';
  if (msg.indexOf('access not configured') !== -1 || msg.indexOf('not enabled') !== -1) return 'DRIVE_API_DISABLED';
  if (msg.indexOf('access denied') !== -1) return 'DRIVE_ACCESS_DENIED';
  return 'UNKNOWN';
}

/** Trims and sanitizes error strings for safe telemetry logging. */
function sanitizeErrorMessage(error) {
  var msg = String(error || '');
  if (msg.length > 300) msg = msg.substring(0, 300);
  return msg;
}
