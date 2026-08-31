'use strict';
const assert = require('assert');
const model = require('./data/diagnosis-task-model.js');
const tasks = model.buildTasks();
const pass = [], fail = [];
function check(n, desc, fn) { try { fn(); pass.push(`PASS ${n} ${desc}`); } catch (e) { fail.push(`FAIL ${n} ${desc}: ${e.message}`); } }
const required = ['id','title','priority','target','scene','status','discoveredAt','dataQuality','observation','diagnosis','nextAction','assistantContext'];
check(1, '返回 T001-T008 且字段齐全', () => { assert.strictEqual(tasks.length, 8); tasks.forEach((t, i) => { assert.strictEqual(t.id, `T00${i + 1}`); required.forEach(k => assert.ok(Object.prototype.hasOwnProperty.call(t, k), k)); }); });
check(2, '状态分布正确', () => { const c = tasks.reduce((a, t) => (a[t.status] = (a[t.status] || 0) + 1, a), {}); assert.deepStrictEqual(c, { attention: 4, normal: 1, insufficient: 2, stale: 1 }); });
check(3, 'T004/T005 数据不足约束', () => { tasks.slice(3, 5).forEach(t => { assert.strictEqual(t.diagnosis.confidence, 'none'); assert.ok(t.diagnosis.conclusion.includes('证据不足')); assert.ok(t.dataQuality.missingFields.length && t.dataQuality.affectedJudgments.length && t.diagnosis.limitations.length); assert.ok(['wait_attribution','refresh_data'].includes(t.nextAction.type)); assert.ok(!/预算未跑出|成本超标/.test(t.diagnosis.conclusion)); }); });
check(4, 'T006 数据过期约束', () => { const t = tasks[5]; assert.strictEqual(t.status, 'stale'); assert.strictEqual(t.diagnosis.confidence, 'low'); assert.ok(t.dataQuality.updatedAt); });
check(5, 'T003 正常结论', () => assert.ok(tasks[2].diagnosis.conclusion.includes('未发现异常')));
check(6, '完整异常规则与证据', () => { [0,1,7].forEach(i => { const d = tasks[i].diagnosis; assert.ok(d.matchedRules.length && d.matchedRules.every(r => /^D\d+$/.test(r.ruleId))); assert.ok(d.evidenceIds.length && d.evidenceIds.every(x => /^EV-/.test(x))); assert.ok(['high','medium'].includes(d.confidence)); }); });
check(7, 'T008 展示排除原因', () => assert.ok(tasks[7].diagnosis.excludedCauses.length));
check(8, 'assistantContext 完整', () => tasks.forEach(t => { assert.ok(t.assistantContext.suggestedQuestions.length && t.assistantContext.allowedTopics.length && t.assistantContext.blockedTopics.length); }));
check(9, 'nextAction 枚举合法', () => { const ok = ['view_evidence','refresh_data','wait_attribution','check_config','compare_experiment','no_action']; tasks.forEach(t => assert.ok(ok.includes(t.nextAction.type))); });
check(10, 'Node 独立加载', () => assert.ok(model && typeof model.buildTasks === 'function'));
console.log(pass.concat(fail).join('\n')); if (fail.length) process.exitCode = 1;
