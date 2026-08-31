// v0.7 QueryContext / Mock 只读查询层专项验收
// 覆盖：Schema 校验、evidenceId、指标/趋势/组间/配置查询、RTA 隔离、证据冲突和 LLM 查询降级。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');
const mainMatch = html.match(/<script>\s*'use strict';[\s\S]*?<\/script>/);
if (!mainMatch) {
  console.error('未找到主逻辑 <script>');
  process.exit(1);
}

let mainCode = mainMatch[0].replace(/^<script>\s*/, '').replace(/\s*<\/script>$/, '');
mainCode = mainCode.replace(/const app = createApp[\s\S]*?app\.mount\('#app'\);?/g, '');
mainCode = mainCode.replace(/^const /gm, 'var ').replace(/\nconst /g, '\nvar ');

const stubVue = 'const Vue = { createApp: () => ({ mount: () => null }), ref: v => ({ value: v }), reactive: v => v, computed: v => ({ value: v() }), watch: () => {}, onMounted: () => {}, nextTick: () => Promise.resolve() };';

function newCtx() {
  const ctx = { module: {}, exports: {}, console, window: undefined, setTimeout, clearTimeout };
  vm.createContext(ctx);
  ctx.fetch = async () => { throw new Error('fetch should not be called by v0.7 query layer'); };
  ctx.AbortController = class { constructor() { this.signal = {}; } abort() {} };
  vm.runInContext(stubVue + '\n' + mainCode, ctx);
  return ctx;
}

const ctx = newCtx();
let pass = 0;
let fail = 0;
const failMessages = [];

function record(name, ok, detail) {
  if (ok) {
    pass++;
    console.log('  ✅ ' + name);
  } else {
    fail++;
    failMessages.push({ name, detail });
    console.log('  ❌ ' + name + (detail ? ' · ' + detail : ''));
  }
}

function ask(rtaId, question) {
  const rec = ctx.MOCK_RTA_LIST.find(r => r.rtaId === rtaId);
  const report = ctx.performDiagnosis(rec);
  return ctx.answerAssistantQuestion(question, report, rec, false).then(result => ({ rec, report, result }));
}

(async () => {
  console.log('════════════════════════════════════════════════════════════════');
  console.log('A) 静态扫描：查询层只读、无真实媒体/API、关键函数存在');
  console.log('════════════════════════════════════════════════════════════════');

  const required = [
    ['存在 buildQueryContext', /function buildQueryContext\s*\(/],
    ['存在 validateQueryContextSchema', /function validateQueryContextSchema\s*\(/],
    ['存在 runAssistantQuery', /function runAssistantQuery\s*\(/],
    ['存在 queryMetrics', /function queryMetrics\s*\(/],
    ['存在 queryTrend', /function queryTrend\s*\(/],
    ['存在 queryGroupCompare', /function queryGroupCompare\s*\(/],
    ['存在 queryConfigChanges', /function queryConfigChanges\s*\(/],
    ['DiagnosisReport 挂载 queryContext', /completedReport\.queryContext\s*=/],
    ['查询回答包含 evidenceId 规则', /EV-METRIC-|EV-TREND-|EV-CHANGE-|EV-RULE-/]
  ];
  required.forEach(([name, re]) => record(name, re.test(html)));

  const qLayerMatch = html.match(/5\.7 v0\.7 Mock[\s\S]*?6\. 完整诊断流程/);
  const qLayer = qLayerMatch ? qLayerMatch[0] : '';
  record('查询层不调用 fetch / XHR / DeepSeek / Authorization',
    !!qLayer && !/(fetch\s*\(|XMLHttpRequest|api\.deepseek|Authorization|apiKey\s*:)/.test(qLayer),
    qLayer ? '' : '未截取到查询层代码块');
  record('查询层声明 readonly_mock + current_rta_only',
    /readonly_mock/.test(qLayer) && /current_rta_only/.test(qLayer));

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('B) QueryContext Schema 与证据编号');
  console.log('════════════════════════════════════════════════════════════════');
  const completedReports = ctx.MOCK_RTA_LIST
    .map(r => ({ rec: r, report: ctx.performDiagnosis(r) }))
    .filter(x => x.report.status === 'completed');
  record('所有 completed 报告均带 queryContext', completedReports.every(x => x.report.queryContext && x.report.queryContext.schemaVersion === '0.7'));
  record('所有 completed QueryContext Schema 为 ok', completedReports.every(x => x.report.queryContext.dataQuality.status === 'ok'),
    completedReports.filter(x => x.report.queryContext.dataQuality.status !== 'ok').map(x => x.rec.rtaId + ':' + x.report.queryContext.dataQuality.status).join(', '));
  record('evidenceId 全局唯一且 EV- 前缀稳定', completedReports.every(x => {
    const ids = x.report.queryContext.evidence.map(e => e.evidenceId);
    return ids.length > 10 && ids.every(id => /^EV-[A-Z0-9_-]+$/.test(id)) && new Set(ids).size === ids.length;
  }));
  record('Golden Case 至少包含规则/趋势/配置/指标证据',
    (() => {
      const golden = completedReports.find(x => x.rec.rtaId === 'juliang-rta-2086').report.queryContext;
      const ids = new Set(golden.evidence.map(e => e.evidenceId));
      return ids.has('EV-RULE-D9') && ids.has('EV-CHANGE-001') && ids.has('EV-TREND-001') && ids.has('EV-METRIC-ACTUALCPA');
    })());

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('C) 只读查询正确性');
  console.log('════════════════════════════════════════════════════════════════');
  {
    const { result } = await ask('juliang-rta-2086', '当前 CPA、转化数和 QPS 指标是多少？');
    const text = result.answer.text;
    record('指标查询命中 metric_query', result.intent === 'metric_query');
    record('指标查询返回 CPA/QPS 且引用 EV-METRIC', /实际 CPA：30/.test(text) && /当前 QPS：12,480 QPS|当前 QPS：12480 QPS/.test(text) && /EV-METRIC-/.test(text), text.slice(0, 180));
  }
  {
    const { result } = await ask('juliang-rta-2086', '参竞率趋势从开始到最后下降了多少？');
    const text = result.answer.text;
    record('趋势查询命中 trend_query', result.intent === 'trend_query');
    record('趋势查询返回 60% 到 10% 与趋势证据', /11:30 = 60\.0%|11:30 = 60%/.test(text) && /13:00 = 10\.0%|13:00 = 10%/.test(text) && /EV-TREND-001/.test(text) && /EV-TREND-006/.test(text), text.slice(0, 220));
  }
  {
    const { result } = await ask('juliang-rta-2086', '对照组和实验组对比如何？');
    const text = result.answer.text;
    record('组间查询命中 group_compare', result.intent === 'group_compare');
    record('组间查询返回参竞率差 50pp 与组证据', /对照组 60% vs 实验组 10%/.test(text) && /50pp/.test(text) && /EV-GROUP-CONTROL/.test(text) && /EV-GROUP-TREATMENT/.test(text), text.slice(0, 220));
  }
  {
    const { result } = await ask('juliang-rta-2086', '配置变更记录是什么？');
    const text = result.answer.text;
    record('配置查询命中 config_query', result.intent === 'config_query');
    record('配置查询返回 11:50 40%->80% 与 EV-CHANGE-001', /11:50/.test(text) && /40%/.test(text) && /80%/.test(text) && /EV-CHANGE-001/.test(text), text.slice(0, 220));
  }
  {
    const { result } = await ask('juliang-rta-2086', '当前诊断结论的依据是什么？');
    const text = result.answer.text;
    record('证据查询保留 evidence 意图', result.intent === 'evidence');
    record('证据查询返回异常规则与 evidence refs', /EV-RULE-D9/.test(text) && /EV-CHANGE-001/.test(text) && /数据范围/.test(text), text.slice(0, 220));
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('D) 拒答、数据不足与冲突降级');
  console.log('════════════════════════════════════════════════════════════════');
  {
    const { result } = await ask('juliang-rta-2086', '帮我查 tencent-rta-3112 的 CPA 是多少？');
    record('跨 RTA 查询仍分类为查数但被拒绝', result.intent === 'metric_query' && /被拒绝|其他 RTAID|当前 RTA/.test(result.answer.text), result.answer.text);
  }
  {
    const rec = Object.assign({}, ctx.MOCK_RTA_LIST.find(r => r.rtaId === 'juliang-rta-2086'), { trend: [{ time: '11:30', requests: 1080, hitRate: 0.96, bidRate: 0.60, cost: 28 }] });
    const report = ctx.performDiagnosis(rec);
    const result = await ctx.answerAssistantQuestion('参竞率趋势怎么变化？', report, rec, false);
    record('趋势点不足时拒绝趋势结论', result.intent === 'trend_query' && /趋势点不足|不能做趋势对比|数据不足/.test(result.answer.text), result.answer.text);
  }
  {
    const rec = Object.assign({}, ctx.MOCK_RTA_LIST.find(r => r.rtaId === 'juliang-rta-2086'), { achievementRate: 0.99 });
    const report = ctx.performDiagnosis(rec);
    const result = await ctx.answerAssistantQuestion('当前预算指标是多少？', report, rec, false);
    record('Schema 证据冲突时拒答', report.queryContext.dataQuality.status === 'conflict' && /证据冲突|拒绝/.test(result.answer.text), result.answer.text);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log('E) LLM 查询路径校验');
  console.log('════════════════════════════════════════════════════════════════');
  {
    const rec = ctx.MOCK_RTA_LIST.find(r => r.rtaId === 'juliang-rta-2086');
    const report = ctx.performDiagnosis(rec);
    const qr = ctx.runAssistantQuery('当前 CPA 和预算指标是多少？', 'metric_query', report, rec);
    const bad = ctx.validateAssistantOutput({ rtaId: rec.rtaId, intent: 'metric_query', answer: '当前 CPA 是 30 元，预算是 1000 元。' }, 'metric_query', report, rec, qr);
    const good = ctx.validateAssistantOutput({ rtaId: rec.rtaId, intent: 'metric_query', answer: '当前 CPA 是 30 元（EV-METRIC-ACTUALCPA），日预算是 1000 元（EV-METRIC-DAILYBUDGET）。' }, 'metric_query', report, rec, qr);
    record('LLM 查数回答不带 evidenceId 会被拒绝', bad.ok === false && /missing_evidence_ref/.test(bad.reason), bad.reason);
    record('LLM 查数回答带合法 evidenceId 可通过', good.ok === true, good.reason);
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`v0.7 查询层验证总览：${pass} / ${pass + fail} 通过`);
  console.log('════════════════════════════════════════════════════════════════');
  if (fail > 0) {
    console.log('\n未通过的用例:');
    failMessages.forEach(f => console.log('  ❌ ' + f.name + (f.detail ? ' · ' + f.detail : '')));
  }
  console.log('注：本脚本只使用合成 Mock 数据和 VM，本地不调用真实媒体 API，不读取真实密钥。');
  process.exit(fail === 0 ? 0 : 1);
})();
