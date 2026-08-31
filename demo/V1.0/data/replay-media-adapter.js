(function (root, factory) {
  const api = factory(root && root.RTADataProvider);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.RTADataProvider) {
    root.RTADataProvider = Object.freeze(Object.assign({}, root.RTADataProvider, api));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract) {
  'use strict';

  if (!contract || !contract.MediaDataProvider) {
    throw new Error('media-data-provider.js must load before replay-media-adapter.js');
  }

  const {
    MediaDataProvider,
    ProviderError,
    ERROR_CODES,
    validateProviderRequest,
    createProviderMeta,
    validateEnvelope,
    CONTRACT_VERSION,
    DATA_SCOPE
  } = contract;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function parseTime(value) {
    return Date.parse(String(value || '').replace(' ', 'T'));
  }

  function nowMs(clock) {
    const value = typeof clock === 'function' ? clock() : Date.now();
    return value instanceof Date ? value.getTime() : value;
  }

  function normalizeFailure(failure, providerId) {
    const detail = typeof failure === 'string' ? { code: failure } : (failure || {});
    const code = ERROR_CODES[detail.code] || ERROR_CODES.UPSTREAM_UNAVAILABLE;
    return new ProviderError(code, detail.message || ('Replay fixture failure: ' + code), {
      providerId,
      retryable: detail.retryable,
      details: detail.details || { source: 'replay_fixture' }
    });
  }

  function normalizeConfig(response) {
    const raw = response.configSnapshot || response.config || {};
    const rawRta = raw.rtaid || raw.rta || {};
    return {
      rtaid: Object.assign({}, rawRta, {
        media: rawRta.media || response.media || 'unknown',
        rtaId: rawRta.rtaId || rawRta.rta_id || response.rtaId || response.rta_id,
        rtaInternalId: rawRta.rtaInternalId || rawRta.rta_internal_id,
        bidUrl: rawRta.bidUrl || rawRta.bid_url,
        status: rawRta.status || response.status
      }),
      systemQps: clone(raw.systemQps || raw.system_qps || {}),
      boundAccounts: clone(raw.boundAccounts || raw.bound_accounts || []),
      strategies: clone(raw.strategies || []),
      experiment: clone(raw.experiment || {}),
      groups: clone(raw.groups || []),
      bucketMode: raw.bucketMode || raw.bucket_mode,
      changes: clone(raw.changes || raw.config_changes || [])
    };
  }

  function normalizeMetrics(response) {
    const raw = response.metricBundle || response.metrics || {};
    const core = raw.coreMetrics || raw.core || {};
    const usage = raw.usageMetrics || raw.usage || {};
    const budget = raw.budget || {};
    return {
      coreMetrics: clone(core),
      usageMetrics: clone(usage),
      trend: clone(raw.trend || raw.trends || []),
      logSummary: clone(raw.logSummary || raw.log_summary || {}),
      attribution: clone(raw.attribution || {}),
      budget: Object.assign({}, clone(budget), {
        dailyBudget: budget.dailyBudget === undefined ? (budget.daily_budget === undefined ? raw.daily_budget : budget.daily_budget) : budget.dailyBudget,
        actualCost: budget.actualCost === undefined ? (budget.actual_cost === undefined ? raw.actual_cost : budget.actual_cost) : budget.actualCost,
        conversionCount: budget.conversionCount === undefined ? (budget.conversion_count === undefined ? raw.conversion_count : budget.conversion_count) : budget.conversionCount,
        actualCpa: budget.actualCpa === undefined ? (budget.actual_cpa === undefined ? raw.actual_cpa : budget.actual_cpa) : budget.actualCpa,
        targetCpa: budget.targetCpa === undefined ? (budget.target_cpa === undefined ? raw.target_cpa : budget.target_cpa) : budget.targetCpa
      })
    };
  }

  class ReplayMediaAdapter extends MediaDataProvider {
    constructor(fixtures, options) {
      const opts = options || {};
      super({ providerId: opts.providerId || 'replay-v08', platform: opts.platform || 'replay' });
      if (!Array.isArray(fixtures)) {
        throw new ProviderError(ERROR_CODES.INVALID_REQUEST, 'fixtures must be an array', {
          providerId: this.providerId
        });
      }
      this.fixtures = new Map(fixtures.filter(Boolean).map(fixture => [
        fixture.rtaId || fixture.rta_id || fixture.response && (fixture.response.rtaId || fixture.response.rta_id),
        fixture
      ]));
      this.cacheTtlSeconds = Number.isFinite(opts.cacheTtlSeconds) ? Math.max(0, opts.cacheTtlSeconds) : 60;
      this.maxFreshnessSeconds = Number.isFinite(opts.maxFreshnessSeconds) ? Math.max(0, opts.maxFreshnessSeconds) : 900;
      this.stalePolicy = opts.stalePolicy === 'error' ? 'error' : 'mark';
      this.clock = opts.clock || (() => Date.now());
      this.cache = new Map();
    }

    _cacheKey(request) {
      return [request.rtaId, request.timeRange.start, request.timeRange.end, DATA_SCOPE].join('|');
    }

    _findFixture(request) {
      const fixture = this.fixtures.get(request.rtaId);
      if (!fixture) {
        throw new ProviderError(ERROR_CODES.NOT_FOUND, 'Replay fixture not found: ' + request.rtaId, {
          providerId: this.providerId,
          details: { rtaId: request.rtaId }
        });
      }
      if (fixture.failure) throw normalizeFailure(fixture.failure, this.providerId);
      return fixture;
    }

    _buildEnvelope(request, fixture, now) {
      const response = fixture.response || fixture;
      const rtaId = response.rtaId || response.rta_id || request.rtaId;
      if (rtaId !== request.rtaId) {
        throw new ProviderError(ERROR_CODES.SCHEMA_MISMATCH, 'fixture rtaId does not match request', {
          providerId: this.providerId,
          details: { requestRtaId: request.rtaId, fixtureRtaId: rtaId }
        });
      }
      const dataUpdatedAt = response.dataUpdatedAt || response.updatedAt || response.updated_at;
      const updatedMs = parseTime(dataUpdatedAt);
      if (!Number.isFinite(updatedMs)) {
        throw new ProviderError(ERROR_CODES.SCHEMA_MISMATCH, 'fixture dataUpdatedAt is invalid', {
          providerId: this.providerId,
          details: { field: 'dataUpdatedAt' }
        });
      }
      const freshnessSeconds = Math.max(0, Math.floor((now - updatedMs) / 1000));
      const isStale = freshnessSeconds > this.maxFreshnessSeconds;
      if (isStale && this.stalePolicy === 'error') {
        throw new ProviderError(ERROR_CODES.DATA_STALE, 'replay data is stale', {
          providerId: this.providerId,
          details: { freshnessSeconds, maxFreshnessSeconds: this.maxFreshnessSeconds }
        });
      }
      const meta = createProviderMeta({
        providerId: this.providerId,
        platform: this.platform,
        sourceRecordId: response.sourceRecordId || response.source_record_id || 'replay:' + rtaId,
        schemaVersion: CONTRACT_VERSION,
        fetchedAt: new Date(now).toISOString(),
        dataUpdatedAt,
        freshnessSeconds,
        qualityStatus: isStale ? 'stale' : (response.qualityStatus || response.quality_status || 'ok'),
        missingFields: response.missingFields || response.missing_fields || []
      });
      meta.cacheHit = false;
      if (isStale) meta.staleReason = 'freshness_exceeded';
      const envelope = {
        contractVersion: CONTRACT_VERSION,
        request: clone(request),
        configSnapshot: normalizeConfig(Object.assign({}, response, { rtaId })),
        metricBundle: normalizeMetrics(response),
        meta
      };
      const validation = validateEnvelope(envelope);
      if (!validation.ok) {
        throw new ProviderError(ERROR_CODES.SCHEMA_MISMATCH, 'normalized replay envelope is invalid', {
          providerId: this.providerId,
          details: { errors: validation.errors }
        });
      }
      return envelope;
    }

    _load(request) {
      const normalized = validateProviderRequest(request);
      const key = this._cacheKey(normalized);
      const now = nowMs(this.clock);
      const cached = this.cache.get(key);
      if (cached && cached.expiresAt > now) {
        const value = clone(cached.envelope);
        value.meta.cacheHit = true;
        return value;
      }
      const envelope = this._buildEnvelope(normalized, this._findFixture(normalized), now);
      this.cache.set(key, { envelope: clone(envelope), expiresAt: now + this.cacheTtlSeconds * 1000 });
      return envelope;
    }

    getDataEnvelope(request) {
      return this._load(request);
    }

    getDataEnvelopeSafe(request) {
      try {
        return { status: 'ok', data: this.getDataEnvelope(request) };
      } catch (error) {
        const typed = error instanceof ProviderError
          ? error
          : new ProviderError(ERROR_CODES.INTERNAL, error.message, { providerId: this.providerId });
        return {
          status: 'degraded',
          error: {
            code: typed.code,
            message: typed.message,
            retryable: typed.retryable,
            providerId: typed.providerId,
            details: typed.details
          }
        };
      }
    }

    getConfigSnapshot(request) {
      const envelope = this._load(request);
      return { data: clone(envelope.configSnapshot), meta: clone(envelope.meta) };
    }

    getMetricBundle(request) {
      const envelope = this._load(request);
      return { data: clone(envelope.metricBundle), meta: clone(envelope.meta) };
    }

    clearCache() {
      this.cache.clear();
    }
  }

  return { ReplayMediaAdapter };
});
