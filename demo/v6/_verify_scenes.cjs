// v6 新场景叙事完整性验证（临时用）：跑 5 条新场景记录，输出每条的 oneLiner/managerSummary/causes/recommendations，确认是七段式（不是一句话 fallback）
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const mainMatch = html.match(/<script>\s*'use strict';[\s\S]*?<\/script>/);
let mainCode = mainMatch[0].replace(/^<script>\s*/, '').replace(/\s*<\/script>$/, '');
mainCode = mainCode.replace(/const app = createApp[\s\S]*?app\.mount\('#app'\);?/g, '');
mainCode = mainCode.replace(/^const /gm, 'var ').replace(/\nconst /g, '\nvar ');
const stubVue = 'const Vue = { createApp: () => ({ mount: () => null }), ref: v => ({ value: v }), reactive: v => v, computed: v => ({ value: v() }), watch: () => {}, onMounted: () => {}, nextTick: () => Promise.resolve() };';
const vm = require('vm');
const ctx = { module: {}, exports: {}, console };
vm.createContext(ctx);
vm.runInContext(stubVue + '\n' + mainCode, ctx);

const scenes = [
  { id: 'S1', rtaId: 'juliang-rta-2099', title: '入口流量（juliang-rta-2099）' },
  { id: 'S2', rtaId: 'xiaomi-rta-7701',  title: '命中率（xiaomi-rta-7701）' },
  { id: 'S4', rtaId: 'honor-rta-1245',   title: '出价/竞价（honor-rta-1245）' },
  { id: 'S5', rtaId: 'vivo-rta-8810',    title: '执行质量（vivo-rta-8810）' },
  { id: 'S6', rtaId: 'oppo-rta-9921',    title: '回传/归因（oppo-rta-9921）' }
];

let pass = true;
scenes.forEach(({ id, rtaId, title }) => {
  const r = ctx.MOCK_RTA_LIST.find(x => x.rtaId === rtaId);
  const rpt = ctx.performDiagnosis(r);
  const ai = rpt.ai || rpt; // performDiagnosis 返回 { status:'ok', ai, scenario, causeTree, timeline } 或 { status:'insufficient', ... }
  const s = rpt.scenario || ai.scenario;
  const a = ai;
  // 影响范围实际位置在 rpt.impact.affectedScope（对齐《契约 v0.3》§3.2），顶层 rpt.affectedScope 不存在
  const affectedScope = rpt.impact && rpt.impact.affectedScope;
  console.log('\n═══════════════════════════════════════════════');
  console.log(title);
  console.log('═══════════════════════════════════════════════');
  console.log('detectScene:', s.sceneId, s.sceneName, '· 现象标签:', s.phenomenonTags.map(t => t.name).join('、'));
  console.log('oneLiner  :', a.oneLiner);
  console.log('managerSm :', a.managerSummary.substring(0, 100) + '…');
  console.log('operNote  :', a.operationsNote);
  console.log('primary   :', a.causes.primary);
  console.log('secondary :', a.causes.secondary);
  console.log('excluded  :', a.causes.excluded.length, '条');
  console.log('scope     :', affectedScope);
  console.log('reclist   :', a.recommendations.length, '套');
  a.recommendations.forEach((rec, i) => {
    console.log(`  [rec-${i+1}] ${rec.action}`);
    console.log(`    before=${rec.before} → after=${rec.after}`);
    console.log(`    observe=[${rec.observeMetrics.join(', ')}]`);
    console.log(`    success=${rec.successCriteria}`);
    console.log(`    rollback=${rec.rollbackCondition}`);
  });

  // 七段式断言
  const tech = rpt.technical;
  const checks = [
    ['oneLiner 非空且 > 30 字符', a.oneLiner && a.oneLiner.length > 30],
    ['oneLiner 含因果链', /(请求量|命中率|出价|成功率|超时|回传).*(导致|降至|从|→)/.test(a.oneLiner)],
    ['managerSummary 非空', a.managerSummary && a.managerSummary.length > 50],
    ['operationsNote 体现"边界判断"', /(不调|不进入|不急|优先|边界|先)./.test(a.operationsNote)],
    ['causes.primary 非空', a.causes.primary],
    ['causes.excluded 至少 1 条', Array.isArray(a.causes.excluded) && a.causes.excluded.length >= 1],
    ['affectedScope 非空（AI 层必填语义字段，路径 rpt.impact.affectedScope）', affectedScope && String(affectedScope).length > 0],
    ['recommendations 至少 1 套', a.recommendations.length >= 1],
    ['每套建议含 7 要素', a.recommendations.every(rec => rec.action && rec.before && rec.after && rec.impact && Array.isArray(rec.observeMetrics) && rec.observeMetrics.length >= 1 && rec.successCriteria && rec.rollbackCondition)],
    ['technical.dataRange 非空（含时间区间）', tech && typeof tech.dataRange === 'string' && /\d{2}:\d{2}/.test(tech.dataRange) && tech.dataRange.length > 5],
    ['technical.dataSource 非空', tech && typeof tech.dataSource === 'string' && tech.dataSource.length > 0],
    ['technical.dataUpdatedAt 非空', tech && typeof tech.dataUpdatedAt === 'string' && tech.dataUpdatedAt.length > 0]
  ];
  checks.forEach(([n, ok]) => {
    if (!ok) pass = false;
    console.log((ok ? '  ✅' : '  ❌') + ' ' + n);
  });

  // S1/S5/S6 专项：必须强调"不调 RTA / 先排障 / 先修回传"
  if (id === 'S1' || id === 'S5' || id === 'S6') {
    const boundaryOK = /(不调|不进入|优先排障|先修|不急|先恢复|先修复|不调整)/.test(a.operationsNote + a.managerSummary);
    console.log((boundaryOK ? '  ✅' : '  ❌') + ' 边界判断体现（' + id + '）');
    if (!boundaryOK) pass = false;
  }
  // S2/S4 建议数 ≥ 2
  if (id === 'S2' || id === 'S4') {
    const rec2 = a.recommendations.length >= 2;
    console.log((rec2 ? '  ✅' : '  ❌') + ' S2/S4 建议 ≥ 2 套');
    if (!rec2) pass = false;
  }
});

console.log('\n═══════════════════════════════════════════════');
console.log('总览');
console.log('═══════════════════════════════════════════════');
console.log(pass ? '🎉 5 个新场景叙事完整，全部通过' : '⚠️ 有未通过项');
process.exit(pass ? 0 : 1);
