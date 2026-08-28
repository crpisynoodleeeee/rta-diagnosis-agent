'use strict';
const ALLOWED_LABELS = new Set(['provider','interface','platform','result','errorType']);
const RESULTS = ['success','stale','partial','insufficient','failure'];
let state;
function reset() { state = { calls: 0, results: Object.fromEntries(RESULTS.map(x => [x, 0])), durations: [], timeouts: 0, rateLimited: 0, retries: 0, auth: 0, permission: 0, missingFields: 0 }; }
reset();
function labels(input = {}) { const out = {}; for (const k of ALLOWED_LABELS) if (input[k] !== undefined) out[k] = String(input[k]); return out; }
function recordResult(x = {}) {
  const result = RESULTS.includes(x.result) ? x.result : (x.errorType ? 'failure' : 'success'); state.calls++; state.results[result]++;
  if (Number.isFinite(x.durationMs)) state.durations.push(Math.max(0, Math.floor(x.durationMs)));
  if (x.errorType === 'TIMEOUT') state.timeouts++; if (x.errorType === 'RATE_LIMITED') { state.rateLimited++; }
  if (x.errorType === 'AUTH_REQUIRED') state.auth++; if (x.errorType === 'PERMISSION_DENIED') state.permission++;
  const n = Array.isArray(x.missingFields) ? x.missingFields.length : Number(x.missingFields || 0); state.missingFields += Number.isFinite(n) ? Math.max(0, n) : 0;
  return snapshot();
}
function recordRetry(errorType) { state.retries++; if (errorType === 'RATE_LIMITED') state.rateLimited++; return state.retries; }
function percentile(a, p) { if (!a.length) return 0; const s = [...a].sort((x,y)=>x-y), i = (s.length - 1) * p, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); }
function snapshot() { const total = state.calls || 0; return { labels: [...ALLOWED_LABELS], callsTotal: total, successRate: total ? state.results.success / total : 0, usableRate: total ? (state.results.success + state.results.partial) / total : 0, providerCallsTotal: {...state.results}, providerDurationMs: { count: state.durations.length, p50: percentile(state.durations,.5), p95: percentile(state.durations,.95), p99: percentile(state.durations,.99) }, timeout: { count: state.timeouts, rate: total ? state.timeouts / total : 0 }, rateLimited: state.rateLimited, retries: state.retries, permission: { authRequired: state.auth, permissionDenied: state.permission }, quality: {...state.results}, missingFieldsCount: state.missingFields }; }
module.exports = { ALLOWED_LABELS, reset, labels, recordResult, recordRetry, snapshot };
