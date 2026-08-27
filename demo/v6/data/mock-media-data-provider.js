(function (root, factory) {
  const api = factory(root && root.RTADataProvider);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.RTADataProvider) {
    root.RTADataProvider = Object.freeze(Object.assign({}, root.RTADataProvider, api));
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract) {
  'use strict';

  if (!contract || !contract.MediaDataProvider) {
    throw new Error('media-data-provider.js must load before mock-media-data-provider.js');
  }

  const {
    MediaDataProvider,
    ProviderError,
    ERROR_CODES,
    validateProviderRequest,
    createProviderMeta
  } = contract;

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function makeNotFound(providerId, rtaId) {
    return new ProviderError(ERROR_CODES.NOT_FOUND, 'RTA record not found: ' + rtaId, {
      providerId,
      details: { rtaId }
    });
  }

  class MockMediaDataProvider extends MediaDataProvider {
    constructor(records) {
      super({ providerId: 'mock-v08', platform: 'mock' });
      if (!Array.isArray(records)) {
        throw new ProviderError(ERROR_CODES.INVALID_REQUEST, 'records must be an array', {
          providerId: this.providerId
        });
      }
      this.records = new Map(records.filter(Boolean).map(record => [record.rtaId, record]));
    }

    listRecords() {
      return Array.from(this.records.values()).map(clone);
    }

    getRecord(rtaId) {
      const record = this.records.get(rtaId);
      return record ? clone(record) : null;
    }

    _get(request) {
      const normalized = validateProviderRequest(request);
      const record = this.records.get(normalized.rtaId);
      if (!record) throw makeNotFound(this.providerId, normalized.rtaId);
      return { normalized, record };
    }

    _meta(record) {
      const updatedAt = record.dataUpdatedAt || '2026-08-14 13:30:00';
      return createProviderMeta({
        providerId: this.providerId,
        platform: this.platform,
        sourceRecordId: 'mock:' + record.rtaId,
        fetchedAt: updatedAt,
        dataUpdatedAt: updatedAt,
        freshnessSeconds: 0,
        qualityStatus: 'ok',
        missingFields: []
      });
    }

    getConfigSnapshot(request) {
      const { normalized, record } = this._get(request);
      return {
        data: {
          rtaid: {
            media: record.media,
            rtaId: record.rtaId,
            rtaInternalId: record.rtaInternalId,
            bidUrl: record.bidUrl,
            status: record.status,
            qpsConfig: record.qpsConfig,
            qpsUsed: record.qpsUsed,
            qpsRemaining: record.qpsRemaining
          },
          systemQps: { systemQpsLimit: record.qpsConfig, allocatedQps: record.qpsConfig },
          boundAccounts: record.boundAccounts,
          strategies: clone(record.strategies || []),
          experiment: clone(record.experiment),
          groups: clone(record.groups || []),
          bucketMode: record.bucketMode,
          changes: clone(record.changes || [])
        },
        meta: Object.assign(this._meta(record), { request: normalized })
      };
    }

    getMetricBundle(request) {
      const { normalized, record } = this._get(request);
      const budget = Object.assign({}, clone(record.budget || {}), {
        dailyBudget: record.dailyBudget,
        actualCost: record.actualCost,
        conversionCount: record.conversionCount,
        actualCpa: record.actualCpa,
        targetCpa: record.targetCpa
      });
      return {
        data: {
          coreMetrics: clone(record.coreMetrics),
          usageMetrics: clone(record.usageMetrics),
          trend: clone(record.trend || []),
          logSummary: clone(record.logSummary || {}),
          attribution: clone(record.attribution || {}),
          budget
        },
        meta: Object.assign(this._meta(record), { request: normalized })
      };
    }
  }

  return { MockMediaDataProvider };
});
