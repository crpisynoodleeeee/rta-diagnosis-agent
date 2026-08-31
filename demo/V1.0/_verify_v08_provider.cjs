const assert = require('assert');
const {
  CONTRACT_VERSION,
  DATA_SCOPE,
  ERROR_CODES,
  ProviderError,
  MediaDataProvider,
  validateProviderRequest,
  createProviderMeta,
  validateEnvelope
} = require('./data/media-data-provider.js');
const { MockMediaDataProvider } = require('./data/mock-media-data-provider.js');
const { ReplayMediaAdapter } = require('./data/replay-media-adapter.js');
const { createReadOnlyToolRunner, toolNameForIntent, isAllowedTool } = require('./data/readonly-query-tools.js');
const fs = require('fs');
const path = require('path');

let passed = 0;

function check(name, fn) {
  try {
    fn();
    passed++;
    console.log('  PASS ' + name);
  } catch (error) {
    console.error('  FAIL ' + name + ': ' + error.message);
    process.exitCode = 1;
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    passed++;
    console.log('  PASS ' + name);
  } catch (error) {
    console.error('  FAIL ' + name + ': ' + error.message);
    process.exitCode = 1;
  }
}

const request = {
  rtaId: 'juliang-rta-2086',
  timeRange: { start: '2026-08-14 00:00:00', end: '2026-08-14 13:30:00' }
};

function requestFor(rtaId) {
  return { rtaId, timeRange: { start: '2026-08-27 00:00:00', end: '2026-08-27 01:00:00' } };
}

const meta = {
  providerId: 'mock-v08',
  platform: 'mock',
  sourceRecordId: 'mock:juliang-rta-2086',
  fetchedAt: '2026-08-14 13:30:00',
  dataUpdatedAt: '2026-08-14 13:30:00',
  freshnessSeconds: 0,
  qualityStatus: 'ok',
  missingFields: []
};

const mockRecord = {
  rtaId: 'mock-rta-001',
  rtaInternalId: 'RTA-RES-001',
  media: 'mock',
  bidUrl: 'https://mock.invalid/rta/001',
  status: '上线',
  qpsConfig: 1000,
  qpsUsed: 100,
  qpsRemaining: 900,
  boundAccounts: 1,
  experiment: { id: 'EXP-MOCK-001' },
  groups: [{ groupId: 'G-C', groupType: 'control', buckets: [1] }, { groupId: 'G-T', groupType: 'treatment', buckets: [2] }],
  bucketMode: 'platform',
  changes: [],
  strategies: [],
  coreMetrics: { currentQps: 100 },
  usageMetrics: { totalRequests: 1000 },
  trend: [],
  attribution: { callbackSuccessRate: 0.99 },
  budget: { dailyBudget: 100, actualCost: 80 },
  dailyBudget: 100,
  actualCost: 80,
  conversionCount: 4,
  actualCpa: 20,
  targetCpa: 25
};

let replayNow = Date.parse('2026-08-27T00:00:10.000Z');
const replayFixture = {
  response: {
    rta_id: 'replay-rta-001',
    source_record_id: 'media-replay:001',
    updated_at: '2026-08-27T00:00:00.000Z',
    config: {
      rtaid: { media: 'replay-media', rta_id: 'replay-rta-001', rta_internal_id: 'RTA-REPLAY-001', status: '上线' },
      groups: [{ groupId: 'G-C', groupType: 'control' }, { groupId: 'G-T', groupType: 'treatment' }],
      config_changes: [{ time: '2026-08-27 00:00', field: '准入门槛', before: '40%', after: '60%' }]
    },
    metrics: {
      core: { currentQps: 42 },
      usage: { totalRequests: 900 },
      budget: { daily_budget: 100, actual_cost: 80, actual_cpa: 20, target_cpa: 25 },
      trends: [{ time: '00:00', bidRate: 0.6 }, { time: '00:10', bidRate: 0.5 }]
    }
  }
};

class TestProvider extends MediaDataProvider {
  constructor() {
    super({ providerId: 'mock-v08', platform: 'mock' });
  }

  async getConfigSnapshot(input) {
    validateProviderRequest(input);
    return {
      data: { rtaid: { rtaId: input.rtaId }, experiment: {}, groups: [] },
      meta
    };
  }

  async getMetricBundle(input) {
    validateProviderRequest(input);
    return {
      data: { coreMetrics: {}, usageMetrics: {}, budget: {} },
      meta
    };
  }
}

console.log('V0.8 MediaDataProvider contract verification');

check('contract version is 0.8', () => assert.strictEqual(CONTRACT_VERSION, '0.8'));
check('scope is current RTA only', () => assert.strictEqual(DATA_SCOPE, 'current_rta_only'));
check('error codes are immutable', () => assert.strictEqual(Object.isFrozen(ERROR_CODES), true));
check('valid request is normalized', () => {
  const normalized = validateProviderRequest(request);
  assert.strictEqual(normalized.rtaId, request.rtaId);
  assert.strictEqual(normalized.dataScope, DATA_SCOPE);
});
check('missing rtaId is rejected', () => {
  assert.throws(() => validateProviderRequest({ timeRange: request.timeRange }), error => {
    return error instanceof ProviderError && error.code === ERROR_CODES.INVALID_REQUEST;
  });
});
check('cross-scope request is rejected', () => {
  assert.throws(() => validateProviderRequest(Object.assign({}, request, { dataScope: 'account_wide' })), error => {
    return error instanceof ProviderError && error.code === ERROR_CODES.INVALID_REQUEST;
  });
});
check('reversed time range is rejected', () => {
  assert.throws(() => validateProviderRequest({
    rtaId: request.rtaId,
    timeRange: { start: request.timeRange.end, end: request.timeRange.start }
  }), error => error instanceof ProviderError && error.code === ERROR_CODES.INVALID_REQUEST);
});
check('provider metadata keeps source and quality fields', () => {
  const result = createProviderMeta(meta);
  assert.strictEqual(result.sourceRecordId, meta.sourceRecordId);
  assert.strictEqual(result.schemaVersion, CONTRACT_VERSION);
  assert.deepStrictEqual(result.missingFields, []);
});
check('retryability follows normalized error code', () => {
  assert.strictEqual(new ProviderError(ERROR_CODES.TIMEOUT).retryable, true);
  assert.strictEqual(new ProviderError(ERROR_CODES.PERMISSION_DENIED).retryable, false);
});
check('base provider is read-only', () => {
  const provider = new MediaDataProvider({ providerId: 'base', platform: 'mock' });
  assert.strictEqual(provider.capabilities.readOnly, true);
  assert.strictEqual(provider.capabilities.dataScope, DATA_SCOPE);
  assert.strictEqual(Object.isFrozen(provider.capabilities), true);
});
check('invalid envelope reports contract fields', () => {
  const result = validateEnvelope({ contractVersion: '0.7' });
  assert.strictEqual(result.ok, false);
  assert(result.errors.includes('contractVersion'));
  assert(result.errors.includes('configSnapshot'));
  assert(result.errors.includes('metricBundle'));
});
check('envelope rejects stale provider schema', () => {
  const result = validateEnvelope({
    contractVersion: CONTRACT_VERSION,
    request,
    configSnapshot: {},
    metricBundle: {},
    meta: Object.assign({}, createProviderMeta(meta), { schemaVersion: '0.7' })
  });
  assert.strictEqual(result.ok, false);
  assert(result.errors.includes('meta.schemaVersion'));
});
check('mock provider lists isolated records', () => {
  const provider = new MockMediaDataProvider([mockRecord]);
  const listed = provider.listRecords();
  assert.strictEqual(listed.length, 1);
  listed[0].rtaId = 'changed';
  assert.strictEqual(provider.getRecord(mockRecord.rtaId).rtaId, mockRecord.rtaId);
});
check('mock provider normalizes config snapshot', () => {
  const result = new MockMediaDataProvider([mockRecord]).getConfigSnapshot({
    rtaId: mockRecord.rtaId,
    timeRange: request.timeRange
  });
  assert.strictEqual(result.data.rtaid.rtaId, mockRecord.rtaId);
  assert.strictEqual(result.data.groups.length, 2);
  assert.strictEqual(result.meta.sourceRecordId, 'mock:' + mockRecord.rtaId);
});
check('mock provider normalizes metric bundle and CPA', () => {
  const result = new MockMediaDataProvider([mockRecord]).getMetricBundle({
    rtaId: mockRecord.rtaId,
    timeRange: request.timeRange
  });
  assert.strictEqual(result.data.budget.actualCpa, 20);
  assert.strictEqual(result.data.budget.targetCpa, 25);
  assert.strictEqual(result.data.coreMetrics.currentQps, 100);
});
check('mock provider missing record is typed', () => {
  assert.throws(() => new MockMediaDataProvider([mockRecord]).getConfigSnapshot({
    rtaId: 'missing', timeRange: request.timeRange
  }), error => error instanceof ProviderError && error.code === ERROR_CODES.NOT_FOUND);
});
check('demo loads both provider scripts and uses provider record hook', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(html.includes('src="./data/media-data-provider.js"'));
  assert(html.includes('src="./data/mock-media-data-provider.js"'));
  assert(html.includes('new PROVIDER_API.MockMediaDataProvider(MOCK_RTA_LIST)'));
  assert(html.includes('record = getProviderRecord(record);'));
});
check('replay adapter normalizes media-shaped response', () => {
  const adapter = new ReplayMediaAdapter([replayFixture], { clock: () => replayNow });
  const envelope = adapter.getDataEnvelope(requestFor('replay-rta-001'));
  assert.strictEqual(envelope.configSnapshot.rtaid.rtaId, 'replay-rta-001');
  assert.strictEqual(envelope.metricBundle.coreMetrics.currentQps, 42);
  assert.strictEqual(envelope.metricBundle.budget.actualCost, 80);
  assert.strictEqual(envelope.meta.sourceRecordId, 'media-replay:001');
  assert.strictEqual(envelope.meta.qualityStatus, 'ok');
});
check('replay adapter serves cache hits within TTL', () => {
  const adapter = new ReplayMediaAdapter([replayFixture], { clock: () => replayNow, cacheTtlSeconds: 60 });
  assert.strictEqual(adapter.getDataEnvelope(requestFor('replay-rta-001')).meta.cacheHit, false);
  assert.strictEqual(adapter.getDataEnvelope(requestFor('replay-rta-001')).meta.cacheHit, true);
});
check('replay adapter reloads after cache expiry', () => {
  const adapter = new ReplayMediaAdapter([replayFixture], { clock: () => replayNow, cacheTtlSeconds: 60 });
  adapter.getDataEnvelope(requestFor('replay-rta-001'));
  replayNow += 61000;
  replayFixture.response.metrics.core.currentQps = 84;
  const envelope = adapter.getDataEnvelope(requestFor('replay-rta-001'));
  assert.strictEqual(envelope.meta.cacheHit, false);
  assert.strictEqual(envelope.metricBundle.coreMetrics.currentQps, 84);
  replayFixture.response.metrics.core.currentQps = 42;
  replayNow -= 61000;
});
check('stale replay data is marked for downstream degradation', () => {
  const adapter = new ReplayMediaAdapter([replayFixture], {
    clock: () => replayNow + 901000,
    maxFreshnessSeconds: 900
  });
  const envelope = adapter.getDataEnvelope(requestFor('replay-rta-001'));
  assert.strictEqual(envelope.meta.qualityStatus, 'stale');
  assert(envelope.meta.freshnessSeconds > 900);
});
check('strict stale policy returns DATA_STALE', () => {
  const adapter = new ReplayMediaAdapter([replayFixture], {
    clock: () => replayNow + 901000,
    maxFreshnessSeconds: 900,
    stalePolicy: 'error'
  });
  assert.throws(() => adapter.getDataEnvelope(requestFor('replay-rta-001')), error => {
    return error instanceof ProviderError && error.code === ERROR_CODES.DATA_STALE;
  });
});
check('timeout failure degrades with retryable error', () => {
  const adapter = new ReplayMediaAdapter([{ rtaId: 'timeout-rta', failure: { code: 'TIMEOUT' } }]);
  const result = adapter.getDataEnvelopeSafe(requestFor('timeout-rta'));
  assert.strictEqual(result.status, 'degraded');
  assert.strictEqual(result.error.code, ERROR_CODES.TIMEOUT);
  assert.strictEqual(result.error.retryable, true);
});
check('permission failure degrades without retry', () => {
  const adapter = new ReplayMediaAdapter([{ rtaId: 'denied-rta', failure: { code: 'PERMISSION_DENIED' } }]);
  const result = adapter.getDataEnvelopeSafe(requestFor('denied-rta'));
  assert.strictEqual(result.status, 'degraded');
  assert.strictEqual(result.error.code, ERROR_CODES.PERMISSION_DENIED);
  assert.strictEqual(result.error.retryable, false);
});
check('invalid replay timestamp is a schema failure', () => {
  const adapter = new ReplayMediaAdapter([{ rtaId: 'bad-rta', updated_at: 'invalid' }]);
  assert.throws(() => adapter.getDataEnvelope(requestFor('bad-rta')), error => {
    return error instanceof ProviderError && error.code === ERROR_CODES.SCHEMA_MISMATCH;
  });
});
check('replay adapter rejects non-current scope before loading', () => {
  const adapter = new ReplayMediaAdapter([replayFixture]);
  assert.throws(() => adapter.getDataEnvelope(Object.assign({}, requestFor('replay-rta-001'), { dataScope: 'account_wide' })), error => {
    return error instanceof ProviderError && error.code === ERROR_CODES.INVALID_REQUEST;
  });
});
check('replay cache can be explicitly cleared', () => {
  const adapter = new ReplayMediaAdapter([replayFixture], { clock: () => replayNow });
  adapter.getDataEnvelope(requestFor('replay-rta-001'));
  adapter.clearCache();
  assert.strictEqual(adapter.getDataEnvelope(requestFor('replay-rta-001')).meta.cacheHit, false);
});
check('read-only tool mapping stays within whitelist', () => {
  assert.strictEqual(toolNameForIntent('metric_query'), 'metrics');
  assert.strictEqual(toolNameForIntent('config_query'), 'config_changes');
  assert.strictEqual(isAllowedTool('diagnosis_evidence'), true);
  assert.strictEqual(isAllowedTool('write_config'), false);
});
check('read-only runner attaches provider provenance', () => {
  const provider = new MockMediaDataProvider([mockRecord]);
  const result = createReadOnlyToolRunner(provider).run('metrics', requestFor(mockRecord.rtaId), () => ({
    status: 'ok', rows: [{ evidenceId: 'EV-METRIC-001' }]
  }));
  assert.strictEqual(result.status, 'ok');
  assert.strictEqual(result.toolName, 'metrics');
  assert.strictEqual(result.providerContractVersion, CONTRACT_VERSION);
  assert.strictEqual(result.providerMeta.providerId, 'mock-v08');
});
check('non-whitelisted tool is refused before provider access', () => {
  const provider = new MockMediaDataProvider([mockRecord]);
  const result = createReadOnlyToolRunner(provider).run('write_config', requestFor(mockRecord.rtaId), () => {
    throw new Error('must not execute');
  });
  assert.strictEqual(result.status, 'refused');
  assert.strictEqual(result.reason, 'tool_not_allowed');
});
check('stale provider data degrades read-only query', () => {
  const adapter = new ReplayMediaAdapter([replayFixture], {
    clock: () => replayNow + 901000,
    maxFreshnessSeconds: 900
  });
  const result = createReadOnlyToolRunner(adapter).run('trend', requestFor('replay-rta-001'), () => ({ status: 'ok' }));
  assert.strictEqual(result.status, 'insufficient');
  assert.strictEqual(result.reason, 'provider_data_insufficient');
  assert.strictEqual(result.providerMeta.qualityStatus, 'stale');
});
check('provider failure degrades without throwing', () => {
  const adapter = new ReplayMediaAdapter([{ rtaId: 'failed-rta', failure: { code: 'TIMEOUT' } }]);
  const result = createReadOnlyToolRunner(adapter).run('metrics', requestFor('failed-rta'), () => ({ status: 'ok' }));
  assert.strictEqual(result.status, 'insufficient');
  assert.strictEqual(result.reason, 'provider_error');
});

(async () => {
  await checkAsync('base provider methods fail as not implemented', async () => {
    const provider = new MediaDataProvider({ providerId: 'base', platform: 'mock' });
    await assert.rejects(provider.getConfigSnapshot(request), error => {
      return error instanceof ProviderError && error.code === ERROR_CODES.NOT_IMPLEMENTED;
    });
  });

  await checkAsync('provider composes a valid diagnosis envelope', async () => {
    const result = await new TestProvider().getDataEnvelope(request);
    assert.strictEqual(result.contractVersion, CONTRACT_VERSION);
    assert.strictEqual(result.request.rtaId, request.rtaId);
    assert.strictEqual(result.meta.providerId, 'mock-v08');
    assert.strictEqual(validateEnvelope(result).ok, true);
  });

  const total = 34;
  console.log('V0.8 Provider verification: ' + passed + ' / ' + total + ' passed');
  if (passed !== total) process.exitCode = 1;
})();
