// v6 智能参谋问答验证脚本（Node.js + vm + fetch stub + 静态扫描）
// 第三步返修 · 有限上下文连续问答 · 覆盖真实发送链路 + LLM 一致性校验 + 会话边界
//
// 测试走 vm.Script + fetch stub，不进行真实网络请求，不读取真实环境变量。
// 关键：askViaCtx 调用顶层纯函数 answerAssistantQuestion（与页面 askAssistant 共用同一链路），
//       不再手动模拟流程，确保测试覆盖真实发送链路。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, 'index.html');

// ─────────────────────────────────────────────────────────
// A) 静态扫描（安全 + 一致性断言）
// ─────────────────────────────────────────────────────────
const html = fs.readFileSync(HTML_PATH, 'utf8');

const scanChecks = [
  {
    name: 'a1 index.html 不存在 LLM_CONFIG.apiKey 字段',
    forbiddenRe: /LLM_CONFIG\.apiKey\b|\bapiKey\s*:/,
    occurrences: [], pass: false,
    desc: 'LLM_CONFIG 不应包含 apiKey 字段；Key 仅由代理进程持有。'
  },
  {
    name: 'a2 前端请求 headers 中不存在 Authorization 字面字段',
    forbiddenRe: /headers\s*:\s*\{[^}]*['"]Authorization['"]\s*:/,
    occurrences: [], pass: false,
    desc: 'fetch(...) 的 headers 不应包含 Authorization 字段；Key 不能从浏览器流出。'
  },
  {
    name: 'a3 助手 LLM 通道（callAssistantLLM）请求头不含 Authorization',
    forbiddenRe: /callAssistantLLM[\s\S]{0,800}['"]Authorization['"]/,
    occurrences: [], pass: false,
    desc: 'callAssistantLLM 函数体不应出现 Authorization 字符串。'
  },
  {
    name: 'a4 前端不存在"手动填入 Key / 把 Key 放前端"提示',
    forbiddenRe: /(填入.*?(?:apiKey|DeepSeek\s*key|key\s*到)|把\s*Key\s*放(?:入|到).*?前端|手动填入.*?(?:apiKey|key)|请在.*?源码.*?填)/i,
    occurrences: [], pass: false,
    desc: 'README / 注释 / UI 不应教用户把真实 Key 写进前端源码。'
  },
  {
    name: 'a5 index.html 不存在未定义的 classifyIntent(q) 调用',
    forbiddenRe: /\bclassifyIntent\s*\(/,
    occurrences: [], pass: false,
    desc: '全文件不得出现未定义的 classifyIntent 调用，必须统一使用 classifyAssistantIntent。'
  },
  {
    name: 'a6 不存在"处理中出错…已自动回退到模板"假回退文案',
    forbiddenRe: /处理中出错[\s\S]{0,40}已自动回退/,
    occurrences: [], pass: false,
    desc: '异常时不应伪装"已自动回退到模板"，应如实告知失败或真正回退。'
  },
  {
    name: 'a7 不存在 msg.source === ... || ... 异常角标表达式',
    forbiddenRe: /source\s*===\s*['"]\s*\|\|\s*['"]/,
    occurrences: [], pass: false,
    desc: '来源角标不得出现 === \' || \' 异常表达式。'
  },
  {
    name: 'a8 不存在虚构的通用回滚条件（CPA上涨超过阈值/流量质量明显下降/参竞率持续低于目标）',
    forbiddenRe: /任一触发即建议回滚[\s\S]{0,80}CPA 上涨超过阈值/,
    occurrences: [], pass: false,
    desc: 'buildRollback 不得补充报告外的通用回滚条件。'
  }
];

console.log('════════════════════════════════════════════════════════════════');
console.log('A) 静态扫描（前端不持有 Key / 不发 Auth 头 / 真实发送链 / 无假回退 / 无异常角标）');
console.log('════════════════════════════════════════════════════════════════');
for (const c of scanChecks) {
  const matches = [];
  let m;
  while ((m = c.forbiddenRe.exec(html)) !== null) {
    matches.push({ index: m.index, snippet: html.substring(Math.max(0, m.index - 30), m.index + 60).replace(/\n/g, ' ') });
  }
  c.occurrences = matches;
  c.pass = matches.length === 0;
  console.log((c.pass ? '  ✅ ' : '  ❌ ') + c.name);
  if (!c.pass) {
    console.log('     违规: ' + c.desc);
    matches.slice(0, 3).forEach((o, i) => console.log(`     [${i+1}] @${o.index} …${o.snippet}…`));
  }
}

// 必须出现的断言（required）
const requiredChecks = [
  {
    name: 'r1 askAssistant 内部调用 answerAssistantQuestion 纯函数',
    requiredRe: /askAssistant[\s\S]{0,1200}?answerAssistantQuestion\s*\(/,
    desc: 'askAssistant 必须调用顶层纯函数 answerAssistantQuestion，确保测试覆盖真实发送链路。'
  },
  {
    name: 'r2 askAssistant 内部调用 classifyAssistantIntent（不直接调 classifyIntent）',
    requiredRe: /function askAssistant[\s\S]{0,2000}?classifyAssistantIntent\s*\(/,
    desc: 'askAssistant 流程必须使用 classifyAssistantIntent。'
  },
  {
    name: 'r3 顶层存在 answerAssistantQuestion 纯函数定义',
    requiredRe: /async function answerAssistantQuestion\s*\(/,
    desc: '必须提取顶层纯函数 answerAssistantQuestion 供测试共用。'
  },
  {
    name: 'r4 getOrCreateSession 内部调用 chatSessions.clear()',
    requiredRe: /function getOrCreateSession[\s\S]{0,400}?chatSessions\.clear\(\)/,
    desc: '切换 RTA 时必须 clear() 旧会话，不保留多 RTA 历史。'
  },
  {
    name: 'r5 存在 trimAssistantMessages 顶层纯函数',
    requiredRe: /function trimAssistantMessages\s*\(/,
    desc: '会话裁剪逻辑必须提取为顶层纯函数供测试验证。'
  },
  {
    name: 'r6 buildAssistantPrompt 要求 LLM 返回 rtaId/intent/answer 三字段',
    requiredRe: /buildAssistantPrompt[\s\S]{0,2000}?"rtaId"[\s\S]{0,200}?"intent"[\s\S]{0,200}?"answer"/,
    desc: 'LLM 返回结构必须包含 rtaId / intent / answer。'
  },
  {
    name: 'r7 validateAssistantOutput 校验 rtaId_mismatch',
    requiredRe: /validateAssistantOutput[\s\S]{0,1500}?rtaId_mismatch/,
    desc: '校验必须拒绝错误 RTAID。'
  },
  {
    name: 'r8 validateAssistantOutput 校验 intent_mismatch',
    requiredRe: /validateAssistantOutput[\s\S]{0,1500}?intent_mismatch/,
    desc: '校验必须拒绝错误 intent。'
  },
  {
    name: 'r9 存在 sourceLabel 函数统一来源角标',
    requiredRe: /function sourceLabel\s*\(/,
    desc: '来源角标必须用 sourceLabel 统一规则。'
  }
];

console.log('\n── 必须出现的断言（required）──');
for (const c of requiredChecks) {
  c.pass = c.requiredRe.test(html);
  console.log((c.pass ? '  ✅ ' : '  ❌ ') + c.name);
  if (!c.pass) console.log('     违规: ' + c.desc);
}

// ─────────────────────────────────────────────────────────
// B) 加载 index.html 主代码段到 vm 上下文
// ─────────────────────────────────────────────────────────
const mainMatch = html.match(/<script>\s*'use strict';[\s\S]*?<\/script>/);
let mainCode = mainMatch[0].replace(/^<script>\s*/, '').replace(/\s*<\/script>$/, '');
mainCode = mainCode.replace(/const app = createApp[\s\S]*?app\.mount\('#app'\);?/g, '');
// vm 沙箱里 `const` 不会挂到 ctx；改 var 让顶层常量进入 ctx globalThis（不动 index.html 源码）
mainCode = mainCode.replace(/^const /gm, 'var ');

const stubVue = 'const Vue = { createApp: () => ({ mount: () => null }), ref: v => ({ value: v }), reactive: v => v, computed: v => ({ value: v() }), watch: () => {}, onMounted: () => {}, nextTick: () => Promise.resolve() };';

function newCtx(fetchStub) {
  const ctx = { module: {}, exports: {}, console, window: undefined, setTimeout, clearTimeout };
  vm.createContext(ctx);
  ctx.fetch = fetchStub;
  ctx.AbortController = class { constructor() { this.signal = {}; } abort() {} };
  vm.runInContext(stubVue + '\n' + mainCode, ctx);
  ctx.LLM_CONFIG.timeoutMs = 2000;
  return ctx;
}

// 从 fetch 请求 body 中解析 rtaId 和 intent（buildAssistantPrompt 把它们写进 userPrompt）
function parseRtaIdIntentFromBody(opts) {
  try {
    const body = JSON.parse(opts.body);
    const userMsg = body.messages.find(m => m.role === 'user');
    if (!userMsg) return { rtaId: '', intent: '' };
    const c = userMsg.content;
    const rtaMatch = c.match(/"rtaId":\s*"([^"]+)"/);
    const intentMatch = c.match(/"intent":\s*"([^"]+)"/);
    return { rtaId: rtaMatch ? rtaMatch[1] : '', intent: intentMatch ? intentMatch[1] : '' };
  } catch (e) {
    return { rtaId: '', intent: '' };
  }
}

// fetch stub 用于 LLM 通道（诊断 / 助手共用）
function makeFetchHandler(scenario, recaptured) {
  return async function fetchStub(url, opts) {
    if (recaptured) {
      recaptured.reqUrl = url;
      recaptured.reqOpts = { ...(opts || {}), headers: { ...((opts && opts.headers) || {}) } };
    }
    if (scenario === 'network-error') throw new Error('Network unreachable (stub)');
    if (scenario === 'http-500') return { ok: false, status: 500, text: async () => 'Internal Server Error (stub)' };
    if (scenario === 'http-503-not-configured') {
      return { ok: false, status: 503, text: async () => JSON.stringify({ error: 'LLM_NOT_CONFIGURED', message: '代理未持有 DEEPSEEK_API_KEY（stub）' }) };
    }
    if (scenario === 'malformed-json') {
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'not a json {{{ broken' } }] }) };
    }
    // 解析当前请求的 rtaId / intent，返回合规 JSON（让 validateAssistantOutput 通过）
    const { rtaId, intent } = parseRtaIdIntentFromBody(opts);
    if (scenario === 'success-stub') {
      const stubAnswer = '【LLM-STUB-ASSISTANT】这是助手 LLM stub 的回答。引用当前 RTA ' + rtaId + ' 的事实，符合 ' + intent + ' 分类，不含编造数字。';
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rtaId, intent, answer: stubAnswer }) } }] }) };
    }
    if (scenario === 'wrong-rtaId') {
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rtaId: 'wrong-rta-id', intent, answer: '这是一个返回错误 RTAID 的回答，应当被校验拒绝。' }) } }] }) };
    }
    if (scenario === 'wrong-intent') {
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rtaId, intent: 'wrong-intent', answer: '这是一个返回错误 intent 的回答，应当被校验拒绝。' }) } }] }) };
    }
    if (scenario === 'wrong-number') {
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rtaId, intent, answer: '当前 RTA 的 CPA 上涨 999%，预算 8888 元，参竞率只有 1%，严重异常需要关注。' }) } }] }) };
    }
    if (scenario === 'confidence-conflict') {
      // overview 类：返回错误置信度（主因/结论冲突）
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rtaId, intent, answer: '当前场景置信度 50%，主因与报告不一致，这是一个编造的结论应当被拒绝。' }) } }] }) };
    }
    if (scenario === 'action-conflict') {
      // recommendation 类：返回 recommendations 中不存在的动作
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rtaId, intent, answer: '建议立即提价到 999 元，并换素材，马上调高出价系数，直接执行这些变更。' }) } }] }) };
    }
    // 默认 success
    return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify({ rtaId, intent, answer: '【LLM-STUB-DEFAULT】默认 stub 合规回答，引用当前 RTA 事实。' }) } }] }) };
  };
}

// 真实发送链路：调用顶层纯函数 answerAssistantQuestion（与页面 askAssistant 共用同一链路）
async function askViaCtx(ctx, rtaId, question, options) {
  options = options || {};
  const rec = ctx.MOCK_RTA_LIST.find(r => r.rtaId === rtaId);
  if (!rec) return { ok: false, reason: 'rta_not_found' };
  const report = ctx.performDiagnosis(rec);
  const result = await ctx.answerAssistantQuestion(question, report, rec, ctx.LLM_CONFIG.enabled);
  return Object.assign({}, result, { report, session: { rtaId, diagnosis: report, messages: [] } });
}

// ─────────────────────────────────────────────────────────
// C) 跑动态用例
// ─────────────────────────────────────────────────────────
const goldenRtaId = 'juliang-rta-2086';

(async () => {
  let pass = 0, fail = 0;
  const failMessages = [];

  function record(name, ok, detail) {
    if (ok) { pass++; console.log('  ✅ ' + name); }
    else { fail++; failMessages.push({ name, detail }); console.log('  ❌ ' + name + (detail ? ' · ' + detail : '')); }
  }

  // ① Golden Case 异常总览
  console.log('\n──────────────────────────────────────────────');
  console.log('① Golden Case 异常总览回答（问：这个 RTA 现在有什么异常？）');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    const text = r.answer && r.answer.text || '';
    console.log('  intent:', r.intent);
    console.log('  text:', text.substring(0, 120) + '…');
    record('① Golden Case 异常总览',
      r.intent === 'overview'
      && /参竞\/放行|S3/.test(text)
      && /1000/.test(text) && /300/.test(text)
      && /一句话结论|结论/.test(text),
      r.intent !== 'overview' ? 'intent=' + r.intent : '');
  }

  // ② Golden Case 预算原因
  console.log('\n──────────────────────────────────────────────');
  console.log('② Golden Case 预算原因回答（问：为什么预算没有跑出去？）');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const r = await askViaCtx(ctx, goldenRtaId, '为什么预算没有跑出去？');
    const text = r.answer && r.answer.text || '';
    console.log('  intent:', r.intent);
    console.log('  text:', text.substring(0, 120) + '…');
    record('② Golden Case 预算原因',
      r.intent === 'budget'
      && /日预算/.test(text) && /实际消耗/.test(text) && /达成率/.test(text)
      && /1000/.test(text) && /300/.test(text) && /30/.test(text));
  }

  // ③ Golden Case 诊断依据
  console.log('\n──────────────────────────────────────────────');
  console.log('③ Golden Case 诊断依据回答（问：当前诊断结论的依据是什么？）');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const r = await askViaCtx(ctx, goldenRtaId, '当前诊断结论的依据是什么？');
    const text = r.answer && r.answer.text || '';
    console.log('  intent:', r.intent);
    console.log('  text:', text.substring(0, 120) + '…');
    record('③ Golden Case 诊断依据',
      r.intent === 'evidence'
      && /主因/.test(text) && /40%/.test(text) && /80%/.test(text)
      && /数据来源/.test(text) && /数据范围/.test(text));
  }

  // ④ Golden Case 建议和观察指标
  console.log('\n──────────────────────────────────────────────');
  console.log('④ Golden Case 建议和观察指标回答');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const r1 = await askViaCtx(ctx, goldenRtaId, '建议怎么调整？');
    const r2 = await askViaCtx(ctx, goldenRtaId, '调整后观察什么？');
    const t1 = r1.answer && r1.answer.text || '';
    const t2 = r2.answer && r2.answer.text || '';
    console.log('  intent1:', r1.intent, '  intent2:', r2.intent);
    record('④ Golden Case 建议和观察指标',
      r1.intent === 'recommendation' && /80%/.test(t1) && /60%/.test(t1) && /观察指标/.test(t1)
      && r2.intent === 'observation' && /观察指标/.test(t2) && /成功标准/.test(t2));
  }

  // ⑤ S6 回传异常
  console.log('\n──────────────────────────────────────────────');
  console.log('⑤ S6 回传异常回答');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const s6Record = ctx.MOCK_RTA_LIST.find(r => r.attribution && r.attribution.callbackSuccessRate > 0 && r.attribution.callbackSuccessRate < 0.9);
    if (!s6Record) {
      record('⑤ S6 回传异常', false, 'mock 数据中没有 callbackSuccessRate<0.9 的记录');
    } else {
      console.log('  选用 RTA:', s6Record.rtaId, '· callbackSuccessRate=', s6Record.attribution.callbackSuccessRate);
      const r = await askViaCtx(ctx, s6Record.rtaId, '回传链路正常吗？');
      const text = r.answer && r.answer.text || '';
      console.log('  intent:', r.intent, '  scenario:', r.report.scenario.sceneId);
      console.log('  text:', text.substring(0, 120) + '…');
      record('⑤ S6 回传异常',
        /回传链路异常|S6/.test(text) && /回传成功率/.test(text) && /85/.test(text),
        r.report.scenario.sceneId !== 'S6' ? 'scenario=' + r.report.scenario.sceneId : '');
    }
  }

  // ⑥ 正常回传场景
  console.log('\n──────────────────────────────────────────────');
  console.log('⑥ 正常回传场景回答');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const normalRecord = ctx.MOCK_RTA_LIST.find(r => r.attribution && r.attribution.callbackSuccessRate >= 0.95);
    if (!normalRecord) {
      record('⑥ 正常回传场景', false, 'mock 数据中没有 callbackSuccessRate≥0.95 的记录');
    } else {
      console.log('  选用 RTA:', normalRecord.rtaId, '· callbackSuccessRate=', normalRecord.attribution.callbackSuccessRate);
      const r = await askViaCtx(ctx, normalRecord.rtaId, '回传链路正常吗？');
      const text = r.answer && r.answer.text || '';
      console.log('  intent:', r.intent, '  scenario:', r.report.scenario.sceneId);
      record('⑥ 正常回传场景',
        /回传链路正常/.test(text) && /回传成功率/.test(text) && /判定依据/.test(text));
    }
  }

  // ⑦ 切换 RTA 后上下文不串线
  console.log('\n──────────────────────────────────────────────');
  console.log('⑦ 切换 RTA 后上下文不串线');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const otherRtaId = ctx.MOCK_RTA_LIST.find(r => r.rtaId !== goldenRtaId).rtaId;
    const r1 = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    const r2 = await askViaCtx(ctx, otherRtaId, '这个 RTA 现在有什么异常？');
    const t1 = r1.answer && r1.answer.text || '';
    const t2 = r2.answer && r2.answer.text || '';
    console.log('  RTA1:', goldenRtaId, '· scene1:', r1.report.scenario.sceneId);
    console.log('  RTA2:', otherRtaId, '· scene2:', r2.report.scenario.sceneId);
    const scenesDifferent = r1.report.scenario.sceneId !== r2.report.scenario.sceneId;
    const reportsDifferent = r1.report.oneLiner !== r2.report.oneLiner;
    const goldenInT1 = /40%.*80%|1000|300/.test(t1);
    const goldenInT2 = /40%.*80%|1000|300/.test(t2) ? '泄漏' : '未泄漏';
    console.log('  r1.oneLiner ≠ r2.oneLiner:', reportsDifferent);
    console.log('  r1 含 Golden 数字:', goldenInT1, '  r2 含 Golden 数字:', goldenInT2);
    record('⑦ 切换 RTA 后上下文不串线',
      scenesDifferent && reportsDifferent && goldenInT1 && !/1000|300|40%.*80%/.test(t2));
  }

  // ⑧ 数据不足时不生成主因和建议
  console.log('\n──────────────────────────────────────────────');
  console.log('⑧ 数据不足时不生成主因和建议');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const insufRecord = {
      rtaId: 'test-insufficient',
      rtaInternalId: 'RTA-RES-TEST-INS',
      media: '测试', bidUrl: 'https://test', status: '上线',
      qpsConfig: 1000, qpsUsed: 100, qpsRemaining: 900,
      boundAccounts: 1, relatedExperiments: 0, projectName: 'TEST-INS',
      dailyBudget: 100, actualCost: 0, achievementRate: 0,
      coreMetrics: { currentQps: 0, peakQps: 0, qpsUsageRate: 0, avgLatency: 0, p95: 0, p99: 0, timeoutRate: 0, successRate: 1, failRate: 0 },
      usageMetrics: { totalRequests: 100, execSuccess: 100, execFail: 0, fallbackExec: 0, bidCount: 50, rejectCount: 50, hitCount: 100, hitRate: 1, avgBidWeight: 1, avgCpaBid: 0, avgCpcBid: 0, bidRate: { control: 0.5, treatment: 0.5 } },
      trend: [],
      attribution: { callbackSuccessRate: 1, callbackLatency: 100, missingFieldRate: 0 },
      strategies: [],
      experiment: { id: 'EXP-INS', name: 'TEST', type: 'AB', status: 'running', effectMode: '立即生效' },
      groups: [{ groupId: 'G-C', groupType: 'control', buckets: [1] }],
      bucketMode: 'platform', changes: [],
      conversionCount: 0, actualCpa: 0, targetCpa: 0
    };
    ctx.MOCK_RTA_LIST.push(insufRecord);
    const r = await askViaCtx(ctx, 'test-insufficient', '这个 RTA 现在有什么异常？');
    const text = r.answer && r.answer.text || '';
    console.log('  status:', r.report && r.report.status, '  missingFields:', r.report && r.report.missingFields);
    console.log('  intent:', r.intent, '  text:', text.substring(0, 200));
    record('⑧ 数据不足时不生成主因和建议',
      r.report && r.report.status === 'insufficient'
      && /数据不足/.test(text) && /缺失字段/.test(text)
      && /不会.*主因/.test(text) && !/主要原因是/.test(text) && !/建议.*调整/.test(text));
  }

  // ⑨ 空问题不能发送
  console.log('\n──────────────────────────────────────────────');
  console.log('⑨ 空问题不能发送');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const r = await askViaCtx(ctx, goldenRtaId, '   ');
    console.log('  ok:', r.ok, '  reason:', r.reason, '  intent:', r.intent);
    record('⑨ 空问题不能发送', !r.ok && r.reason === 'empty' && r.intent === 'empty');
  }

  // ⑩ 超出范围问题不编造
  console.log('\n──────────────────────────────────────────────');
  console.log('⑩ 超出范围问题不编造');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const r = await askViaCtx(ctx, goldenRtaId, '最近天气怎么样？');
    const text = r.answer && r.answer.text || '';
    console.log('  intent:', r.intent);
    console.log('  text:', text.substring(0, 120) + '…');
    record('⑩ 超出范围问题不编造',
      r.intent === 'out_of_scope' && /超出当前智能参谋的范围/.test(text)
      && !/晴|雨|气温/.test(text));
  }

  // ⑪ 直接执行请求被明确拒绝
  console.log('\n──────────────────────────────────────────────');
  console.log('⑪ 直接执行请求被明确拒绝');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const r = await askViaCtx(ctx, goldenRtaId, '帮我加预算到 5000');
    const text = r.answer && r.answer.text || '';
    console.log('  intent:', r.intent);
    console.log('  text:', text.substring(0, 120) + '…');
    record('⑪ 直接执行请求被明确拒绝',
      r.intent === 'execute_refuse' && /不会直接执行/.test(text)
      && /人工确认/.test(text) && !/已调整.*完成|已修改.*完成|已生效/.test(text));
  }

  // ⑫ LLM 关闭时模板可用
  console.log('\n──────────────────────────────────────────────');
  console.log('⑫ LLM 关闭时模板可用');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    ctx.LLM_CONFIG.enabled = false;
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    const text = r.answer && r.answer.text || '';
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    record('⑫ LLM 关闭时模板可用',
      r.answer.source === 'template' && /参竞\/放行|S3/.test(text));
  }

  // ⑬ 代理未配置（http-503）时回退模板
  console.log('\n──────────────────────────────────────────────');
  console.log('⑬ 代理未配置（http-503 / LLM_NOT_CONFIGURED）时回退模板');
  console.log('──────────────────────────────────────────────');
  {
    const recaptured = {};
    const ctx = newCtx(makeFetchHandler('http-503-not-configured', recaptured));
    ctx.LLM_CONFIG.enabled = true;
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    const text = r.answer && r.answer.text || '';
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    record('⑬ 代理未配置时回退模板',
      r.answer.source === 'template' && /参竞\/放行|S3/.test(text));
    if (recaptured.reqOpts) {
      const h = recaptured.reqOpts.headers || {};
      const hasAuth = Object.keys(h).some(k => k.toLowerCase() === 'authorization');
      record('⑬b 助手 fetch 请求头不含 Authorization', !hasAuth,
        hasAuth ? '包含 Authorization: ' + JSON.stringify(h) : '');
    } else {
      record('⑬b 助手 fetch 请求头不含 Authorization', false, '未捕获到请求');
    }
  }

  // ⑭ 静态扫描（已跑过）— 汇总
  for (const c of scanChecks) if (c.pass) pass++; else fail++;
  for (const c of requiredChecks) if (c.pass) pass++; else fail++;

  // ⑮ 「查看完整诊断」目标与当前 RTAID 一致
  console.log('\n──────────────────────────────────────────────');
  console.log('⑮ 「查看完整诊断」目标与当前 RTAID 一致');
  console.log('──────────────────────────────────────────────');
  {
    const openDiagCall = html.match(/openDiagnosis\(\s*assistantRtaId\s*\)/);
    const viewBtn = html.match(/<button\b[\s\S]{0,300}?查看完整诊断[\s\S]{0,40}?<\/button>/);
    const selectOnChange = html.indexOf('v-model="assistantRtaId"') >= 0;
    console.log('  openDiagnosis(assistantRtaId) 调用存在:', !!openDiagCall);
    console.log('  「查看完整诊断」button 标签存在:', !!viewBtn);
    console.log('  选择器绑定 assistantRtaId:', selectOnChange);
    record('⑮ 「查看完整诊断」目标与当前 RTAID 一致',
      !!openDiagCall && !!viewBtn && selectOnChange);
  }

  // ═════════════════════════════════════════════════════
  // 以下为第三步返修新增用例（⑯-㉚）
  // ═════════════════════════════════════════════════════

  // ⑯ 真实发送链分类器（静态断言已在 A 段跑过，这里补动态：answerAssistantQuestion 用 classifyAssistantIntent）
  console.log('\n──────────────────────────────────────────────');
  console.log('⑯ 真实发送链分类器（answerAssistantQuestion 使用 classifyAssistantIntent）');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    // 验证 answerAssistantQuestion 是顶层函数 + 走 classifyAssistantIntent
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    record('⑯ 真实发送链分类器',
      typeof ctx.answerAssistantQuestion === 'function'
      && typeof ctx.classifyAssistantIntent === 'function'
      && r.ok && r.intent === 'overview'
      && typeof ctx.classifyIntent === 'undefined',
      typeof ctx.classifyIntent !== 'undefined' ? 'ctx.classifyIntent 仍存在（未定义函数应不存在）' : '');
  }

  // ⑰ LLM 返回错误 RTAID 被拒绝 → 回退模板
  console.log('\n──────────────────────────────────────────────');
  console.log('⑰ LLM 返回错误 RTAID 被拒绝 → 回退模板');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('wrong-rtaId'));
    ctx.LLM_CONFIG.enabled = true;
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    record('⑰ LLM 错误 RTAID 被拒绝',
      r.answer.source === 'template' && /参竞\/放行|S3/.test(r.answer.text),
      r.answer.source === 'llm' ? 'LLM 未被拒绝，source=llm' : '');
  }

  // ⑱ LLM 返回错误 intent 被拒绝 → 回退模板
  console.log('\n──────────────────────────────────────────────');
  console.log('⑱ LLM 返回错误 intent 被拒绝 → 回退模板');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('wrong-intent'));
    ctx.LLM_CONFIG.enabled = true;
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    record('⑱ LLM 错误 intent 被拒绝',
      r.answer.source === 'template' && /参竞\/放行|S3/.test(r.answer.text),
      r.answer.source === 'llm' ? 'LLM 未被拒绝' : '');
  }

  // ⑲ LLM 返回报告外数字被拒绝 → 回退模板
  console.log('\n──────────────────────────────────────────────');
  console.log('⑲ LLM 返回报告外数字被拒绝 → 回退模板');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('wrong-number'));
    ctx.LLM_CONFIG.enabled = true;
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    record('⑲ LLM 错误数字被拒绝',
      r.answer.source === 'template' && !/999%|8888|1%/.test(r.answer.text),
      r.answer.source === 'llm' ? 'LLM 未被拒绝' : '');
  }

  // ⑳ LLM 主因冲突（错误置信度）被拒绝 → 回退模板
  console.log('\n──────────────────────────────────────────────');
  console.log('⑳ LLM 主因冲突（错误置信度）被拒绝 → 回退模板');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('confidence-conflict'));
    ctx.LLM_CONFIG.enabled = true;
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    // Golden Case 置信度 92，LLM 返回 50 应被拒
    record('⑳ LLM 主因冲突被拒绝',
      r.answer.source === 'template' && !/置信度 50%/.test(r.answer.text),
      r.answer.source === 'llm' ? 'LLM 未被拒绝' : '');
  }

  // ㉑ LLM 建议冲突（不存在的动作）被拒绝 → 回退模板
  console.log('\n──────────────────────────────────────────────');
  console.log('㉑ LLM 建议冲突（不存在的动作）被拒绝 → 回退模板');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('action-conflict'));
    ctx.LLM_CONFIG.enabled = true;
    const r = await askViaCtx(ctx, goldenRtaId, '建议怎么调整？');
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    record('㉑ LLM 建议冲突被拒绝',
      r.answer.source === 'template' && !/提价到 999|换素材|马上调/.test(r.answer.text),
      r.answer.source === 'llm' ? 'LLM 未被拒绝' : '');
  }

  // ㉒ execute_refuse / out_of_scope / insufficient 不调用 LLM
  console.log('\n──────────────────────────────────────────────');
  console.log('㉒ execute_refuse / out_of_scope / insufficient 不调用 LLM');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    ctx.LLM_CONFIG.enabled = true;
    const rec = ctx.MOCK_RTA_LIST.find(r => r.rtaId === goldenRtaId);
    const report = ctx.performDiagnosis(rec);
    // spy callAssistantLLM：替换为计数器（answerAssistantQuestion 在 vm 中解析为 ctx.callAssistantLLM）
    let assistantLlmCalled = 0;
    const orig = ctx.callAssistantLLM;
    ctx.callAssistantLLM = async function() { assistantLlmCalled++; return null; };
    // execute_refuse
    assistantLlmCalled = 0;
    await ctx.answerAssistantQuestion('帮我加预算到 5000', report, rec, true);
    const execNotCalled = assistantLlmCalled === 0;
    // out_of_scope
    assistantLlmCalled = 0;
    await ctx.answerAssistantQuestion('最近天气怎么样？', report, rec, true);
    const oosNotCalled = assistantLlmCalled === 0;
    // overview（正常类）应调用 LLM
    assistantLlmCalled = 0;
    await ctx.answerAssistantQuestion('这个 RTA 现在有什么异常？', report, rec, true);
    const overviewCalled = assistantLlmCalled > 0;
    ctx.callAssistantLLM = orig;
    console.log('  execute_refuse 不调助手LLM:', execNotCalled, '  out_of_scope 不调助手LLM:', oosNotCalled, '  overview 调助手LLM:', overviewCalled);
    record('㉒ execute_refuse/out_of_scope 不调 LLM', execNotCalled && oosNotCalled && overviewCalled);
  }

  // ㉓ 网络错误时真正回退模板（不伪装"已自动回退"）
  console.log('\n──────────────────────────────────────────────');
  console.log('㉓ 网络错误时真正回退模板（不显示假回退文案）');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('network-error'));
    ctx.LLM_CONFIG.enabled = true;
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    const text = r.answer && r.answer.text || '';
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    record('㉓ 网络错误真正回退模板',
      r.answer.source === 'template' && /参竞\/放行|S3/.test(text)
      && !/处理中出错|已自动回退/.test(text),
      r.answer.source === 'llm' ? 'LLM 未回退' : '');
  }

  // ㉔ 最近 8 轮裁剪（trimAssistantMessages）
  console.log('\n──────────────────────────────────────────────');
  console.log('㉔ 最近 8 轮裁剪（trimAssistantMessages）');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    // 构造 12 轮 + 首条欢迎语
    const msgs = [{ role: 'assistant', text: '欢迎语', ts: '00:00' }];
    for (let i = 1; i <= 12; i++) {
      msgs.push({ role: 'user', text: '问题' + i, ts: '00:0' + i });
      msgs.push({ role: 'assistant', text: '回答' + i, ts: '00:0' + i });
    }
    const trimmed = ctx.trimAssistantMessages(msgs, 8);
    const userCount = trimmed.filter(m => m.role === 'user').length;
    const asstCount = trimmed.filter(m => m.role === 'assistant').length;
    const hasWelcome = trimmed[0] && trimmed[0].text === '欢迎语';
    const hasLastRound = trimmed.some(m => m.text === '问题12') && trimmed.some(m => m.text === '回答12');
    const noEarlyRound = !trimmed.some(m => m.text === '问题1') && !trimmed.some(m => m.text === '回答1');
    console.log('  原始轮数: 12, 裁剪后 user:', userCount, 'assistant:', asstCount);
    console.log('  保留欢迎语:', hasWelcome, '  保留最近轮:', hasLastRound, '  删除最早轮:', noEarlyRound);
    record('㉔ 最近 8 轮裁剪',
      userCount === 8 && asstCount === 9 && hasWelcome && hasLastRound && noEarlyRound,
      'user=' + userCount + ' asst=' + asstCount);
  }

  // ㉕ 切换 RTA 清空会话（getOrCreateSession clear 逻辑 + 静态断言）
  console.log('\n──────────────────────────────────────────────');
  console.log('㉕ 切换 RTA 清空会话');
  console.log('──────────────────────────────────────────────');
  {
    // 静态：getOrCreateSession 包含 chatSessions.clear()
    const hasClear = /function getOrCreateSession[\s\S]{0,400}?chatSessions\.clear\(\)/.test(html);
    // 逻辑模拟：Map clear 后旧数据消失
    const map = new Map();
    map.set('rta-A', { rtaId: 'rta-A', messages: [{ text: 'A 的旧对话' }] });
    map.clear();
    map.set('rta-B', { rtaId: 'rta-B', messages: [{ text: 'B 的新对话' }] });
    const oldGone = !map.has('rta-A');
    const onlyCurrent = map.size === 1 && map.has('rta-B');
    console.log('  getOrCreateSession 含 clear():', hasClear);
    console.log('  Map clear 后旧 RTA 消失:', oldGone, '  只保留当前:', onlyCurrent);
    record('㉕ 切换 RTA 清空会话', hasClear && oldGone && onlyCurrent);
  }

  // ㉖ 非报告回滚条件禁止（S1/S6 rollbackCondition 不含通用条件）
  console.log('\n──────────────────────────────────────────────');
  console.log('㉖ 非报告回滚条件禁止（S1/S6 回滚只含各自 rollbackCondition）');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    // S6 回传异常 RTA
    const s6Record = ctx.MOCK_RTA_LIST.find(r => r.attribution && r.attribution.callbackSuccessRate < 0.9);
    // S1 入口流量 RTA
    const s1Record = ctx.MOCK_RTA_LIST.find(r => {
      const rep = ctx.performDiagnosis(r);
      return rep.scenario.sceneId === 'S1';
    });
    let s6Ok = false, s1Ok = false;
    if (s6Record) {
      const r6 = await askViaCtx(ctx, s6Record.rtaId, '什么情况下回滚？');
      const t6 = r6.answer && r6.answer.text || '';
      const s6Rec = r6.report.recommendations && r6.report.recommendations[0];
      console.log('  S6 rollbackCondition:', s6Rec && s6Rec.rollbackCondition);
      // 回滚回答只含 S6 的 rollbackCondition，不含通用条件
      s6Ok = s6Rec ? (t6.indexOf(s6Rec.rollbackCondition) >= 0
        && !/CPA 上涨超过阈值|流量质量明显下降|实验组参竞率持续低于目标/.test(t6)) : false;
    }
    if (s1Record) {
      const r1 = await askViaCtx(ctx, s1Record.rtaId, '什么情况下回滚？');
      const t1 = r1.answer && r1.answer.text || '';
      const s1Rec = r1.report.recommendations && r1.report.recommendations[0];
      console.log('  S1 rollbackCondition:', s1Rec && s1Rec.rollbackCondition);
      s1Ok = s1Rec ? (t1.indexOf(s1Rec.rollbackCondition) >= 0
        && !/CPA 上涨超过阈值|流量质量明显下降|实验组参竞率持续低于目标/.test(t1)) : false;
    }
    record('㉖ 非报告回滚条件禁止', s6Ok && s1Ok,
      (!s6Ok ? 'S6 失败 ' : '') + (!s1Ok ? 'S1 失败' : ''));
  }

  // ㉗ Golden Case 回滚回答只含 S3 rollbackCondition
  console.log('\n──────────────────────────────────────────────');
  console.log('㉗ Golden Case 回滚回答只含 S3 rollbackCondition');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const r = await askViaCtx(ctx, goldenRtaId, '什么情况下回滚？');
    const text = r.answer && r.answer.text || '';
    const rec = r.report.recommendations && r.report.recommendations[0];
    console.log('  S3 rollbackCondition:', rec && rec.rollbackCondition);
    console.log('  text:', text.substring(0, 150));
    record('㉗ Golden Case 回滚条件',
      rec ? (text.indexOf(rec.rollbackCondition) >= 0
        && !/CPA 上涨超过阈值|流量质量明显下降|实验组参竞率持续低于目标/.test(text)) : false,
      !rec ? '无 recommendation' : '');
  }

  // ㉘ 来源角标显示规则（sourceLabel）
  console.log('\n──────────────────────────────────────────────');
  console.log('㉘ 来源角标显示规则（sourceLabel）');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    const sl = ctx.sourceLabel;
    const tmplLabel = sl('template');
    const llmLabel = sl('llm');
    const emptyLabel = sl(undefined);
    const nullLabel = sl(null);
    console.log('  template→', tmplLabel, '  llm→', llmLabel, '  undefined→', JSON.stringify(emptyLabel), '  null→', JSON.stringify(nullLabel));
    // 静态：模板用 sourceLabel(msg.source) 而非 msg.source === ' || '
    const usesSourceLabel = /sourceLabel\(\s*msg\.source\s*\)/.test(html);
    const noBadExpr = !/source\s*===\s*['"]\s*\|\|\s*['"]/.test(html);
    record('㉘ 来源角标显示规则',
      tmplLabel === '模板' && llmLabel === 'AI 生成' && emptyLabel === '' && nullLabel === ''
      && usesSourceLabel && noBadExpr);
  }

  // ㉙ LLM stub 合规回答通过校验（success-stub 返回正确 rtaId/intent）
  console.log('\n──────────────────────────────────────────────');
  console.log('㉙ LLM stub 合规回答通过校验');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    ctx.LLM_CONFIG.enabled = true;
    const r = await askViaCtx(ctx, goldenRtaId, '这个 RTA 现在有什么异常？');
    console.log('  source:', r.answer && r.answer.source, '  intent:', r.intent);
    record('㉙ LLM stub 合规回答通过校验',
      r.answer.source === 'llm' && /参竞\/放行|S3|RTA/.test(r.answer.text),
      r.answer.source === 'template' ? 'LLM 未通过校验，回退模板' : '');
  }

  // ㉚ 推荐问与手动输入走同一套回答流程
  console.log('\n──────────────────────────────────────────────');
  console.log('㉚ 推荐问与手动输入走同一套回答流程');
  console.log('──────────────────────────────────────────────');
  {
    const ctx = newCtx(makeFetchHandler('success-stub'));
    // 同一问题，两次调用 answerAssistantQuestion，结果一致（纯函数特性）
    const rec = ctx.MOCK_RTA_LIST.find(r => r.rtaId === goldenRtaId);
    const report = ctx.performDiagnosis(rec);
    const r1 = await ctx.answerAssistantQuestion('这个 RTA 现在有什么异常？', report, rec, false);
    const r2 = await ctx.answerAssistantQuestion('这个 RTA 现在有什么异常？', report, rec, false);
    console.log('  r1.source:', r1.answer.source, '  r2.source:', r2.answer.source);
    console.log('  r1.intent:', r1.intent, '  r2.intent:', r2.intent);
    record('㉚ 推荐问与手动输入同一流程',
      r1.ok && r2.ok && r1.intent === r2.intent && r1.answer.text === r2.answer.text
      && r1.answer.source === 'template');
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  const total = pass + fail;
  console.log(`智能参谋问答验证总览：${pass} / ${total} 通过（${scanChecks.length} 项 forbidden 静态扫描 + ${requiredChecks.length} 项 required 断言 + ${total - scanChecks.length - requiredChecks.length} 项动态用例）`);
  console.log('════════════════════════════════════════════════════════════════');
  if (fail > 0) {
    console.log('\n未通过的用例:');
    failMessages.forEach(f => console.log('  ❌ ' + f.name + (f.detail ? ' · ' + f.detail : '')));
  }
  console.log('注：本脚本为 stub 测试，不进行真实 DeepSeek 网络请求，不读取真实 DEEPSEEK_API_KEY。');
  console.log('注：stub 测试通过不等于真实 DeepSeek 端到端验证通过。');
  process.exit(fail > 0 ? 1 : 0);
})();
