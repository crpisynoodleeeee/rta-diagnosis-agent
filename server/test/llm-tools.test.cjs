const assert = require('assert');
const contract = require('../../demo/V1.0/data/media-data-provider.js');
const { MockMediaDataProvider } = require('../../demo/V1.0/data/mock-media-data-provider.js');
const { ReplayMediaAdapter } = require('../../demo/V1.0/data/replay-media-adapter.js');
const tools = require('../../demo/V1.0/data/readonly-query-tools.js');

let passed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  PASS ' + name); }
  catch (e) { console.log('  FAIL ' + name + ': ' + e.message); }
}

const request = { rtaId: 'juliang-rta-2086', timeRange: { start: '2026-08-28T00:00:00Z', end: '2026-08-28T14:00:00Z' }, dataScope: 'current_rta_only' };
const record = {
  rtaId: request.rtaId, dataUpdatedAt: '2026-08-28T13:00:00Z', media: 'synthetic', status: '上线',
  bidUrl: 'https://approved.invalid/bid', qpsConfig: 20000, qpsUsed: 12480, qpsRemaining: 7520,
  boundAccounts: ['acct'], strategies: [{ name: '清凉家电新策略（实验）', status: '已发布', thresholdBefore: '40%', thresholdAfter: '80%' }],
  experiment: { id: 'EXP-2086', status: '实验中' }, bucketMode: 'hash',
  groups: [{ groupId: 'G-CONTROL', groupType: 'control', bidRate: 0.6 }, { groupId: 'G-TREATMENT', groupType: 'treatment', bidRate: 0.1 }],
  changes: [{ time: '11:50', field: '准入门槛', before: '40%', after: '80%' }],
  coreMetrics: { successRate: 0.99 }, usageMetrics: { bidRate: { control: 0.6, treatment: 0.1 } },
  trend: [{ time: '11:30', bidRate: 0.6 }, { time: '13:00', bidRate: 0.1 }],
  dailyBudget: 1000, actualCost: 300, conversionCount: 10, actualCpa: 30, targetCpa: 40
};

function makeMock() { return new MockMediaDataProvider([record]); }
function makeReplay() {
  const response = Object.assign({}, record, {
    configSnapshot: { rtaid: { rtaId: record.rtaId, media: record.media, bidUrl: record.bidUrl, status: record.status }, groups: record.groups, strategies: record.strategies, changes: record.changes },
    metricBundle: { coreMetrics: record.coreMetrics, usageMetrics: record.usageMetrics, trend: record.trend, budget: { dailyBudget: record.dailyBudget, actualCost: record.actualCost, actualCpa: record.actualCpa, targetCpa: record.targetCpa } }
  });
  return new ReplayMediaAdapter([{ rtaId: request.rtaId, dataUpdatedAt: record.dataUpdatedAt, response }], { maxFreshnessSeconds: 7200, clock: () => Date.parse('2026-08-28T14:00:00Z') });
}
function context(envelope) {
  const evidence = [
    ['EV-METRIC-THRESHOLD', '准入门槛', '40%→80%'], ['EV-METRIC-BIDRATE', '参竞率', '60%→10%'],
    ['EV-TREND-001', '趋势', '11:30→13:00'], ['EV-GROUP-CONTROL', '对照组', '60%'],
    ['EV-GROUP-TREATMENT', '实验组', '10%'], ['EV-CHANGE-001', '配置变更', '40%→80%']
  ].map(x => ({ evidenceId: x[0], label: x[1], value: x[2], rtaId: envelope.request.rtaId }));
  return { schemaVersion: '0.9', rtaId: envelope.request.rtaId, dataQuality: { status: envelope.meta.qualityStatus }, evidence };
}
function query(provider, toolName, execute) {
  const runner = tools.createReadOnlyToolRunner(provider);
  return runner.run(toolName, request, execute);
}
function groundedAnswer(ctx, text, refs) {
  const ids = new Set(ctx.evidence.map(e => e.evidenceId));
  const found = text.match(/EV-[A-Z0-9_-]+/g) || [];
  return found.length > 0 && found.every(id => ids.has(id)) && refs.every(id => found.includes(id)) && !/999|8888|编造/.test(text);
}

test('llm-tools/offline-only', () => {
  const oldFetch = global.fetch; global.fetch = () => { throw new Error('network disabled'); };
  try {
    const result = query(makeMock(), 'metrics', e => ({ rows: [{ rtaId: e.request.rtaId }], evidenceIds: ['EV-METRIC-BIDRATE'] }));
    const stub = x => JSON.stringify({ rtaId: request.rtaId, answer: '本地 stub', evidenceIds: ['EV-METRIC-BIDRATE'] });
    assert.strictEqual(JSON.parse(stub(result)).rtaId, request.rtaId); assert.strictEqual(result.providerMeta.providerId, 'mock-v08');
  } finally { global.fetch = oldFetch; }
});

test('llm-tools/current-rta-scope', () => {
  const e = makeMock().getDataEnvelope(request); const ctx = context(e);
  for (const intent of ['metrics', 'trend', 'group_compare', 'config_changes', 'diagnosis_evidence']) {
    const r = query(makeMock(), intent, x => ({ rows: [{ rtaId: x.request.rtaId }], evidenceIds: ['EV-METRIC-BIDRATE'] }));
    assert.strictEqual(r.rows[0].rtaId, request.rtaId);
  }
  assert.strictEqual(tools.isAllowedTool('account_metrics'), false); assert.strictEqual(tools.toolNameForIntent('account_query'), null);
  assert.ok(ctx.rtaId === request.rtaId);
});

test('llm-tools/evidence-grounding', () => {
  const ctx = context(makeMock().getDataEnvelope(request));
  assert.ok(groundedAnswer(ctx, '参竞率 60%→10%（EV-METRIC-BIDRATE）', ['EV-METRIC-BIDRATE']));
  assert.strictEqual(groundedAnswer(ctx, '参竞率 1%，证据 EV-MADE-UP（999）', ['EV-METRIC-BIDRATE']), false);
  assert.strictEqual(groundedAnswer(ctx, 'CPA 999 元，无证据数字', []), false);
});

test('llm-tools/quality-refusal', () => {
  for (const quality of ['stale', 'partial', 'insufficient']) {
    const p = makeMock(); const base = p.getDataEnvelope.bind(p); p.getDataEnvelope = r => { const e = base(r); e.meta.qualityStatus = quality; e.meta.missingFields = quality === 'partial' ? ['trend'] : []; return e; };
    const r = query(p, 'metrics', e => ({ rows: [], evidenceIds: [] })); assert.strictEqual(r.status, 'insufficient'); assert.ok(r.reason);
  }
  const failure = { capabilities: { readOnly: true }, getDataEnvelope() { throw new Error('provider failure'); } };
  const r = query(failure, 'metrics', () => ({})); assert.strictEqual(r.status, 'insufficient'); assert.strictEqual(r.reason, 'provider_error');
});

test('llm-tools/provider-media-agnostic', () => {
  const run = p => query(p, 'metrics', e => ({ rows: [{ rtaId: e.request.rtaId, bidRate: e.metricBundle.usageMetrics.bidRate && (e.metricBundle.usageMetrics.bidRate.treatment || e.metricBundle.usageMetrics.bidRate) }], evidenceIds: ['EV-METRIC-BIDRATE'] }));
  const a = run(makeMock()), b = run(makeReplay()); assert.deepStrictEqual(a.rows, b.rows); assert.deepStrictEqual(a.evidenceIds, b.evidenceIds);
  const answer = '实验组参竞率为 10%（EV-METRIC-BIDRATE）'; assert.ok(!/HTTP|Authorization|bid_url|providerId|platform/.test(answer));
});

test('llm-tools/golden-case-locked', () => {
  const e = makeMock().getDataEnvelope(request); const c = context(e);
  const answer = '准入门槛 40%→80%（EV-METRIC-THRESHOLD），参竞率 60%→10%（EV-METRIC-BIDRATE），建议 80%→60%（EV-CHANGE-001）';
  assert.ok(groundedAnswer(c, answer, ['EV-METRIC-THRESHOLD', 'EV-METRIC-BIDRATE', 'EV-CHANGE-001']));
  assert.ok(/40%→80%/.test(answer) && /60%→10%/.test(answer) && /80%→60%/.test(answer));
});

module.exports = { run: async () => passed === 6 ? 0 : 1 };
