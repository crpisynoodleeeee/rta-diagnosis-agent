(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RTADataProvider = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CONTRACT_VERSION = '0.8';
  const DATA_SCOPE = 'current_rta_only';

  const ERROR_CODES = Object.freeze({
    INVALID_REQUEST: 'INVALID_REQUEST',
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    NOT_FOUND: 'NOT_FOUND',
    RATE_LIMITED: 'RATE_LIMITED',
    TIMEOUT: 'TIMEOUT',
    UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
    SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
    DATA_INSUFFICIENT: 'DATA_INSUFFICIENT',
    DATA_STALE: 'DATA_STALE',
    NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
    INTERNAL: 'INTERNAL'
  });

  const RETRYABLE_CODES = new Set([
    ERROR_CODES.RATE_LIMITED,
    ERROR_CODES.TIMEOUT,
    ERROR_CODES.UPSTREAM_UNAVAILABLE
  ]);

  class ProviderError extends Error {
    constructor(code, message, options) {
      const opts = options || {};
      super(message || code || ERROR_CODES.INTERNAL);
      this.name = 'ProviderError';
      this.code = ERROR_CODES[code] || code || ERROR_CODES.INTERNAL;
      this.retryable = opts.retryable === undefined
        ? RETRYABLE_CODES.has(this.code)
        : opts.retryable === true;
      this.providerId = opts.providerId || null;
      this.details = opts.details || null;
    }
  }

  function assertNonEmptyString(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new ProviderError(
        ERROR_CODES.INVALID_REQUEST,
        field + ' must be a non-empty string',
        { details: { field } }
      );
    }
  }

  function validateProviderRequest(request) {
    if (!request || typeof request !== 'object') {
      throw new ProviderError(ERROR_CODES.INVALID_REQUEST, 'request must be an object');
    }
    assertNonEmptyString(request.rtaId, 'request.rtaId');
    if (!request.timeRange || typeof request.timeRange !== 'object') {
      throw new ProviderError(ERROR_CODES.INVALID_REQUEST, 'request.timeRange is required');
    }
    assertNonEmptyString(request.timeRange.start, 'request.timeRange.start');
    assertNonEmptyString(request.timeRange.end, 'request.timeRange.end');
    const startTime = Date.parse(request.timeRange.start.replace(' ', 'T'));
    const endTime = Date.parse(request.timeRange.end.replace(' ', 'T'));
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
      throw new ProviderError(
        ERROR_CODES.INVALID_REQUEST,
        'request.timeRange must contain a valid start before end',
        { details: { field: 'request.timeRange' } }
      );
    }
    if (request.dataScope && request.dataScope !== DATA_SCOPE) {
      throw new ProviderError(
        ERROR_CODES.INVALID_REQUEST,
        'only current_rta_only scope is allowed',
        { details: { dataScope: request.dataScope } }
      );
    }
    return {
      rtaId: request.rtaId.trim(),
      timeRange: {
        start: request.timeRange.start,
        end: request.timeRange.end
      },
      dataScope: DATA_SCOPE,
      requestId: request.requestId || null
    };
  }

  function createProviderMeta(input) {
    const meta = input || {};
    assertNonEmptyString(meta.providerId, 'meta.providerId');
    assertNonEmptyString(meta.platform, 'meta.platform');
    assertNonEmptyString(meta.sourceRecordId, 'meta.sourceRecordId');
    assertNonEmptyString(meta.fetchedAt, 'meta.fetchedAt');
    assertNonEmptyString(meta.dataUpdatedAt, 'meta.dataUpdatedAt');
    return {
      providerId: meta.providerId,
      platform: meta.platform,
      sourceRecordId: meta.sourceRecordId,
      schemaVersion: meta.schemaVersion || CONTRACT_VERSION,
      fetchedAt: meta.fetchedAt,
      dataUpdatedAt: meta.dataUpdatedAt,
      freshnessSeconds: Number.isFinite(meta.freshnessSeconds) ? meta.freshnessSeconds : null,
      qualityStatus: meta.qualityStatus || 'ok',
      missingFields: Array.isArray(meta.missingFields) ? meta.missingFields.slice() : []
    };
  }

  function validateEnvelope(envelope) {
    const errors = [];
    if (!envelope || typeof envelope !== 'object') return { ok: false, errors: ['envelope'] };
    if (envelope.contractVersion !== CONTRACT_VERSION) errors.push('contractVersion');
    try {
      validateProviderRequest(envelope.request);
    } catch (error) {
      errors.push(error.details && error.details.field || 'request');
    }
    if (!envelope.configSnapshot || typeof envelope.configSnapshot !== 'object') errors.push('configSnapshot');
    if (!envelope.metricBundle || typeof envelope.metricBundle !== 'object') errors.push('metricBundle');
    if (!envelope.meta || typeof envelope.meta !== 'object') errors.push('meta');
    else {
      ['providerId', 'platform', 'sourceRecordId', 'schemaVersion', 'fetchedAt', 'dataUpdatedAt', 'qualityStatus']
        .forEach(function (key) {
          if (envelope.meta[key] === undefined || envelope.meta[key] === null || envelope.meta[key] === '') {
            errors.push('meta.' + key);
          }
        });
      if (envelope.meta.schemaVersion !== CONTRACT_VERSION) errors.push('meta.schemaVersion');
      if (!Array.isArray(envelope.meta.missingFields)) errors.push('meta.missingFields');
    }
    return { ok: errors.length === 0, errors: Array.from(new Set(errors)) };
  }

  class MediaDataProvider {
    constructor(options) {
      const opts = options || {};
      assertNonEmptyString(opts.providerId, 'providerId');
      assertNonEmptyString(opts.platform, 'platform');
      this.providerId = opts.providerId;
      this.platform = opts.platform;
      this.capabilities = Object.freeze({
        readOnly: true,
        dataScope: DATA_SCOPE,
        supportsConfigSnapshot: true,
        supportsMetricBundle: true
      });
    }

    async getConfigSnapshot(request) {
      validateProviderRequest(request);
      throw new ProviderError(ERROR_CODES.NOT_IMPLEMENTED, 'getConfigSnapshot is not implemented', {
        providerId: this.providerId
      });
    }

    async getMetricBundle(request) {
      validateProviderRequest(request);
      throw new ProviderError(ERROR_CODES.NOT_IMPLEMENTED, 'getMetricBundle is not implemented', {
        providerId: this.providerId
      });
    }

    async getDataEnvelope(request) {
      const normalizedRequest = validateProviderRequest(request);
      const parts = await Promise.all([
        this.getConfigSnapshot(normalizedRequest),
        this.getMetricBundle(normalizedRequest)
      ]);
      const envelope = {
        contractVersion: CONTRACT_VERSION,
        request: normalizedRequest,
        configSnapshot: parts[0].data,
        metricBundle: parts[1].data,
        meta: createProviderMeta(Object.assign({}, parts[0].meta, parts[1].meta, {
          providerId: this.providerId,
          platform: this.platform,
          missingFields: [].concat(
            parts[0].meta && parts[0].meta.missingFields || [],
            parts[1].meta && parts[1].meta.missingFields || []
          )
        }))
      };
      const validation = validateEnvelope(envelope);
      if (!validation.ok) {
        throw new ProviderError(ERROR_CODES.SCHEMA_MISMATCH, 'provider envelope is invalid', {
          providerId: this.providerId,
          details: { errors: validation.errors }
        });
      }
      return envelope;
    }
  }

  return Object.freeze({
    CONTRACT_VERSION,
    DATA_SCOPE,
    ERROR_CODES,
    ProviderError,
    MediaDataProvider,
    validateProviderRequest,
    createProviderMeta,
    validateEnvelope
  });
});
