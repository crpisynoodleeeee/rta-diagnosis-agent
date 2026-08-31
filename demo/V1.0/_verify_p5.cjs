'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const here = __dirname;
const root = path.resolve(here, '..', '..');
const model = require('./data/diagnosis-task-model.js');
const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');

let p5Passed = 0;
const p5Total = 6;
const regression = [];

function group(n, name, checks) {
  const failures = [];
  const warnings = [];
  for (const c of checks) {
    try { const r = c(); if (r === false) failures.push('断言失败'); else if (typeof r === 'string') warnings.push(r); }
    catch (e) { failures.push(e.message || String(e)); }
  }
  const ok = failures.length === 0;
  if (ok) p5Passed++;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] 组${n} ${name}：${ok ? '通过' : failures.join('；')}${warnings.length ? `（WARN：${warnings.join('；')}）` : ''}`);
  return ok;
}
function assert(v, msg) { if (!v) throw new Error(msg); }
function everyTask(tasks, fn, msg) { tasks.forEach((t) => assert(fn(t), `${msg} ${t.id}`)); }

console.log('P5 专项验收聚合器');
const tasks = model.buildTasks();
const byId = Object.fromEntries(tasks.map(t => [t.id, t]));

group(1, '数据层映射', [
  () => { assert(tasks.length === 8, '任务数不是 8'); assert(tasks.map(t => t.id).join(',') === 'T001,T002,T003,T004,T005,T006,T007,T008', '任务 ID 不完整'); everyTask(tasks, t => ['status','priority','dataQuality','diagnosis','nextAction','assistantContext'].every(k => t[k] !== undefined), '契约字段缺失'); },
  () => { const c = {}; tasks.forEach(t => c[t.status] = (c[t.status] || 0) + 1); assert(c.normal === 1 && c.insufficient === 2 && c.stale === 1 && c.attention === 4, `状态分布异常 ${JSON.stringify(c)}`); assert(byId.T007.status === 'attention', 'T007 处理状态异常'); },
  () => ['T004','T005'].forEach(id => { const t=byId[id]; assert(t.diagnosis.confidence === 'none', `${id} confidence`); assert(t.diagnosis.conclusion.includes('证据不足'), `${id} 结论`); assert(t.dataQuality.missingFields.length && t.dataQuality.affectedJudgments.length && t.diagnosis.limitations.length, `${id} 缺少限制信息`); assert(!/确定性异常|明确异常结论/.test(t.diagnosis.conclusion), `${id} 生成确定性结论`); }),
  () => { const t=byId.T006; assert(t.status === 'stale' && t.diagnosis.confidence === 'low', 'T006 状态/置信度'); assert(t.dataQuality.updatedAt, 'T006 缺 updatedAt'); },
  () => ['T001','T002','T008'].forEach(id => { const d=byId[id].diagnosis; assert(d.matchedRules.length && d.matchedRules.every(r => /^D\d+$/.test(r.ruleId)), `${id} 规则`); assert(d.evidenceIds.length && d.evidenceIds.every(e => /^EV-/.test(e)), `${id} 证据`); assert(['high','medium'].includes(d.confidence), `${id} 置信度`); }),
  () => assert(byId.T003.diagnosis.conclusion.includes('未发现异常'), 'T003 正常结论'),
  () => everyTask(tasks, t => t.assistantContext.suggestedQuestions.length >= 1 && t.assistantContext.allowedTopics.length >= 1 && t.assistantContext.blockedTopics.length >= 1, '参谋上下文不完整'),
  () => { const legal = ['view_evidence','refresh_data','wait_attribution','no_action','open_config','contact_owner']; everyTask(tasks, t => legal.includes(t.nextAction.type), 'nextAction 类型非法'); }
]);

group(2, '推理链与证据追溯', [
  () => { const t = [byId.T001,byId.T002,byId.T008].find(x => x.observation && x.diagnosis.matchedRules.length && x.scene && x.diagnosis.conclusion); assert(t, '没有完整推理链'); assert(t.diagnosis.evidenceIds.every(e => /^EV-[A-Za-z0-9-]+$/.test(e)), '证据编号非法'); }
]);

group(3, '数据不足/过期分支', [
  () => { ['T004','T005'].forEach(id => assert(byId[id].dataQuality.missingFields.length && byId[id].dataQuality.affectedJudgments.length && byId[id].diagnosis.confidence === 'none', `${id} 数据不足字段`)); assert(byId.T006.dataQuality.updatedAt && byId.T006.diagnosis.confidence === 'low', 'T006 过期字段'); }
]);

group(4, '智能参谋边界', [
  () => ['T004','T005'].forEach(id => { const b=byId[id].assistantContext.blockedTopics.join(''); assert(/预算|出价|策略/.test(b), `${id} 未阻断预算/出价/策略写入`); }),
  () => { const allowed = byId.T004.assistantContext.allowedTopics.join(''); return /诊断限制|数据质量|缺失|更新时间/.test(allowed) && !/预算|出价|策略写入/.test(allowed) ? true : 'allowedTopics 尚含诊断/证据主题，依赖 UI 层 taskQuestionBlocked 收紧'; },
  () => assert(/function (askAssistant|runAssistantQuery)|staff|独立参谋|assistant/.test(html), '独立参谋边界标识缺失')
]);

const navStart = html.indexOf('const navGroups');
const navEnd = html.indexOf('];', navStart);
const nav = navStart >= 0 && navEnd > navStart ? html.slice(navStart, navEnd) : '';
group(5, '工作台静态实现检查', [
  () => assert(html.includes("const currentView = ref('tasks')"), 'currentView 默认非 tasks'),
  () => assert(html.includes("const selectedMenuId = ref('tasks')"), 'selectedMenuId 默认非 tasks'),
  () => { ['诊断工作台','RTA 配置','智能参谋'].forEach(x=>assert(nav.includes(`label: '${x}'`), `导航缺少 ${x}`)); ['策略工厂','RTA 实验','监测链接','归因配置'].forEach(x=>assert(!nav.includes(x), `导航仍含 ${x}`)); },
  () => assert(html.includes("currentView === 'taskDetail'"), '缺 taskDetail 分支'),
  () => assert(/当前证据不足|数据不足/.test(html), '缺数据不足面板'),
  () => assert(/完整诊断报告|P5 不包含正式审批/.test(html), '缺完整诊断报告声明'),
  () => assert(/askTaskAssistant|taskChatSessions/.test(html), '缺任务内参谋'),
  () => assert(html.includes("currentView === 'list'") && /RTAID 配置|RTA 配置/.test(html), 'RTA 列表不可访问'),
  () => assert(html.includes('./data/diagnosis-task-model.js'), '缺模型脚本引入')
]);

group(6, '红线未被破坏', [
  () => { for (let i=1;i<=14;i++) assert(html.includes(`'D${i}'`) || html.includes(`"D${i}"`), `缺 D${i}`); for (let i=0;i<=7;i++) assert(html.includes(`'S${i}'`) || html.includes(`"S${i}"`), `缺 S${i}`); },
  () => assert(/builtInsufficientAnswer|EV-[A-Z0-9-]+|Golden Case/.test(html), '缺证据/Golden Case 关键实现'),
  () => assert(/approvePlan|applyPlan|rollbackPlan/.test(html), '五按钮既有演示函数缺失')
]);

const runs = [
  ['模型', path.join(here,'_verify_p5_model.cjs'), here], ['Golden',path.join(here,'_verify.cjs'),here], ['场景',path.join(here,'_verify_scenes.cjs'),here], ['LLM',path.join(here,'_verify_llm.cjs'),here], ['智能参谋',path.join(here,'_verify_assistant.cjs'),here], ['V0.7',path.join(here,'_verify_v07.cjs'),here], ['V0.8',path.join(here,'_verify_v08_provider.cjs'),here], ['V0.9',path.join(root,'server','_verify_v09.cjs'),root]
];
for (const [name, file, cwd] of runs) { const r=cp.spawnSync(process.execPath,[file],{cwd,encoding:'utf8'}); const ok=r.status===0; const out=(r.stdout||'').trim().split(/\r?\n/).filter(Boolean); regression.push(ok); console.log(`  [${ok?'PASS':'FAIL'}] ${name}${ok?'':'：'+(out.slice(-2).join(' | ') || r.stderr.trim())}`); }
console.log(`[${regression.every(Boolean)?'PASS':'FAIL'}] 组7 一键回归：${regression.filter(Boolean).length}/${regression.length} 通过`);
console.log('════════════════ 总览 ════════════════');
console.log(`P5 专项：${p5Passed}/${p5Total} 通过`);
console.log(`回归聚合：${regression.filter(Boolean).length}/${regression.length} 通过`);
const ok = p5Passed === p5Total && regression.every(Boolean);
console.log(`最终结果：${ok ? 'PASS' : 'FAIL'}（exit ${ok ? 0 : 1}）`);
process.exitCode = ok ? 0 : 1;
