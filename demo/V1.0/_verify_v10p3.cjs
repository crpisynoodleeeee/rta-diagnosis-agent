'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const model = require('./data/diagnosis-task-model.js');
const count = pattern => (html.match(pattern) || []).length;
const cssOrder = child => {
  const match = html.match(new RegExp(`\\.task-detail-sections > :nth-child\\(${child}\\) \\{ order:(\\d+); \\}`));
  return match ? Number(match[1]) : Number.NaN;
};
const deriveMatch = html.match(/(function deriveEvidenceGroups\(task\) \{[\s\S]*?\r?\n\})\r?\n\r?\n\/\*/);
const sandbox = {};
if (deriveMatch) vm.runInNewContext(`${deriveMatch[1]}; this.deriveEvidenceGroups = deriveEvidenceGroups;`, sandbox);
const deriveEvidenceGroups = sandbox.deriveEvidenceGroups;
let passed = 0;
const checks = [
  ['business status mapping', () => /governanceDegradationLabels|statusLabels/.test(html) && /dataQuality\.status/.test(html)],
  ['evidence groups', () => ['支持当前判断','已排除的原因','当前仍需确认'].every(x => html.includes(x))],
  ['governance after evidence', () => cssOrder(8) < cssOrder(2) && cssOrder(8) < cssOrder(1)],
  ['no system config residue', () => !html.includes('系统配置（未开放）')],
  ['governance trail branches', () => html.includes('governance-trail') && html.includes('rejected') && /function onSelectTask[\s\S]{0,500}?getDraft\(task\.id\)/.test(html) && html.includes("governanceDraft.status === 'rejected' ? '重新创建草稿'")],
  ['legacy demo title', () => html.includes('完整诊断报告')],
  ['degraded tasks no supporting evidence', () => typeof deriveEvidenceGroups === 'function' && model.buildTasks().filter(t => t.dataQuality.status !== 'complete').every(t => deriveEvidenceGroups(t).supporting.length === 0)],
  ['task assistant functions', () => html.includes('buildTaskAssistantAnswer') && /askTaskAssistant|taskChatSessions/.test(html)],
  ['answer function wired', () => /function askTaskAssistant[\s\S]{0,3000}?buildTaskAssistantAnswer\(/.test(html)],
  ['task action rendered', () => /@click="taskAssistantAction/.test(html)],
  ['no raw quality enum concatenation', () => !/数据质量为\s*['"]?\s*\+\s*task\.dataQuality\.status/.test(html)],
  ['complete status mapping', () => /governanceDegradationLabels\s*=\s*\{[^}]*complete\s*:/.test(html) && /governanceDomainQualityStatus[\s\S]{0,200}?complete[^?]*\? 'normal'/.test(html) && /governanceIsDegraded[^\n]*governanceDomainQualityStatus/.test(html) && /confirmDiagnosis[^\n]*governanceDomainQualityStatus/.test(html)],
  ['evidence anchor', () => count(/id="task-evidence-quality"/g) === 1 && /id="task-evidence-quality"[^>]*><h2[^>]*>判断依据<\/h2>/.test(html)],
  ['staff quick questions in staff section', () => count(/当前投放对象/g) === 1 && /<section v-if="currentView === 'staff'"[\s\S]*?了解问题[\s\S]*?为什么这样判断[\s\S]*?处理建议[\s\S]*?<\/section>/.test(html)],
  ['staff process feedback in staff section', () => /<section v-if="currentView === 'staff'"[\s\S]*?已读取当前 RTA 数据[\s\S]*?正在整理判断依据[\s\S]*?<\/section>/.test(html)],
  ['no v-if and v-for same task element', () => !/v-for="m in currentTaskSession\.messages"[^>]*v-if="m\.structured"/.test(html)],
  ['structured task branch rendered', () => count(/诊断助手/g) === 1 && /诊断助手[\s\S]{0,4000}?taskAssistantListEl[\s\S]{0,4000}?v-if="m\.structured"[\s\S]{0,4000}?v-model="taskAssistantInput"/.test(html)],
  ['standalone assistant structured or segmented rendering', () => /assistantListEl[\s\S]{0,5000}(msg\.structured|assistantAnswerSegments)/.test(html)],
  ['standalone evidence action rendered', () => /assistantListEl[\s\S]{0,5000}查看判断依据/.test(html)],
  ['formatted assistant metric', () => html.includes('assistantPrimaryMetric(assistantRta)') && !/主要影响指标：\{\{[^}]*qpsUsageRate\s*\}\}/.test(html)]
];
for (const [name, fn] of checks) { let ok = false; try { ok = !!fn(); } catch (_) {} if (ok) passed++; console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}`); }
const ok = passed === checks.length;
console.log(`总览：${passed}/${checks.length} 通过`);
console.log(`最终结果：${ok ? 'PASS' : 'FAIL'}（exit ${ok ? 0 : 1}）`);
process.exitCode = ok ? 0 : 1;
