'use strict';

const fs = require('fs');
const crypto = require('crypto');
const RESULTS = new Set(['success', 'stale', 'partial', 'insufficient', 'failure']);
const INTERFACES = new Set(['getConfigSnapshot', 'getMetricBundle', 'getDataEnvelope']);
const ERRORS = new Set(['INVALID_REQUEST','AUTH_REQUIRED','PERMISSION_DENIED','NOT_FOUND','RATE_LIMITED','TIMEOUT','UPSTREAM_UNAVAILABLE','SCHEMA_MISMATCH','DATA_INSUFFICIENT','DATA_STALE','NOT_IMPLEMENTED','INTERNAL']);
const FIELDS = ['caller','provider','interface','rta','time','durationMs','result','errorType'];
let sink = null;

function setAuditSink(writer) { sink = writer || null; }
function rtaId(value, salt = process.env.AUDIT_RTA_SALT || 'v09-audit') {
  return 'sha256:' + crypto.createHash('sha256').update(String(salt) + ':' + String(value)).digest('hex').slice(0, 12);
}
function terminalResult(value) { return RESULTS.has(value) ? value : 'failure'; }
function terminalError(value) { return value == null ? null : (ERRORS.has(value) ? value : 'INTERNAL'); }
function makeEntry(input = {}) {
  const d = Number.isFinite(input.durationMs) ? Math.max(0, Math.floor(input.durationMs)) : 0;
  const t = input.time || new Date().toISOString();
  return { caller: String(input.caller || 'unknown'), provider: String(input.provider || 'unknown'), interface: INTERFACES.has(input.interface) ? input.interface : 'getDataEnvelope', rta: String(input.rta || rtaId('unknown')), time: new Date(t).toISOString(), durationMs: d, result: terminalResult(input.result), errorType: terminalError(input.errorType) };
}
function recordCall(input) {
  const entry = makeEntry(input);
  const line = JSON.stringify(entry) + '\n';
  try {
    if (sink) sink(line, entry);
    else if (process.env.AUDIT_LOG_PATH) fs.appendFileSync(process.env.AUDIT_LOG_PATH, line, { encoding: 'utf8' });
    return entry;
  } catch (_) { return null; }
}
module.exports = { RESULTS, INTERFACES, ERROR_TYPES: ERRORS, setAuditSink, rtaId, terminalResult, makeEntry, recordCall };
