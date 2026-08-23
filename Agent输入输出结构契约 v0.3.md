# 项目三：Agent 输入输出结构契约 v0.3

> 定义 RTA 诊断 Agent 的输入数据契约（系统自动读取 + 用户补充）与输出契约（DiagnosisReport）。
> 输出契约与 `demo/v6/index.html` 的规则引擎输出逐字段对齐，确保规则引擎/Agent 输出可直接替换 demo mock 数据。
> 本契约为版本化约定：字段变更需同步更新类型定义、规则引擎输出和前端渲染。

---

## 0. 版本变更记录

### v0.1 → v0.2（2026-08-17）

基于 v2 Demo 验收，对齐"代码实际输出"与"契约定义"，并补全缺失字段：

| # | 变更 | 原因 |
| --- | --- | --- |
| 1 | §3.2 impact 新增 `extraMetrics` 字段 | 代码已输出（请求量/参竞率/CPA 对比），契约未定义 |
| 2 | §3.5 causeTree 节点新增 `children` 字段 | 同 category 多 D 节点聚合时需保留子节点粒度 |
| 3 | §3.7 technical 新增 `rtaInternalId` 字段 | 代码已输出，契约未定义 |
| 4 | §3.5 补全 `budget` 类节点生成规则 | v0.1 定义了 8 类但未说明 budget 节点如何生成（非 D 节点，场景前置） |
| 5 | §2.3 `bidRate` 结构统一为单值对象 | v0.1 §4 示例为 `{before,after}`，与实现冲突 |
| 6 | §2.4 `insufficient` 触发条件具体化 | 明确"关键字段缺失清单"，保证数据不足状态可达 |
| 7 | §3.1 `oneLiner` 生成规则明确 | 修复"节点名+后果"语病，明确因果链表述 |
| 8 | §3.5 causeTree 判定口径对齐规则表 v0.1 | 明确 D7/D3/D6/D11 须按规则表语义实现 |

### v0.2 → v0.3（2026-08-18）

基于 v6 Demo（场景识别层落地 + CPA 现象标签），补齐场景识别输出与 CPA 字段：

| # | 变更 | 原因 |
| --- | --- | --- |
| 1 | 规则引擎 D1-D13 → D1-D14 | 新增 D14 CPA 达标判定（actualCpa > targetCpa × 1.2 → abnormal），只服务现象标签，不进 S0-S7 短路链 |
| 2 | 输入 MetricBundle.budget 新增 CPA 三字段 | `conversionCount` / `actualCpa`（= actualCost ÷ conversionCount）/ `targetCpa`（投放目标配置）|
| 3 | 输出新增 `scenario` 字段 | 场景识别层产出 `{ sceneId, sceneName, phenomenonTags[], confidence }`，对齐《场景扩展方案》§3 |
| 4 | 处理管线加场景识别层 | Phase 1.5：detectScenario(signals, m) → scenario，位于规则引擎与 AI 层之间 |
| 5 | §3.3 causes 的 excluded 语义确认 | 已确认为"normal 节点排除表述"，与 v6 实现一致 |

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
│ Phase 0 数据完整性检查 → 关键字段缺失则输出 insufficient          │
│ Phase 1 规则引擎：D1-D14 检查（硬判定 + 阈值判定）→ 证据收集        │
│ Phase 1.5 场景识别：detectScenario(signals, m) → scenario          │
│           （卡点定位 S0-S7 + 现象标签，短路不改变判定）            │
│ Phase 2 AI 层：归因 + 解释 + 规划（消费 signals + scenario）       │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ 输出（DiagnosisReport）─────────────────────────────────────────┐
│ scenario / oneLiner / managerSummary / impact / causes / timeline │
│ causeTree / recommendations / technical / status                 │
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
| rtaid | { media, rtaId, rtaInternalId, bidUrl, status, qpsConfig, qpsUsed, qpsRemaining, secretKey?, token? } | O3 | QPS 三要素 + 状态 + 签名配置 + 内部资源 ID |
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
| trend | { time, requests, hitRate, bidRate, cost, impressionChange? }[] | 时间趋势（构造时间线） |
| logSummary | { total, byStatus, failReasons, fallbackTypes } | 执行日志摘要 |
| attribution | { callbackSuccessRate, callbackLatency, attributionChange?, missingFieldRate? } | 回传归因（D12，效果可信度） |
| budget | { dailyBudget, actualCost, controlGroupCost, treatmentGroupCost, conversionCount?, actualCpa?, targetCpa? } | 场景前置：预算与消耗 + CPA（v0.3 新增） |

> **CPA 三字段（v0.3 新增，服务 D14 与现象标签）**：
> - `conversionCount`：转化数
> - `actualCpa`：实际 CPA = actualCost ÷ conversionCount
> - `targetCpa`：目标 CPA（来自投放目标配置）
> - 任一字段缺失或 conversionCount = 0 时，D14 跳过判定（输出 normal 并注明"无 CPA 数据"），现象标签不生成「CPA 过高」，不报错。

> **bidRate 结构（v0.2 统一）**：`usageMetrics.bidRate` 为聚合后单值对象：
> ```json
> { "control": 0.60, "treatment": 0.10 }
> ```
> 对照组/实验组的"调整前后对比"通过 `trend` 时间序列 + `changes` 配置变更记录表达，**不再**在 bidRate 里嵌套 `{before, after}`。

### 2.4 用户上下文 UserContext（用户补充，可选）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- |
| recentAdjustments | string | 否 | 近期做过的调整（人群/阈值/出价/预算） |
| suspectedCauses | string[] | 否 | 用户怀疑的原因（AI 需在结论中回应） |
| businessContext | string | 否 | 业务背景（大促/季节/目标变化） |

> **输入完整性规则（v0.2 具体化）**：
> 当出现以下任一情况时，输出 `status: 'insufficient'`（数据不足），不强行诊断：
> - `ConfigSnapshot` 缺失 `rtaid` / `experiment` / `groups` 任一关键对象；
> - `MetricBundle` 缺失 `coreMetrics` / `usageMetrics` / `budget` 任一关键对象；
> - `usageMetrics.totalRequests` 为空或为 0（无请求数据）；
> - 关键节点（D9/D10）判定所依赖的字段缺失。
>
> 这是"Agent 不伪造"原则的落地：数据不足时必须如实告知，不得编造指标值。

---

## 3. 输出契约 DiagnosisReport

与 `demo/v2/index.html` 的规则引擎输出一致，逐字段说明语义与生成方式：

### 3.0 状态字段 status

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| status | 'completed' \| 'insufficient' | 诊断结果状态；数据不足时整体返回 insufficient，不生成结论/原因/建议 |

### 3.1 结论层

| 字段 | 类型 | 生成方式 |
| --- | --- | --- |
| oneLiner | string | AI 层：一句话结论，采用**因果链表述**：`配置变更对象 + 变更动作 + 导致 + 指标后果` |
| managerSummary | string | AI 层：管理摘要（问题/影响/建议，30 秒可读完） |

> **oneLiner 生成规则（v0.2）**：禁止用"检查项节点名"拼接。正确示例：
> > 实验组准入门槛从 40% 调高到 80%，导致参竞率骤降。
>
> 反例（错误）：
> > 主要原因是参竞率是否下降，导致参竞率下降。

### 3.2 影响概览 impact

| 字段 | 类型 | 生成方式 |
| --- | --- | --- |
| budget | number | 场景前置数据（日预算） |
| cost | number | 实际消耗 |
| gap | number | 差额 = budget − cost |
| achievementRate | number | 达成率 = cost / budget |
| affectedScope | string | AI 层：受影响范围（如"实验组 A · 5/10 分桶，约 50% 项目流量"） |
| extraMetrics | ExtraMetric[] | 可选扩展指标（请求量/参竞率/CPA 对比等），见下 |

**ExtraMetric**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| name | string | 指标名 |
| value | string \| number | 指标值 |
| tone | 'normal' \| 'abnormal' \| 'good' | 展示色调（默认 normal） |

### 3.3 原因排序 causes

| 字段 | 类型 | 生成方式 |
| --- | --- | --- |
| primary | string | AI 层：主因 = abnormal 节点中 impact×confidence 最高且因果链成立者 |
| secondary | string | 次因：与主因联动或独立次异常（无则 '无'） |
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
| id | string | 节点 ID（c-xxx；聚合节点为 `{category}_group`） |
| category | CauseCategory | budget/binding/traffic/service/experiment/strategy/bidding/attribution |
| label | string | 检查项名 |
| result | 'normal' \| 'abnormal' \| 'excluded' | 判定结果 |
| confidence | number (0-100) | 置信度（规则确定性 → 高置信；阈值判定 → 按偏离程度） |
| impact | 'high' \| 'medium' \| 'low' | 影响度 |
| evidence | string | 证据表述 |
| metrics? | { name, value }[] | 关键指标 |
| children? | { label, result, note }[] | 同 category 多 D 节点聚合时，保留子节点粒度 |

causeTree 节点与诊断规则 D1-D12 映射：

| causeTree category | 对应规则 |
| --- | --- |
| budget | 场景前置（预算/消耗/达成率，**非 D 节点**） |
| binding | D1 + D2（RTAID + 账户绑定） |
| traffic | D7 + D8（请求量 + 命中率） |
| service | D10 + D3（执行质量 + QPS 容量） |
| experiment | D5 + D6（实验状态 + 分桶） |
| strategy | D9（参竞率/放行率，核心） |
| bidding | D11（出价配置） |
| attribution | D12（回传归因） |

> **budget 节点生成规则（v0.2 补全）**：由 `MetricBundle.budget` 直接生成，不依赖 D1-D12。
> - `achievementRate = actualCost / dailyBudget`
> - 判定：`achievementRate < 0.6` → `abnormal`（预算未达标），否则 `normal`；阈值 60% 标注【待核验】。
> - `label`: '预算与投放状态'；`evidence`: '日预算 ¥X，实际消耗 ¥Y，达成率 Z%'。

> **节点判定口径（v0.2 对齐规则表）**：causeTree 各 D 节点的判定逻辑必须与《MVP诊断规则表 v0.1》§2 一致，特别注意：
> - **D7 请求量**：判定"环比变化率"（|Δ|>50% 异常），而非绝对值阈值。
> - **D3 QPS**：除使用率阈值外，需结合执行日志中的"限流记录"。
> - **D6 分桶**：除验证实验组存在外，需比对"实验组实际流量占比 vs 配置占比偏差 >30%"与"兜底执行占比异常升高"。
> - **D11 出价**：判定出价配置本身（出价系数 0.2–5.0、CPA/CPC 建议范围 100–10000），**不得**复用 D9 的"门槛变更"信号（避免次因与主因同源）。

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

生成规则：方案 ≤ 2 套（保守 + 进取）；必须包含观察指标、成功标准、回滚条件三项；人工确认后执行。**before/after 必须从真实判定值推导，不得硬编码**（如 golden case 的 before 应为变更记录中的 `changes[].before`，而非写死 '80%'）。

### 3.7 技术详情 technical

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| rtaId | string | 媒体侧 RTA ID |
| rtaInternalId | string | 内部 RTA 资源 ID |
| experimentId | string | 实验 ID |
| controlGroupId / treatmentGroupId | string | 对照组/实验组 ID |
| bucketIds | number[] \| string | 实验组分桶 |
| requestId | string | 证据请求 ID（执行日志锚点） |
| policyVersion? | string | 策略版本 |
| logFieldPath | string | 日志字段路径 |
| configBefore / configAfter | Record | 配置变更前后值（来自 changes） |
| dataSource | string | 数据来源说明 |
| dataUpdatedAt | string | 数据更新时间 |

### 3.8 诊断场景 scenario（v0.3 新增，场景识别层产出）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| sceneId | string | S0-S7（卡点定位，短路顺序：S0 配置故障 → S1 入口流量 → S2 命中率 → S3 参竞/放行 → S4 出价/竞价 → S5 执行质量 → S6 回传/归因 → S7 无链路异常）|
| sceneName | string | 场景中文名 |
| phenomenonTags | PhenomenonTag[] | 现象标签数组（叠加，不短路）|
| confidence | number (0-100) | 置信度（主判据信号置信度；S7 取现象标注确定性）|

**PhenomenonTag**：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | P_BUDGET（预算未达标）/ P_CPA_HIGH（CPA 过高）/ P_SAFE_SCALE（可安全放量）|
| name | string | 标签中文名 |
| tone | 'abnormal' \| 'good' | 展示色调 |
| evidence | string | 判定依据 |

**生成规则**（对齐《场景扩展方案》§3）：
- 卡点定位：D1-D5 任一 abnormal → S0；否则按 D7→D8→D9→D11→D10→D12 顺序短路；全 normal → S7。
- 现象标注（叠加）：达成率 <60% → P_BUDGET；actualCpa > targetCpa × 1.2 → P_CPA_HIGH（D14 判定）；达成率 ≥90% 且 CPA 达标 → P_SAFE_SCALE。
- D14 是现象维度，**不进 S0-S7 短路链**。

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
    "rtaid": { "media": "juliang", "rtaId": "juliang-rta-2086", "rtaInternalId": "RTA-RES-2086",
               "status": "online", "qpsConfig": 300000, "qpsUsed": 42800, "qpsRemaining": 257200 },
    "strategies": [{ "name": "清凉家电新策略（实验）", "status": "published", "threshold": { "before": "40%", "after": "80%" } }],
    "experiment": { "id": "EXP-2026-08", "type": "AB", "status": "running" },
    "groups": [
      { "groupId": "G-CONTROL", "groupType": "control", "buckets": [1,2,5,6,9] },
      { "groupId": "G-TREAT-A", "groupType": "treatment", "buckets": [3,4,7,8,10], "snapshot": { "准入门槛": "80%" } }
    ],
    "changes": [{ "time": "11:50", "operator": "lina", "object": "实验组 A", "field": "准入门槛", "before": "40%", "after": "80%" }]
  },
  "metricBundle": {
    "coreMetrics": { "qpsUsageRate": 0.042, "p95": 18, "timeoutRate": 0.004, "successRate": 0.994 },
    "usageMetrics": { "totalRequests": 20000, "hitRate": 0.96, "bidRate": { "control": 0.60, "treatment": 0.10 } },
    "trend": [ { "time": "12:05", "bidRate": 0.10 }, { "time": "12:30", "impressionChange": -0.80 } ],
    "attribution": { "callbackSuccessRate": 0.992 },
    "budget": { "dailyBudget": 1000, "actualCost": 300, "controlGroupCost": 250, "treatmentGroupCost": 50 }
  }
}
```

→ 规则引擎判定：D1-D8 normal、D9 abnormal（参竞率 60%→10%）、D11 关联 abnormal（曝光 −80%）、D12 normal；budget 节点 abnormal（达成率 30%）
→ AI 层输出：primary = 实验组准入门槛 40%→80% 导致参竞率骤降；rec-1 = 门槛回调 60% 小流量试跑
→ 与 goldenReport 输出一致 ✅

---

## 5. 契约演进规则

1. **字段即契约**：任何字段的增删改必须同步 `demo/v2/index.html`（或后续 types/index.ts）、规则引擎输出、前端渲染三处。
2. **【待核验】标记**：媒体侧字段（mediaSideXxxId、媒体侧 RTAID 映射）保留标记，联调确认后移除。
3. **版本化**：本契约 v0.2；进入真实 Agent 联调时升 v0.3，记录变更点。
4. **不伪造**：数据不足时输出 `status: 'insufficient'`，AI 层不得编造指标值。
