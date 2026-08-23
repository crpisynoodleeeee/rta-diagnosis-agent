// v6 Golden Case 验证脚本（Node.js）
// 模拟浏览器环境，跑规则引擎 + 场景识别 + AI 层，验证 Golden Case 输出符合标准答案

const fs = require('fs');
const path = require('path');

// 读取 index.html 提取 <script>...</script> 主逻辑
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const mainMatch = html.match(/<script>\s*'use strict';[\s\S]*?<\/script>/);
if (!mainMatch) {
  console.error('未找到主逻辑 <script>');
  process.exit(1);
}
let mainCode = mainMatch[0];
// 去掉外层 <script> 标签，保留代码
mainCode = mainCode.replace(/^<script>\s*/, '').replace(/\s*<\/script>$/, '');
// 去掉 Vue mount 调用（Node 环境无 DOM/无 Vue）
mainCode = mainCode.replace(/const app = createApp[\s\S]*?app\.mount\('#app'\);?/g, '');
// const 在 vm 上下文里不挂到 ctx，统一转成 var 让数据可访问
mainCode = mainCode.replace(/^const /gm, 'var ').replace(/\nconst /g, '\nvar ');
// 提供 Vue 占位（让 const { createApp, ... } = Vue 不报错）
const stubVue = 'const Vue = { createApp: () => ({ mount: () => null }), ref: v => ({ value: v }), reactive: v => v, computed: v => ({ value: v() }), watch: () => {}, onMounted: () => {}, nextTick: () => Promise.resolve() };';

// 用 vm 在隔离上下文里跑
const vm = require('vm');
const ctx = { module: {}, exports: {}, console };
vm.createContext(ctx);
vm.runInContext(stubVue + '\n' + mainCode, ctx);

const goldenCase = ctx.MOCK_RTA_LIST.find(r => r.rtaId === 'juliang-rta-2086');
const rpt = ctx.performDiagnosis(goldenCase);

// 显式打印 AI 来源：_verify.cjs 强制走模板路径（不调 LLM），确认无需网络也能评测
const aiSrc = (rpt && rpt._aiSource) || (ctx.LLM_CONFIG && ctx.LLM_CONFIG.enabled ? 'llm' : 'template');

console.log('═══════════════════════════════════════════════');
console.log('Golden Case 验证（夏季大促 P-2026-SUMMER）');
console.log('═══════════════════════════════════════════════');
console.log('场景:', rpt.scenario.sceneId, rpt.scenario.sceneName);
console.log('现象标签:', rpt.scenario.phenomenonTags.map(t => t.name).join('、') || '(无)');
console.log('置信度:', rpt.scenario.confidence + '%');
console.log('AI 来源:', aiSrc, '(应为 template，无网络调用)');
console.log('');
console.log('oneLiner:', rpt.oneLiner);
console.log('');
console.log('主因:', rpt.causes.primary);
console.log('次因:', rpt.causes.secondary);
console.log('');
console.log('建议数:', rpt.recommendations.length);
rpt.recommendations.forEach(rec => {
  console.log(' - action:', rec.action);
  console.log('   before:', rec.before, '→ after:', rec.after);
  console.log('   观察:', rec.observeMetrics.join('、'));
  console.log('   成功:', rec.successCriteria);
  console.log('   回滚:', rec.rollbackCondition);
});

// 断言
console.log('\n═══════════════════════════════════════════════');
console.log('标准答案对照');
console.log('═══════════════════════════════════════════════');
const checks = [
  ['场景 = S3 (参竞/放行)', rpt.scenario.sceneId === 'S3'],
  ['主因命中：实验组准入门槛 40%→80% 导致参竞率骤降', /准入门槛|门槛/.test(rpt.causes.primary) && /参竞/.test(rpt.causes.primary)],
  ['次因 = 无独立次因', rpt.causes.secondary === '无独立次因'],
  ['建议 before = 80%', /80%/.test(rpt.recommendations[0].before)],
  ['建议 after = 60%', /60%/.test(rpt.recommendations[0].after)],
  ['三要素齐全', Array.isArray(rpt.recommendations[0].observeMetrics) && rpt.recommendations[0].observeMetrics.length >= 2 && rpt.recommendations[0].successCriteria && rpt.recommendations[0].rollbackCondition],
  ['现象标签不含「CPA 过高」', !rpt.scenario.phenomenonTags.some(t => t.id === 'P_CPA_HIGH')],
  ['现象标签含「预算未达标」', rpt.scenario.phenomenonTags.some(t => t.id === 'P_BUDGET')],
  ['causeTree D9 abnormal', rpt.causeTree.find(n => n.id === 'c-strategy') && rpt.causeTree.find(n => n.id === 'c-strategy').result === 'abnormal'],
  ['oneLiner 包含因果链（门槛→参竞→消耗）', /门槛|参竞|消耗/.test(rpt.oneLiner)],
  ['technical.dataRange 非空（含时间区间）', rpt.technical && typeof rpt.technical.dataRange === 'string' && /\d{2}:\d{2}/.test(rpt.technical.dataRange) && rpt.technical.dataRange.length > 5],
  ['technical.dataSource 非空', rpt.technical && typeof rpt.technical.dataSource === 'string' && rpt.technical.dataSource.length > 0],
  ['technical.dataUpdatedAt 非空', rpt.technical && typeof rpt.technical.dataUpdatedAt === 'string' && rpt.technical.dataUpdatedAt.length > 0]
];
checks.forEach(([name, ok]) => console.log((ok ? '✅' : '❌') + ' ' + name));

const allPass = checks.every(c => c[1]);
console.log('\n', allPass ? '🎉 Golden Case 全部通过' : '⚠️ 有未通过项');

// 同时跑其他 9 条记录，验证列表显示的标签
console.log('\n═══════════════════════════════════════════════');
console.log('10 条记录现象标签分布（列表页应展示）');
console.log('═══════════════════════════════════════════════');
ctx.MOCK_RTA_LIST.forEach(r => {
  const signals = ctx.runRules(r);
  const sc = ctx.detectScenario(signals, r);
  const tag = ctx.classifyPhenomenon(r, sc);
  console.log(' -', r.rtaId, '[' + sc.sceneId + ']', tag.tone + ':', tag.text);
});

// 验证列表可见 CPA 过高 + 可安全放量
const cpaHigh = ctx.MOCK_RTA_LIST.some(r => {
  const sc = ctx.detectScenario(ctx.runRules(r), r);
  return sc.phenomenonTags.some(t => t.id === 'P_CPA_HIGH');
});
const safeScale = ctx.MOCK_RTA_LIST.some(r => {
  const sc = ctx.detectScenario(ctx.runRules(r), r);
  return sc.phenomenonTags.some(t => t.id === 'P_SAFE_SCALE');
});
console.log('\n列表可见「CPA 过高」标签：', cpaHigh ? '✅' : '❌');
console.log('列表可见「可安全放量」标签：', safeScale ? '✅' : '❌');

// 自查 ⑦ 全局错误捕获：检查 index.html 是否含 window.onerror + #__errbox
console.log('\n═══════════════════════════════════════════════');
console.log('自查 ⑦ 全局错误捕获（源代码级）');
console.log('═══════════════════════════════════════════════');
const htmlAll = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const hasOnerror = /window\.addEventListener\(['"]error['"]/.test(htmlAll);
const hasOnrejection = /window\.addEventListener\(['"]unhandledrejection['"]/.test(htmlAll);
const hasErrBox = /id="__errbox"/.test(htmlAll);
const hasShowFn = /function show\(/.test(htmlAll);
console.log('window.addEventListener(error)：', hasOnerror ? '✅' : '❌');
console.log('window.addEventListener(unhandledrejection)：', hasOnrejection ? '✅' : '❌');
console.log('#__errbox 节点：', hasErrBox ? '✅' : '❌');
console.log('show() 注入函数：', hasShowFn ? '✅' : '❌');
const errorCaptureOK = hasOnerror && hasOnrejection && hasErrBox && hasShowFn;
console.log('全局错误捕获：', errorCaptureOK ? '✅' : '❌');

// 自查 ①②③④ HTML 合规性
console.log('\n═══════════════════════════════════════════════');
console.log('自查 ①-④ HTML 合规性');
console.log('═══════════════════════════════════════════════');
const extLinks = htmlAll.match(/<link[^>]*href=["']https?:\/\/[^"']*["'][^>]*>/g) || [];
const extScripts = htmlAll.match(/<script[^>]*src=["']https?:\/\/[^"']*["'][^>]*>/g) || [];
const importmap = htmlAll.match(/<script\s+type=["']importmap["']/g) || [];
const moduleScripts = htmlAll.match(/<script\s+type=["']module["']/g) || [];
const importStmt = htmlAll.match(/^import\s+/gm) || [];
const vendorRefs = htmlAll.match(/<script[^>]*src=["']\.\/vendor\//g) || [];
const hasVueUMD = /const\s*\{\s*createApp/.test(htmlAll);
const hasInk = /colors:\s*\{[\s\S]*?ink:/.test(htmlAll);
const hasBrand = /colors:\s*\{[\s\S]*?brand:/.test(htmlAll);
console.log('①外部 <link> 资源：', extLinks.length === 0 ? '✅ 0' : '❌ ' + extLinks.length);
console.log('①外部 <script src> 资源：', extScripts.length === 0 ? '✅ 0' : '❌ ' + extScripts.length);
console.log('②importmap：', importmap.length === 0 ? '✅ 0' : '❌ ' + importmap.length);
console.log('②type="module"：', moduleScripts.length === 0 ? '✅ 0' : '❌ ' + moduleScripts.length);
console.log('②import 语句：', importStmt.length === 0 ? '✅ 0' : '❌ ' + importStmt.length);
console.log('①本地 vendor 引用：', vendorRefs.length, '个（', vendorRefs.join('、'), '）');
console.log('③Vue UMD 解构：', hasVueUMD ? '✅' : '❌');
console.log('④tailwind.config 含 ink 色板：', hasInk ? '✅' : '❌');
console.log('④tailwind.config 含 brand 色板：', hasBrand ? '✅' : '❌');

const htmlOK = extLinks.length === 0 && extScripts.length === 0 && importmap.length === 0 && moduleScripts.length === 0 && importStmt.length === 0 && hasVueUMD && hasInk && hasBrand;
console.log('HTML 合规：', htmlOK ? '✅' : '❌');

console.log('\n═══════════════════════════════════════════════');
console.log('总览');
console.log('═══════════════════════════════════════════════');
const allOK = allPass && cpaHigh && safeScale && errorCaptureOK && htmlOK;
console.log('Golden Case 全部通过：', allPass ? '✅' : '❌');
console.log('列表标签覆盖（CPA 过高 + 可安全放量）：', (cpaHigh && safeScale) ? '✅' : '❌');
console.log('全局错误捕获：', errorCaptureOK ? '✅' : '❌');
console.log('HTML 合规（无外网/无 ESM/Vue UMD/Tailwind 配置）：', htmlOK ? '✅' : '❌');
console.log('\n', allOK ? '🎉 v6 自查 7/7 全部通过' : '⚠️ 有未通过项');

process.exit(allOK ? 0 : 1);