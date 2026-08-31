// v6 LLM 路径验证脚本（Node.js + vm + fetch stub + 静态扫描）
// v6 final 安全版：覆盖 10 个用例
//   ① LLM 关闭 → 不调 fetch，返回 null
//   ② LLM 开启 + 合规 stub → 返回 LLM 结果（_source: 'llm'）
//   ③ 网络错误 → 回退模板
//   ④ HTTP 500 → 回退模板
//   ⑤ HTTP 503 / LLM_NOT_CONFIGURED → 回退模板（新增：代理缺 Key 路径）
//   ⑥ 错误 JSON → 回退模板
//   ⑦ 输出不合规 → 回退模板
//   ⑧ [扫描] 前端请求 headers 中不存在 Authorization
//   ⑨ [扫描] index.html 中不存在 LLM_CONFIG.apiKey
//   ⑩ [扫描] 前端源码中不存在要求填写真实 Key 的提示
//
// 测试使用 fetch stub，不进行真实网络请求，不读取真实环境变量，不打印任何 Key 内容。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, 'index.html');

// ─────────────────────────────────────────────────────────
// A) 静态扫描（3 项安全断言，在 vm 跑之前先发现安全隐患）
// ─────────────────────────────────────────────────────────
const html = fs.readFileSync(HTML_PATH, 'utf8');

const scanChecks = [
  {
    name: '⑨ index.html 不存在 LLM_CONFIG.apiKey 字段',
    forbiddenRe: /LLM_CONFIG\.apiKey\b|\bapiKey\s*:/,
    description: 'LLM_CONFIG 不应包含 apiKey 字段；Key 仅由代理进程持有。',
    occurrences: [],
    pass: false
  },
  {
    name: '⑧ 前端请求 headers 中不存在 Authorization 字面字段',
    // 允许注释里出现 "Authorization" 字样（说明"不发 Authorization"），
    // 但不允许出现真发 Authorization 头的代码：
    forbiddenRe: /headers\s*:\s*\{[^}]*['"]Authorization['"]\s*:/,
    description: 'fetch(...) 的 headers 不应包含 Authorization 字段；Key 不能从浏览器流出。',
    occurrences: [],
    pass: false
  },
  {
    name: '⑩ 前端源码中不存在要求填写真实 Key 的提示（"填入"+apiKey/deepseek key 风格）',
    // "LLM_CONFIG.apiKey 填入 DeepSeek key" "切勿 commit" "Demonstration" "真实产品中 API key"
    // 例：要拒的是「用户将真实 Key 填入前端」的提示语
    forbiddenRe: /(填入.*?(?:apiKey|DeepSeek\s*key|key\s*到)|把\s*Key\s*放(?:入|到).*?前端|手动填入.*?(?:apiKey|key)|请在.*?源码.*?填)/i,
    description: 'README / 注释 / UI 不应教用户把真实 Key 写进前端源码。',
    occurrences: [],
    pass: false
  }
];

console.log('════════════════════════════════════════════════════════════════');
console.log('A) 静态扫描（前端不持有 Key / 不发 Auth 头 / 无前端填 Key 提示）');
console.log('════════════════════════════════════════════════════════════════');
for (const c of scanChecks) {
  const matches = [];
  let m;
  c.forbiddenRe.lastIndex = 0;
  while ((m = c.forbiddenRe.exec(html)) !== null) {
    const line = html.slice(0, m.index).split('\n').length;
    matches.push({ line, snippet: m[0].slice(0, 80) });
    if (matches.length > 5) break;
  }
  c.occurrences = matches;
  c.pass = matches.length === 0;
  console.log(`${c.pass ? '✅' : '❌'} ${c.name}`);
  if (!c.pass) {
    for (const x of matches) console.log(`     L${x.line}: ${x.snippet}`);
  }
}

// ─────────────────────────────────────────────────────────
// B) 加载主代码（与 _verify.cjs 同样手法）
// ─────────────────────────────────────────────────────────
const mainMatch = html.match(/<script>\s*'use strict';[\s\S]*?<\/script>/);
if (!mainMatch) { console.error('未找到主逻辑 <script>'); process.exit(1); }
let mainCode = mainMatch[0].replace(/^<script>\s*/, '').replace(/\s*<\/script>$/, '');
mainCode = mainCode.replace(/const app = createApp[\s\S]*?app\.mount\('#app'\);?/g, '');
mainCode = mainCode.replace(/^const /gm, 'var ').replace(/\nconst /g, '\nvar ');
const stubVue = 'const Vue = { createApp: () => ({ mount: () => null }), ref: v => ({ value: v }), reactive: v => v, computed: v => ({ value: v() }), watch: () => {}, onMounted: () => {}, nextTick: () => Promise.resolve() };';

// ─────────────────────────────────────────────────────────
// C) fetch stub 工厂（注意：所有 stub 都不写 Authorization 头，模拟前端真实行为）
// ─────────────────────────────────────────────────────────
function makeFetchHandler(scenario, recapturedHeaders) {
  // recapturedHeaders：把 stub 看到的请求头传出来，让静态扫描 ⑧ 在动态侧也能交叉验证
  let fetchCount = 0;
  return async function fetchStub(url, opts) {
    fetchCount++;
    // 真实地记录请求头（不修改），用于跨验证
    if (recapturedHeaders) {
      recapturedHeaders.reqUrl = url;
      recapturedHeaders.reqOpts = { ...opts, headers: { ...(opts && opts.headers || {}) } };
    }
    // ① 关闭态不走这里（runScenario 设 enabled=false 直接 null 短路）
    if (scenario === 'network-error') {
      throw new Error('Network unreachable (stub)');
    }
    if (scenario === 'http-500') {
      return { ok: false, status: 500, text: async () => 'Internal Server Error (stub)' };
    }
    if (scenario === 'http-503-not-configured') {
      // 模拟 llm-proxy.mjs 缺 Key 的标准响应
      return { ok: false, status: 503, text: async () => JSON.stringify({ error: 'LLM_NOT_CONFIGURED', message: '代理未持有 DEEPSEEK_API_KEY（stub）' }) };
    }
    if (scenario === 'malformed-json') {
      return { ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: 'not a json {{{ broken' } }] }) };
    }

    let userMsg, userPayload, recBefore, recAfter, sceneId;
    try {
      userMsg = JSON.parse(opts.body);
      const content = userMsg.messages[1].content;
      const start = content.indexOf('{');
      const end = content.indexOf('\n\n请输出', start);
      if (start < 0 || end < 0) throw new Error('userPrompt 中找不到 JSON 块');
      userPayload = JSON.parse(content.substring(start, end));
      sceneId = userPayload.scenario && userPayload.scenario.sceneId;
      recBefore = (userPayload.recommended && userPayload.recommended.recBefore) || '';
      recAfter = (userPayload.recommended && userPayload.recommended.recAfter) || '';
    } catch (e) {
      console.error('[stub JSON.parse error]', e.message);
      throw e;
    }

    let llmJson;
    if (scenario === 'success-golden') {
      llmJson = {
        oneLiner: `[LLM-STUB] 实验组准入门槛从 40% 调高到 80%，导致实验组参竞率从 60% 骤降至 10%，曝光与消耗下滑。`,
        managerSummary: `[LLM-STUB] Golden Case LLM 输出，用于验证 Golden Case 特判路径。`,
        operationsNote: `[LLM-STUB] 单主因场景，无独立次因。LLM stub 测试。`,
        causes: { primary: `实验组准入门槛 40%→80% 导致参竞率骤降（置信度 92%，高影响）`, secondary: '无独立次因' },
        recommendations: [{
          action: `回退准入门槛至 60% 小流量试跑（LLM stub）`,
          before: recBefore || '准入门槛 = 80%',
          after: recAfter || '准入门槛 = 60%',
          impact: '实验组参竞率预计从 10% 回升至 50%+',
          observeMetrics: ['实验组参竞率', '实验组消耗', '总预算达成率'],
          successCriteria: '实验组参竞率 ≥ 50%（验证窗口 24h）',
          rollbackCondition: '若 CPA 上涨 > 20% 或 CTR 下降 > 30%'
        }]
      };
    } else if (scenario === 'success-no-rec-values') {
      llmJson = {
        oneLiner: `[LLM-STUB-NOMATCH] 故意让 rec 数值与规则引擎不一致 → 应被校验拦截。`,
        managerSummary: `故意弄错建议值，触发 value_mismatch。`,
        operationsNote: `校验失败回退模板。`,
        causes: { primary: `测试：故意写错建议值`, secondary: '无独立次因' },
        recommendations: [{
          action: `故意写错的建议动作`,
          before: '9999%',
          after: '8888%',
          impact: '用于触发校验失败',
          observeMetrics: ['参数准确性'],
          successCriteria: '不应通过',
          rollbackCondition: '应回退模板'
        }]
      };
    } else {
      // 默认 success
      llmJson = {
        oneLiner: `[LLM-STUB-${sceneId}] 因果链描述（≥ 30 字含"导致"），用于校验通过路径。`,
        managerSummary: `[LLM-STUB-${sceneId}] 模板 stub 合规返回值。recBefore=${recBefore}, recAfter=${recAfter}`,
        operationsNote: `[LLM-STUB-${sceneId}] 运营解释 stub。`,
        causes: { primary: `[LLM-STUB] 场景 ${sceneId} 主因 stub`, secondary: '无独立次因' },
        recommendations: [{
          action: `[LLM-STUB] 调整动作`,
          before: recBefore || '当前值',
          after: recAfter || '建议值',
          impact: '影响 stub',
          observeMetrics: ['指标 1', '指标 2'],
          successCriteria: '成功标准 stub',
          rollbackCondition: '回滚条件 stub'
        }]
      };
    }

    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(llmJson) } }] })
    };
  };
}

// ─────────────────────────────────────────────────────────
// D) 跑各动态场景（每次都建独立 vm 上下文，模拟 runAiLayer 路径）
// ─────────────────────────────────────────────────────────
async function runScenario(label, llmEnabled, fetchScenario, expectCallLLMReturn, expectNoAuthHeader) {
  console.log('\n──────────────────────────────────────────────');
  console.log(label);
  console.log('──────────────────────────────────────────────');

  const ctx = { module: {}, exports: {}, console, window: undefined, setTimeout, clearTimeout };
  vm.createContext(ctx);

  const recapturedHeaders = {};
  const stub = makeFetchHandler(fetchScenario, recapturedHeaders);
  ctx.fetch = stub;
  ctx.AbortController = class { constructor() { this.signal = {}; } abort() {} };

  vm.runInContext(stubVue + '\n' + mainCode, ctx);
  ctx.LLM_CONFIG.enabled = llmEnabled;
  // 🔒 不再设 apiKey
  ctx.LLM_CONFIG.timeoutMs = 2000;

  const rec = ctx.MOCK_RTA_LIST.find(r => r.rtaId === 'juliang-rta-2086');
  const signals = ctx.runRules(rec);
  const scenario = ctx.detectScenario(signals, rec);

  const llmRet = await ctx.callLLM(rec, signals, scenario);
  const pass =
    expectCallLLMReturn === 'object' ? (llmRet && llmRet._source === 'llm')
    : expectCallLLMReturn === 'null'    ? (llmRet === null)
    : false;

  console.log('  callLLM 返回:', llmRet === null ? 'null（已回退模板）' : `object (_source=${llmRet && llmRet._source})`);
  console.log('  期望:', expectCallLLMReturn);
  console.log(pass ? '  ✅ 行为符合预期' : '  ❌ 不符');

  if (expectNoAuthHeader && recapturedHeaders.reqOpts) {
    const h = recapturedHeaders.reqOpts.headers || {};
    const hasAuth = Object.keys(h).some(k => k.toLowerCase() === 'authorization');
    console.log(`  抓到的请求头: ${JSON.stringify(h)}`);
    console.log(`  含 Authorization: ${hasAuth ? '是 ❌' : '否 ✅'}`);
    if (hasAuth) return false;
  }
  return pass;
}

(async () => {
  let pass = 0, fail = 0;

  // 静态扫描
  for (const c of scanChecks) {
    if (c.pass) pass++; else fail++;
  }

  // 动态场景
  const cases = [
    { label: '① LLM 关闭 → callLLM 应返回 null（不调 fetch）', llmEnabled: false, fetchScenario: 'success', expectCallLLMReturn: 'null' },
    { label: '② LLM 开启 + Golden Case 对齐 stub → callLLM 应返回 llm 对象', llmEnabled: true, fetchScenario: 'success-golden', expectCallLLMReturn: 'object', expectNoAuthHeader: true },
    { label: '③ LLM 开启 + 网络错误 → callLLM 应返回 null', llmEnabled: true, fetchScenario: 'network-error', expectCallLLMReturn: 'null', expectNoAuthHeader: true },
    { label: '④ LLM 开启 + HTTP 500 → callLLM 应返回 null', llmEnabled: true, fetchScenario: 'http-500', expectCallLLMReturn: 'null', expectNoAuthHeader: true },
    { label: '⑤ LLM 开启 + HTTP 503 / LLM_NOT_CONFIGURED（代理缺 Key）→ callLLM 应返回 null', llmEnabled: true, fetchScenario: 'http-503-not-configured', expectCallLLMReturn: 'null', expectNoAuthHeader: true },
    { label: '⑥ LLM 开启 + malformed JSON → callLLM 应返回 null', llmEnabled: true, fetchScenario: 'malformed-json', expectCallLLMReturn: 'null', expectNoAuthHeader: true },
    { label: '⑦ LLM 开启 + 建议值与规则引擎不一致 → callLLM 应返回 null（5 项校验失败）', llmEnabled: true, fetchScenario: 'success-no-rec-values', expectCallLLMReturn: 'null', expectNoAuthHeader: true }
  ];
  for (const c of cases) {
    const ok = await runScenario(c.label, c.llmEnabled, c.fetchScenario, c.expectCallLLMReturn, c.expectNoAuthHeader);
    if (ok) pass++; else fail++;
  }

  console.log('\n════════════════════════════════════════════════════════════════');
  console.log(`LLM 路径验证总览：${pass} / ${pass + fail} 通过（含 ${scanChecks.length} 项静态扫描 + ${cases.length} 项动态场景）`);
  console.log('════════════════════════════════════════════════════════════════');
  console.log('注：本脚本为 stub 测试，不读取真实 DEEPSEEK_API_KEY，不进行真实 DeepSeek 网络请求。');
  process.exit(fail === 0 ? 0 : 1);
})();
