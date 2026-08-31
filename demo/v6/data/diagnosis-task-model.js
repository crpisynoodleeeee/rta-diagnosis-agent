(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.DiagnosisTaskModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LABELS = Object.freeze({
    status: { attention: { label: '待关注', tone: 'red' }, diagnosing: { label: '诊断中', tone: 'blue' }, insufficient: { label: '数据不足', tone: 'amber' }, stale: { label: '数据过期', tone: 'yellow' }, normal: { label: '正常', tone: 'green' }, viewed: { label: '已查看', tone: 'gray' } },
    priority: { high: { label: '高', tone: 'red' }, medium: { label: '中', tone: 'yellow' }, low: { label: '低', tone: 'green' } },
    dataQuality: { complete: { label: '完整', tone: 'green' }, partial: { label: '部分缺失', tone: 'amber' }, stale: { label: '过期', tone: 'yellow' }, unavailable: { label: '不可用', tone: 'gray' } }
  });
  const BLOCKED = ['预算调整', '出价调整', '策略写入'];
  const baseContext = { suggestedQuestions: ['查看支持该判断的证据是什么？'], allowedTopics: ['诊断结论', '证据与规则', '数据质量'], blockedTopics: BLOCKED.slice() };
  const clone = v => JSON.parse(JSON.stringify(v));
  function target(raw) { return { rtaId: raw.rtaId, rtaName: raw.rtaName, media: raw.media, project: raw.project, experiment: raw.experiment }; }
  function quality(q) { return Object.assign({ status: 'complete', source: ['MockMediaDataProvider'], freshness: 'fresh', completeness: 1, missingFields: [], affectedJudgments: [] }, clone(q || {})); }
  function context(raw) { return Object.assign(clone(baseContext), raw.assistantContext || {}); }
  function common(raw, q, status, diagnosis, action) {
    return { id: raw.id, title: raw.title, priority: raw.priority, target: target(raw), scene: clone(raw.scene), status, owner: raw.owner, discoveredAt: raw.discoveredAt, dataQuality: quality(q), observation: clone(raw.observation), diagnosis: clone(diagnosis), nextAction: clone(action), assistantContext: context(raw) };
  }
  function buildInsufficientTask(rawInput, q) {
    const qq = quality(q); const attribution = (qq.missingFields || []).some(x => /转化|归因|回传/.test(x));
    return common(rawInput, qq, 'insufficient', { matchedRules: [], excludedCauses: [], conclusion: '当前证据不足，暂时无法形成可靠诊断结论。', confidence: 'none', evidenceIds: [], limitations: ['关键数据字段缺失，无法完成可靠判断。'] }, { type: attribution ? 'wait_attribution' : 'refresh_data', label: attribution ? '等待归因完成' : '刷新数据', description: attribution ? '等待转化回传完成后重新诊断。' : '补齐缺失字段并刷新数据。' });
  }
  function buildStaleTask(rawInput, q) { const qq = quality(q); return common(rawInput, qq, 'stale', { matchedRules: [], excludedCauses: [], conclusion: '数据已过期，当前诊断仅供参考。', confidence: 'low', evidenceIds: rawInput.evidenceIds || [], limitations: ['最近一次有效数据已超过 freshness 窗口，不能代表当前投放状态。'] }, { type: 'refresh_data', label: '刷新数据', description: '获取最新数据后重新诊断。' }); }
  function buildNormalTask(rawInput, observation, ruleResults) { return common(rawInput, rawInput.quality, 'normal', { matchedRules: clone(ruleResults || []), excludedCauses: [], conclusion: '未发现异常，核心指标处于稳定区间。', confidence: 'medium', evidenceIds: rawInput.evidenceIds || [], limitations: [] }, { type: 'no_action', label: '保持观察', description: '当前无需采取额外动作，持续观察指标变化。' }); }
  function buildDiagnosisTask(rawInput, q) {
    const qq = quality(q || rawInput.quality);
    if (qq.status === 'unavailable' || qq.status === 'partial') return buildInsufficientTask(rawInput, qq);
    if (qq.freshness === 'expired') return buildStaleTask(rawInput, qq);
    const rules = rawInput.ruleResults || [];
    if (!rules.some(r => r.result === 'matched')) return buildNormalTask(rawInput, rawInput.observation, rules);
    const diagnosis = { matchedRules: clone(rules), excludedCauses: clone(rawInput.excludedCauses || []), conclusion: rawInput.conclusion || '检测到异常，建议查看证据并进一步核验。', confidence: rawInput.confidence || 'medium', evidenceIds: clone(rawInput.evidenceIds || []), limitations: clone(rawInput.limitations || []) };
    return common(rawInput, qq, 'attention', diagnosis, rawInput.nextAction || { type: 'view_evidence', label: '查看证据', description: '查看规则命中依据与相关证据。' });
  }
  const base = { rtaName: 'RTA-核心投放', media: 'MockMedia', project: '增长项目', discoveredAt: '2026-08-30T10:00:00+08:00' };
  const samples = [
    Object.assign({}, base, { id: 'T001', title: 'CPA 连续 3 小时上涨 38%', priority: 'high', scene: { code: 'S2', name: '成本异常' }, observation: { metric: 'CPA', value: 13.8, baseline: 10, changeRate: 0.38, description: 'CPA 连续三小时上升 38%。' }, ruleResults: [{ ruleId: 'D5', name: '成本连续上升', result: 'matched', explanation: '连续时段超过波动阈值。' }], evidenceIds: ['EV-20260830-001'], confidence: 'high', conclusion: 'CPA 持续上升，建议核验流量与转化链路。' }),
    Object.assign({}, base, { id: 'T002', title: '转化量下降且点击成本同步上升', priority: 'high', scene: { code: 'S3', name: '转化异常' }, observation: { metric: '转化量/CPC', value: '下降/上升', description: '转化量下降，同时点击成本上升。' }, ruleResults: [{ ruleId: 'D7', name: '转化与点击成本联合异常', result: 'matched', explanation: '两个指标同步偏离基线。' }], evidenceIds: ['EV-20260830-002'], confidence: 'high', conclusion: '转化效率恶化且点击成本上升，需查看联合证据。' }),
    Object.assign({}, base, { id: 'T003', title: '当前核心指标处于稳定区间', priority: 'low', scene: { code: 'S0', name: '正常' }, observation: { metric: '核心指标', value: '稳定', description: '核心指标处于历史稳定区间。' }, ruleResults: [], evidenceIds: ['EV-20260830-003'] }),
    Object.assign({}, base, { id: 'T004', title: '消耗上涨，但转化回传尚未完成', priority: 'high', scene: { code: 'S4', name: '归因延迟' }, observation: { metric: '消耗', value: 12000, changeRate: 0.24, description: '消耗上涨，但转化回传未完成。' }, quality: { status: 'partial', source: ['MockMediaDataProvider'], completeness: 0.6, missingFields: ['转化量', '转化回传状态'], affectedJudgments: ['无法判断 CPA 与真实转化效率'] } }),
    Object.assign({}, base, { id: 'T005', title: '有曝光和点击，但缺少成本目标配置', priority: 'medium', scene: { code: 'S1', name: '配置缺失' }, observation: { metric: '曝光/点击', value: '有数据', description: '有曝光和点击，但没有成本目标基准。' }, quality: { status: 'partial', source: ['MockMediaDataProvider'], completeness: 0.7, missingFields: ['成本目标', '目标基准'], affectedJudgments: ['无法判断是否超出成本目标'] } }),
    Object.assign({}, base, { id: 'T006', title: '最近一次有效数据已超过 6 小时', priority: 'medium', scene: { code: 'S6', name: '数据过期' }, observation: { metric: '数据更新时间', value: '超过 6 小时', description: '最近一次有效数据已超过六小时。' }, quality: { status: 'stale', freshness: 'expired', updatedAt: '2026-08-30T03:30:00+08:00', completeness: 1 }, evidenceIds: ['EV-20260830-006'] }),
    Object.assign({}, base, { id: 'T007', title: 'RTA 可查到，但实验信息无法关联', priority: 'medium', scene: { code: 'S7', name: '对象关联异常' }, observation: { metric: '实验关联', value: '失败', description: 'RTA 可查到，但实验信息无法关联。' }, ruleResults: [{ ruleId: 'D2', name: '对象关联校验', result: 'matched', explanation: '实验关联信息缺失。' }], evidenceIds: ['EV-20260830-007'], confidence: 'medium', conclusion: '实验对象关联失败，暂不能据此判断投放异常。', limitations: ['实验信息无法关联，关联维度诊断受限。'] }),
    Object.assign({}, base, { id: 'T008', title: 'CPA 上涨，初步排除预算与素材因素', priority: 'high', scene: { code: 'S2', name: '成本异常' }, observation: { metric: 'CPA', value: 15, baseline: 10, changeRate: 0.5, description: 'CPA 上涨 50%，预算与素材因素初步排除。' }, ruleResults: [{ ruleId: 'D5', name: '成本上升', result: 'matched', explanation: 'CPA 显著高于基线。' }], excludedCauses: [{ cause: '预算不足', reason: '预算消耗与配置正常', evidenceIds: ['EV-20260830-008'] }, { cause: '素材疲劳', reason: '素材指标未见同步恶化', evidenceIds: ['EV-20260830-009'] }], evidenceIds: ['EV-20260830-008', 'EV-20260830-009'], confidence: 'high', conclusion: 'CPA 上涨，预算与素材因素已初步排除，仍需核验流量与转化链路。' })
  ];
  function buildTasks() { return samples.map(s => buildDiagnosisTask(s, s.quality)); }
  return { LABELS, buildDiagnosisTask, buildInsufficientTask, buildStaleTask, buildNormalTask, buildTasks };
});
