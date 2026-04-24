/**
 * Shared observability helpers for structured telemetry events.
 * Kept in a separate file to reduce noise in core business flows.
 */

/** Prefix for machine-parseable structured observability logs. */
var OBS_EVENT_PREFIX = 'OBS:';
var OBS_USER_KEY_CACHE = null;

/** Emits a structured observability log line while keeping existing human-readable logs. */
function logObsEvent(eventName, payload) {
  var data = payload || {};
  data.event = eventName;
  if (!data.ts) data.ts = new Date().toISOString();
  if (!data.userKey) data.userKey = getObsUserKey();
  Logger.log(OBS_EVENT_PREFIX + JSON.stringify(data));
}

/** Returns a privacy-safe stable key for user-level observability. */
function getObsUserKey() {
  if (OBS_USER_KEY_CACHE) return OBS_USER_KEY_CACHE;
  try {
    var tmpKey = Session.getTemporaryActiveUserKey();
    OBS_USER_KEY_CACHE = tmpKey ? hashId(tmpKey) : 'unknown_user';
  } catch (_e) {
    OBS_USER_KEY_CACHE = 'unknown_user';
  }
  return OBS_USER_KEY_CACHE;
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
  var codeFromText = null;
  var m = String(errorMessage || '').match(/\(HTTP\s+(\d{3})\)/i);
  if (m) codeFromText = parseInt(m[1], 10);
  var effectiveCode = httpCode || codeFromText;
  if (effectiveCode === 503 || msg.indexOf('overloaded') !== -1 || msg.indexOf('experiencing high demand') !== -1) return 'API_OVERLOADED';
  if (effectiveCode === 429 || msg.indexOf('quota') !== -1 || msg.indexOf('rate') !== -1) return 'API_RATE_LIMIT';
  if (msg.indexOf('api key not valid') !== -1 || msg.indexOf('api_key_invalid') !== -1) return 'API_KEY_INVALID';
  if (msg.indexOf('has not been used in project') !== -1) return 'API_NOT_ENABLED';
  if (msg.indexOf('project has been denied access') !== -1) return 'API_PROJECT_DENIED';
  if (msg.indexOf('authorisation is required') !== -1 || msg.indexOf('authorization is required') !== -1) return 'AUTH_REQUIRED';
  if (msg.indexOf('no candidates returned') !== -1) return 'API_EMPTY_CANDIDATES';
  if (msg.indexOf('no image found') !== -1) return 'DOC_IMAGE_NOT_FOUND';
  if (msg.indexOf('select') !== -1 && msg.indexOf('image') !== -1) return 'DOC_SELECTION_INVALID';
  if (msg.indexOf('access not configured') !== -1 || msg.indexOf('not enabled') !== -1) return 'DRIVE_API_DISABLED';
  if (msg.indexOf('access denied') !== -1) return 'DRIVE_ACCESS_DENIED';
  if (effectiveCode && effectiveCode >= 400) return 'API_HTTP_ERROR';
  return 'UNKNOWN';
}

/** Trims and sanitizes error strings for safe telemetry logging. */
function sanitizeErrorMessage(error) {
  var msg = String(error || '');
  if (msg.length > 300) msg = msg.substring(0, 300);
  return msg;
}

/** Pricing version used for estimated Gemini token-cost telemetry. */
var GEMINI_PRICING_VERSION = 'gemini-dev-api-2026-04-21';

/**
 * Returns paid-tier USD rates per 1M tokens for supported models.
 * Assumes paid-tier Standard pricing (user-tier is not distinguishable at runtime).
 * Pro rates use the <=200k prompt tier; image+context prompts in this app stay well under that.
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 */
function getModelTokenPricingUsdPerMillion(modelId) {
  switch (modelId) {
    case 'gemini-flash-latest':
      return { inputUsdPerMillion: 0.5, outputUsdPerMillion: 3.0 };
    case 'gemini-3.1-pro-preview':
      return { inputUsdPerMillion: 2.0, outputUsdPerMillion: 12.0 };
    case 'gemini-3.1-flash-lite-preview':
      return { inputUsdPerMillion: 0.25, outputUsdPerMillion: 1.5 };
    default:
      return null;
  }
}

/** Returns estimated USD cost from token usage for known priced models. */
function estimateGeminiCostUsd(modelId, promptTokens, outputTokens) {
  var pricing = getModelTokenPricingUsdPerMillion(modelId);
  if (!pricing) return null;
  if (typeof promptTokens !== 'number' || typeof outputTokens !== 'number') return null;
  var inputCost = (promptTokens / 1000000) * pricing.inputUsdPerMillion;
  var outputCost = (outputTokens / 1000000) * pricing.outputUsdPerMillion;
  return Number((inputCost + outputCost).toFixed(8));
}
