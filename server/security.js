'use strict';

const crypto = require('node:crypto');

const ERROR_CODES = Object.freeze({ AUTH_REQUIRED: 'AUTH_REQUIRED', INVALID_REQUEST: 'INVALID_REQUEST', PERMISSION_DENIED: 'PERMISSION_DENIED' });
const SECRET_KEY = /^(authorization|token|api[_-]?token|secret(?:key)?|secret[_-]?key|cookie|set[_-]?cookie|signature|sign(?:ature)?|access[_-]?token|refresh[_-]?token)$/i;
const ENV_NAMES = ['STAGING_API_BASE_URL','STAGING_API_TOKEN','STAGING_PROVIDER_ID','STAGING_PLATFORM','STAGING_HTTP_TIMEOUT_MS','STAGING_OVERALL_TIMEOUT_MS','STAGING_MAX_CONCURRENCY','STAGING_RATE_LIMIT_RPS','STAGING_MAX_RETRIES'];

class SecurityError extends Error { constructor(code, message, details) { super(message); this.name = 'SecurityError'; this.code = code; this.retryable = false; if (details) this.details = details; } }
function fail(code, message, details) { throw new SecurityError(code, message, details); }

function validateBaseUrl(value, approvedHosts = []) {
  let u; try { u = new URL(value); } catch (_) { fail(ERROR_CODES.INVALID_REQUEST, 'STAGING_API_BASE_URL must be a valid HTTPS URL'); }
  if (u.protocol !== 'https:') fail(ERROR_CODES.INVALID_REQUEST, 'STAGING_API_BASE_URL must use HTTPS');
  if (u.username || u.password || u.search || u.hash) fail(ERROR_CODES.INVALID_REQUEST, 'STAGING_API_BASE_URL must not contain credentials, query, or fragment');
  if (!Array.isArray(approvedHosts) || !approvedHosts.length || !approvedHosts.some(h => String(h).toLowerCase() === u.hostname.toLowerCase())) fail(ERROR_CODES.INVALID_REQUEST, 'STAGING_API_BASE_URL host is not approved');
  return u.origin + (u.pathname === '/' ? '' : u.pathname.replace(/\/$/, ''));
}
function positive(name, raw, integer = true, allowZero = false) { const n = Number(raw); if (!Number.isFinite(n) || (allowZero ? n < 0 : n <= 0) || (integer && !Number.isInteger(n))) fail(ERROR_CODES.INVALID_REQUEST, `${name} must be a ${allowZero ? 'non-negative' : 'positive'} ${integer ? 'integer' : 'number'}`); return n; }
function readCredentials(env = process.env, options = {}) {
  const token = String(env.STAGING_API_TOKEN || '').trim(); if (!token) fail(ERROR_CODES.AUTH_REQUIRED, 'STAGING_API_TOKEN is required');
  const baseUrl = validateBaseUrl(env.STAGING_API_BASE_URL, options.approvedHosts || []);
  const httpTimeout = positive('STAGING_HTTP_TIMEOUT_MS', env.STAGING_HTTP_TIMEOUT_MS);
  const overallTimeout = positive('STAGING_OVERALL_TIMEOUT_MS', env.STAGING_OVERALL_TIMEOUT_MS);
  if (overallTimeout < httpTimeout) fail(ERROR_CODES.INVALID_REQUEST, 'STAGING_OVERALL_TIMEOUT_MS must be at least the HTTP timeout');
  return Object.freeze({ baseUrl, token, providerId: String(env.STAGING_PROVIDER_ID || '').trim() || fail(ERROR_CODES.INVALID_REQUEST, 'STAGING_PROVIDER_ID is required'), platform: String(env.STAGING_PLATFORM || '').trim() || fail(ERROR_CODES.INVALID_REQUEST, 'STAGING_PLATFORM is required'), httpTimeoutMs: httpTimeout, overallTimeoutMs: overallTimeout, maxConcurrency: positive('STAGING_MAX_CONCURRENCY', env.STAGING_MAX_CONCURRENCY), rateLimitRps: positive('STAGING_RATE_LIMIT_RPS', env.STAGING_RATE_LIMIT_RPS, false), maxRetries: positive('STAGING_MAX_RETRIES', env.STAGING_MAX_RETRIES, true, true) });
}
function requireCurrentRta(request) {
  if (!request || typeof request !== 'object' || typeof request.rtaId !== 'string' || !request.rtaId || request.dataScope !== 'current_rta_only' || !request.timeRange || request.timeRange.start >= request.timeRange.end || request.accountId || request.accountIds || request.rtaIds || request.tenantIds) fail(ERROR_CODES.INVALID_REQUEST, 'only one current RTA and an explicit time range are permitted');
  if (request.method && /^(post|put|patch|delete)$/i.test(request.method)) fail(ERROR_CODES.PERMISSION_DENIED, 'write operations are not permitted');
  return true;
}
function shortHash(value, salt = process.env.STAGING_MASK_SALT || 'v09-controlled-environment-salt') { return 'sha256:' + crypto.createHash('sha256').update(String(salt) + '\0' + String(value)).digest('hex').slice(0, 12); }
function maskIdentifier(value) { const s = String(value); return s.length < 6 ? '*'.repeat(s.length) : s.slice(0, 2) + '*'.repeat(s.length - 4) + s.slice(-2); }
function maskUrl(value) { try { const u = new URL(value); return u.origin + u.pathname; } catch (_) { return '[MASKED_URL]'; } }
const ALLOWED = new Set(['accountId','advertiserId','accountName','agencyName','operator','rtaId','bidUrl','projectName','campaignName','unitName','creativeName','strategyName','experimentName','projectId','campaignId','unitId','creativeId','strategyId','experimentId','phone','mobile','oaid','idfa','caid','imei','deviceId','dailyBudget','actualCost','controlGroupCost','treatmentGroupCost','cpa','cpc']);
function maskObject(input, parent = '') {
  if (Array.isArray(input)) return input.map(x => maskObject(x, parent));
  if (!input || typeof input !== 'object') return input;
  const out = {};
  for (const [key, value] of Object.entries(input)) {
    if (SECRET_KEY.test(key)) continue;
    const canonical = key.replace(/[-_]/g, '').toLowerCase();
    if (!ALLOWED.has(key) && !['accountid','advertiserid','accountname','agencyname','operator','bidurl','phone','mobile','oaid','idfa','caid','imei','deviceid','dailybudget','actualcost','controlgroupcost','treatmentgroupcost','cpa','cpc'].includes(canonical)) {
      if (value && typeof value === 'object') { const nested = maskObject(value, key); if (Object.keys(nested).length) out[key] = nested; }
      continue;
    }
    if (/accountid|advertiserid/i.test(key)) out[key] = maskIdentifier(value);
    else if (/accountname/i.test(key)) out[key] = '[MASKED_ACCOUNT]'; else if (/agencyname/i.test(key)) out[key] = '[MASKED_AGENCY]';
    else if (/operator/i.test(key)) out[key] = value ? String(value).charAt(0) + '***' : value;
    else if (/phone|mobile|oaid|idfa|caid|imei|deviceid/i.test(key)) out[key] = value == null || value === '' ? { present: false } : shortHash(value);
    else if (/bidurl/i.test(key)) out[key] = maskUrl(value);
    else if (/budget|cost|^cpa$|^cpc$/i.test(key)) out[key] = '[REDACTED_AMOUNT]';
    else if (/name|id/i.test(key) && /project|campaign|unit|creative|strategy|experiment/i.test(key)) out[key] = /id/i.test(key) ? maskIdentifier(value) : key.replace(/Name$/i, '') + ':' + shortHash(value).slice(-8);
    else out[key] = maskObject(value, key);
  } return out;
}
function authOutcome(statusOrCode) { const s = String(statusOrCode).toUpperCase(); return { code: s === '401' || s === 'AUTH_REQUIRED' ? ERROR_CODES.AUTH_REQUIRED : ERROR_CODES.PERMISSION_DENIED, retryable: false }; }
function rotationRecord({ rotatedBy, rotatedAt = new Date().toISOString(), token, tokenVersion, scope, validation }) { return { rotatedBy, rotatedAt, credentialFingerprint: shortHash(tokenVersion || token || 'unknown'), scope, validation }; }
module.exports = { ENV_NAMES, ERROR_CODES, SecurityError, readCredentials, validateBaseUrl, requireCurrentRta, maskIdentifier, maskObject, shortHash, authOutcome, rotationRecord, isSecretKey: key => SECRET_KEY.test(key) };
