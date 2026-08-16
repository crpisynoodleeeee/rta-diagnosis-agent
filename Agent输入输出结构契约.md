# 项目三：Agent 输入输出结构契约 v0.1

> 定义 RTA 诊断 Agent 的输入数据契约（系统自动读取 + 用户补充）与输出契约（DiagnosisReport）。
> 输出契约与 `demo/src/types/index.ts` 的 `DiagnosisReport` 接口逐字段对齐，确保规则引擎/Agent 输出可直接替换 demo mock 数据。
> 本契约为版本化约定：字段变更需同步更新类型定义、规则引擎输出和前端渲染。

---

## 1. 契约总览

```text
┌─ 输入（Agent Input）─────────────────────────────────────────────┐
│ 1. 诊断请求 DiagnosisRequest      ← 用户发起（页面选择）          │
│ 2. 配置快照 ConfigSnapshot        ← 系统自动读取（对象模型 O3-O8） │
│ 3. 指标数据 MetricBundle          ← 系统自动读取（O10/O11）        │
│ 4. 用户上下文 UserContext         ← 用户补充（可选）              │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ 处理（Agent Pipeline）──────────────────────────────────────────┐
│ Phase 1 规则引擎：D1-D12 检查（硬判定 + 阈值判定）→ 证据收集        │
│ Phase 2 AI 层：原因排序 + 因果链 + 实验方案生成                     │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ 输出（DiagnosisReport）─────────────────────────────────────────┐
│ oneLiner / managerSummary / impact / causes / timeline /          │
│ causeTree / recommendations / technical                           │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. 输入契约

### 2.1 诊断请求 DiagnosisRequest（用户发起）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| projectId | string | 是 | 投放项目（作品集层对象），如 P-2026-SUMMER |
| rtaId | string | 是 | 关联 RTAID，如 juliang-rta-2086 |
| dateRange | { start: string; end: string } | 是 | 诊断时间范围，默认当天 |
| problemHint | string | 否 | 用户看到的现象描述（如"预算没跑出去"） |

### 2.2 配置快照 ConfigSnapshot（系统自动读取）

对应对象模型 O2-O8，为诊断时点的配置现状：

| 字段 | 类型 | 对应对象 | 说明 |
| --- | --- | --- | --- |
| rtaid | { media, rtaId, bidUrl, status, qpsConfig, qpsUsed, qpsRemaining, secretKey?, token? } | O3 | QPS 三要素 + 状态 + 签名配置 |
| systemQps | { systemQpsLimit, allocatedQps } | O4 | 系统 QPS 上限（默认 300000） |
| boundAccounts | MediaAccount[] | O2 | 绑定账户列表 |
| strategies | Strategy[] | O5 | 实验引用的策略：状态/类型/参竞策略/出价配置/数据源/覆盖人数 |
| experiment | Experiment | O7 | 状态/类型/生效机制/生效时段 |
| groups | ExperimentGroup[] | O8 | 对照组+实验组：分桶分配、策略组、出价方式、快照 |
| bucketMode | 'platform' \| 'customer' | O8 | 分桶方式 |
| changes | ChangeRecord[] | 通用 | 近期配置变更记录：{ time, operator, object, field, before, after } |

### 2.3 指标数据 MetricBundle（系统自动读取）

对应对象模型 O10-O11，按诊断时间范围聚合：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| coreMetrics | { currentQps, peakQps, qpsUsageRate, avgLatency, p95, p99, timeoutRate, successRate, failRate } | 资源口径（R1 核心指标） |
| usageMetrics | { totalRequests, execSuccess, execFail, fallbackExec, bidCount, bidRate, rejectCount, rejectRate, hitCount, hitRate, avgBidWeight, avgCpaBid, avgCpcBid } | 分析口径（R1 使用情况） |
| trend | { time, requests, hitRate, bidRate, cost }[] | 时间趋势（构造时间线） |
| logSummary | { total, byStatus: { success, fallback, fail }, failReasons: { reason, count }[], fallbackTypes: { type, count }[] } | 执行日志摘要 |
| attribution | { callbackSuccessRate, callbackLatency, attributionChange?, missingFieldRate? } | 回传归因（D12，效果可信度） |

### 2.4 用户上下文 UserContext（用户补充，可选）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| recentAdjustments | string | 否 | 近期做过的调整（人群/阈值/出价/预算） |
| suspectedCauses | string[] | 否 | 用户怀疑的原因（AI 需在结论中回应） |
| businessContext | string | 否 | 业务背景（大促/季节/目标变化） |

> 输入完整性规则：当 ConfigSnapshot 或 MetricBundle 任一关键字段缺失且影响 D1-D10 判定时，输出 `insufficient`（数据不足）状态，不强行诊断。

---

## 3. 输出契约 DiagnosisReport

与 `demo/src/types/index.ts` 完全一致，逐字段说明语义与生成方式：

### 3.1 结论层

| 字段 | 类型 | 生成方式 |
| --- | --- | --- |
| oneLiner | string | AI 层：一句话结论（主因 + 关键变化 + 影响） |
| managerSummary | string | AI 层：管理摘要（问题/影响/建议，30 秒可读完） |

### 3.2 影响概览 impact

| 字段 | 类型 | 生成方式 |
| --- | --- | --- |
| budget | number | 场景前置数据（日预算） |
| cost | number | 实际消耗 |
| gap | number | 差额 = budget − cost |
| achievementRate | number | 达成率 = cost / budget |
| affectedScope | string | AI 层：受影响范围（如"实验组 A · 5/10 分桶，约 50% 项目流量"） |

### 3.3 原因排序 causes

| 字段 | 类型 | 生成方式 |
| --- | --- | --- |
| primary | string | AI 层：主因 = abnormal 节点中 impact×confidence 最高且因果链成立者 |
| secondary | string | 次因：与主因联动或独立次异常 |
| excluded | string[] | 已排除：normal 节点给出排除表述（含依据） |

排序规则：impact(high>medium>low) × confidence（0-100）加权；主因必须能在 timeline 中找到配置/指标证据。

### 3.4 证据时间线 timeline

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| time | string (HH:mm) | 事件时间 |
| label | string | 事件名 |
| category | 'config' \| 'metric' \| 'impression' \| 'cost' | 事件类型 |
| detail? | string | 详情 |
| value? | string | 关键值（如 −50pp） |

生成规则：config 事件来自 `changes`（配置变更记录），metric/impression/cost 事件来自 `trend` 的关键拐点。

### 3.5 原因树 causeTree（规则引擎直出）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 节点 ID（c-xxx） |
| category | CauseCategory | budget/binding/traffic/service/experiment/strategy/bidding/attribution |
| label | string | 检查项名 |
| result | 'normal' \| 'abnormal' \| 'excluded' | 判定结果 |
| confidence | number (0-100) | 置信度（规则确定性 → 高置信；阈值判定 → 按偏离程度） |
| impact | 'high' \| 'medium' \| 'low' | 影响度 |
| evidence | string | 证据表述 |
| metrics? | { name, value }[] | 关键指标 |

causeTree 节点与诊断规则 D1-D12 映射：

| causeTree category | 对应规则 |
| --- | --- |
| budget | 场景前置（预算/消耗/达成率） |
| binding | D1 + D2（RTAID + 账户绑定） |
| traffic | D7 + D8（请求量 + 命中率） |
| service | D10 + D3（执行质量 + QPS 容量） |
| experiment | D5 + D6（实验状态 + 分桶） |
| strategy | D9（参竞率/放行率，核心） |
| bidding | D11（出价配置） |
| attribution | D12（回传归因） |

### 3.6 建议方案 recommendations

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | rec-1 / rec-2 |
| action | string | 动作描述 |
| before | string | 调整前配置 |
| after | string | 调整后配置 |
| impact | string | 影响范围（流量占比） |
| observeMetrics | string[] | 观察指标（2-4 个） |
| successCriteria | string | 成功标准（含时间窗与数值） |
| rollbackCondition | string | 回滚条件（含触发阈值） |

生成规则：方案 ≤ 2 套（保守 + 进取）；必须包含观察指标、成功标准、回滚条件三项；人工确认后执行。

### 3.7 技术详情 technical

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| rtaId / experimentId | string | RTAID 与实验 ID |
| controlGroupId / treatmentGroupId | string | 对照组/实验组 ID |
| bucketIds | number[] | 实验组分桶 |
| requestId | string | 证据请求 ID（执行日志锚点） |
| logFieldPath | string | 日志字段路径 |
| configBefore / configAfter | Record | 配置变更前后值（来自 changes） |
| dataSource | string | 数据来源说明 |
| dataUpdatedAt | string | 数据更新时间 |

---

## 4. 示例：goldenReport 的输入还原

以 demo goldenReport 反推其输入数据（验证契约闭环）：

```json
{
  "diagnosisRequest": {
    "projectId": "P-2026-SUMMER",
    "rtaId": "juliang-rta-2086",
    "dateRange": { "start": "2026-08-14 00:00", "end": "2026-08-14 23:59" }
  },
  "configSnapshot": {
    "rtaid": { "media": "juliang", "rtaId": "juliang-rta-2086", "status": "online",
               "qpsConfig": 300000, "qpsUsed": 42800, "qpsRemaining": 257200 },
    "strategies": [{ "name": "清凉家电新策略（实验）", "status": "published",
                     "threshold": { "before": "40%", "after": "80%" } }],
    "experiment": { "id": "EXP-2026-08", "type": "AB", "status": "running" },
    "groups": [
      { "groupId": "G-CONTROL", "buckets": [1,2,5,6,9] },
      { "groupId": "G-TREAT-A", "buckets": [3,4,7,8,10], "snapshot": { "准入门槛": "80%" } }
    ],
    "changes": [{ "time": "11:50", "operator": "lina", "object": "实验组 A",
                  "field": "准入门槛", "before": "40%", "after": "80%" }]
  },
  "metricBundle": {
    "coreMetrics": { "qpsUsageRate": 0.14, "p95": 18, "timeoutRate": 0.004,
                     "successRate": 0.994 },
    "usageMetrics": { "totalRequests": 1200000, "hitRate": 0.96,
                      "bidRate": { "control": 0.6, "treatment": { "before": 0.6, "after": 0.1 } } },
    "trend": [ { "time": "12:05", "hitRate": null, "bidRate": 0.1, "cost": null },
               { "time": "12:30", "impression": -0.8 } ],
    "attribution": { "callbackSuccessRate": 0.992 }
  }
}
```

→ 规则引擎判定：D1-D8 normal、D9 abnormal（参竞率 60%→10%）、D11 关联 abnormal（曝光 −80%）、D12 normal
→ AI 层输出：primary = 实验组准入门槛 40%→80% 导致参竞率骤降；rec-1 = 门槛回调 60% 小流量试跑
→ 与 goldenReport 输出一致 ✅

---

## 5. 契约演进规则

1. **字段即契约**：任何字段的增删改必须同步 `types/index.ts`、规则引擎输出、前端渲染三处。
2. **【待核验】标记**：媒体侧字段（mediaSideXxxId、媒体侧 RTAID 映射）保留标记，联调确认后移除。
3. **版本化**：本契约 v0.1；进入真实 Agent 联调时升 v0.2，记录变更点。
4. **不伪造**：数据不足时输出 insufficient 状态，AI 层不得编造指标值。
