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

  const total = 14;
  console.log('V0.8 Provider verification: ' + passed + ' / ' + total + ' passed');
  if (passed !== total) process.exitCode = 1;
})();
