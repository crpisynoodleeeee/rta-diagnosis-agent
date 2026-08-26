# AI 层设计与评测方案 v0.2

> 本文定义 RTA Diagnosis Agent 中 AI 层的职责、输入输出契约、证据约束和评测方法。
> 当前 v0.6 Demo 使用本地 Mock 数据和模板参考实现；后续接入真实 LLM 时，保持接口和评测标准不变。
> 关联文档：`Agent输入输出结构契约 v0.3.md`、`MVP诊断规则表.md`、`RTA对象模型与字段清单.md`。

---

## 1. 目标与非目标

### 1.1 目标

AI 层负责把规则引擎已经确认的结构化事实，转换为可读、可验证、可执行的诊断结果：

1. 从异常节点、时间线和配置变更中组织候选因果链。
2. 面向管理、运营和技术角色生成不同粒度的解释。
3. 在已有配置和约束内生成低风险实验建议。
4. 对证据不足、事实冲突和超出输入范围的问题明确拒答。

### 1.2 非目标

AI 层不承担以下职责：

- 不重新计算指标，不修改规则引擎的异常判定。
- 不直接查询媒体平台、生产账户、数据库或日志系统。
- 不执行配置变更、预算调整或发布操作。
- 不基于未提供的数据推断历史趋势、行业基准或实时状态。
- 不把用户的主观猜测直接当作根因。

---

## 2. 分层边界

`DiagnosisReport` 中的字段按数据来源和风险等级划分如下：

| 字段或能力 | 归属 | 处理方式 |
| --- | --- | --- |
| causeTree（D1-D14 判定、证据、指标） | 规则引擎 | 基于阈值、状态和数据完整性确定 |
| timeline | 规则引擎 | 从配置变更、指标拐点和系统事件程序化构造 |
| impact.budget/cost/gap/achievementRate | 规则引擎 | 使用结构化数据完成计算 |
| technical | 规则引擎 | 输出 RTAID、实验、分桶、配置和执行信息 |
| oneLiner | AI 层 | 组织事实和传导关系，禁止增加未提供的事实 |
| managerSummary | AI 层 | 面向管理决策压缩问题、影响和建议 |
| operationsNote | AI 层 | 解释排查过程、排除项和待确认事项 |
| causes | AI 层 | 对规则引擎已标记的候选原因进行排序和解释 |
| affectedScope | AI 层 | 根据实验、分桶和流量证据生成范围描述 |
| recommendations | AI 层 | 生成带观察指标、成功标准和回滚条件的实验建议 |

**硬边界**：AI 层只能消费规则引擎输出的结构化证据，不接触原始日志和生产 API。AI 的文本结果必须能够回指输入中的节点、事件或指标；无法回指的内容只能标记为假设，不能写成事实。

---

## 3. 端到端处理流程

```text
Mock/媒体适配层
        ↓
数据标准化与完整性检查
        ↓
规则引擎：D1-D14 + causeTree + timeline + technical
        ↓
AI 输入裁剪与证据编号
        ↓
AI 层：归因 → 解释 → 规划
        ↓
JSON Schema 校验与证据一致性检查
        ↓
DiagnosisReport + 人工确认状态
```

### 3.1 进入 AI 层前（v0.7 增强项）

- 检查必填字段、时间顺序、数值类型和单位。
- 为每条证据生成稳定的 `evidenceId`，例如 `EV-RULE-D9`、`EV-CHANGE-001`、`EV-METRIC-ACTUALCPA`。
- 标记数据新鲜度、缺失字段和冲突字段。
- 如果规则引擎没有可用异常节点，直接进入“未发现明确异常”分支，不调用 LLM。

v0.7 Demo 已落地 `QueryContext`：在 `performDiagnosis(record)` 输出中附加 `queryContext`、`dataQuality` 和 `evidenceRefs`，统一当前 RTA 的指标、趋势、实验组/对照组、配置变更和诊断证据。所有查询证据使用稳定 `EV-*` 编号；查询层只读、只消费合成 Mock 数据，不触发真实媒体 API。

### 3.2 AI 层内部阶段

1. **归因**：从 abnormal 节点中选择主因、次因和排除项，形成有方向的因果链。
2. **解释**：根据同一组事实生成管理摘要、运营说明和技术说明。
3. **规划**：只在存在可调整配置和足够证据时生成实验建议。

### 3.3 输出后（v0.7 增强项）

- 校验 JSON Schema、枚举值、必填字段和数组长度。
- 检查结论中的数字、时间、配置前后值是否存在于输入证据。
- 检查推荐动作是否越过“只读诊断”边界。
- v0.6 当前由模板优先和 LLM 5 项校验保障；后续增加完整 JSON Schema 校验时，失败结果统一返回模板化降级结果，不展示未经校验的 LLM 原文。

v0.7 Demo 的查询型回答增加额外校验：若 LLM 输出指标、趋势、组间对比或配置变更结论，必须引用当前 QueryContext 中存在的 `EV-*` evidenceId；缺少证据引用或引用未知证据时，丢弃 LLM 输出并回退模板。

---

## 4. AI 层输入契约

```json
{
  "schemaVersion": "0.3",
  "diagnosisId": "DX-20260822-001",
  "causeTree": [
    {
      "id": "c-strategy",
      "category": "strategy",
      "label": "参竞率",
      "result": "abnormal",
      "confidence": 92,
      "impact": "high",
      "evidence": "实验组 60% vs 对照组 10%，差 50pp",
      "metrics": [{ "name": "实验组参竞率", "value": "10%", "unit": "ratio" }]
    }
  ],
  "timeline": [
    { "time": "11:50", "category": "config", "label": "准入门槛变更", "detail": "40% -> 80%" }
  ],
  "configChanges": [
    { "time": "11:50", "object": "实验组 A", "field": "准入门槛", "before": "40%", "after": "80%" }
  ],
  "budget": {
    "dailyBudget": 1000,
    "actualCost": 300,
    "controlGroupCost": 250,
    "treatmentGroupCost": 50
  },
  "dataQuality": {
    "completeness": 0.98,
    "freshnessMinutes": 5,
    "conflicts": []
  },
  "userContext": {
    "recentAdjustments": [],
    "suspectedCauses": [],
    "businessContext": ""
  }
}
```

输入规则：

- `causeTree`、`timeline`、`configChanges` 是事实来源；`userContext` 只能作为待验证线索。
- 所有金额、比例、时间必须携带或能够推断出明确单位。
- `dataQuality.completeness` 低于阈值、存在关键冲突时，AI 必须降低结论置信度或拒绝生成确定性归因。
- 不把原始日志、密钥、账户标识和未脱敏业务数据发送给 LLM。

---

## 5. AI 层输出契约

v0.6 当前模板实现返回的 AI 字段如下，和 `demo/v6/index.html` 的 `runAiLayer` 对齐：

```ts
interface AILayerOutputV06 {
  oneLiner: string
  managerSummary: string
  operationsNote: string
  causes: {
    primary: string
    secondary: string
    excluded: string[]
  }
  affectedScope: string
  recommendations: Recommendation[]
}

interface Recommendation {
  action: string
  before: string
  after: string
  impact: string
  observeMetrics: string[]
  successCriteria: string
  rollbackCondition: string
}
```

v0.7 已落地输入证据编号和 QueryContext Schema 校验。当前诊断报告附加 `evidenceRefs`；`confidence` 与 `status` 仍作为后续 AI 质量扩展字段预留：

```ts
interface AILayerQualityExtension {
  evidenceRefs: string[]
  // confidence/status：后续 AI 质量扩展字段，当前不作为前端契约字段
}
```

字段要求：

| 字段 | 要求 |
| --- | --- |
| oneLiner | 只描述输入证据支持的因果链，包含配置动作和指标后果 |
| managerSummary | 包含问题、影响、当前建议和主要限制，控制在 30 秒可读范围 |
| operationsNote | 区分主因、传导结果、排除项和待人工确认事项 |
| causes.primary | 从 abnormal 节点中选择证据最充分且影响最大的独立根因 |
| causes.secondary | 没有独立次因时必须输出“无独立次因” |
| causes.excluded | 每条排除项附对应证据，不能只列结论 |
| affectedScope | 由实验、分桶、流量或账户范围证据推导 |
| recommendations | 必须包含 action、before、after、observeMetrics、successCriteria、rollbackCondition |
| evidenceRefs | v0.7 已落地；由 QueryContext 生成的 `EV-*` 证据编号组成 |
| confidence / status | 后续 AI 质量扩展字段；当前由 `dataQuality`、模板降级和人工确认状态承担边界 |

`recommendations[].before` 必须对应当前生效值，`after` 必须来自允许调整的配置范围。不得把历史变更的 `before` 值误写成当前值，不得生成自动执行指令。

---

## 6. 接口与降级策略

### 6.1 入口

```ts
function generateDiagnosis(input: AILayerInput): AILayerOutput
```

当前实现可以由模板参考实现提供；接入 LLM 时，仅替换函数内部的生成器，不改变输入输出结构、校验器和评测器。

### 6.2 失败处理

| 情况 | 输出策略 |
| --- | --- |
| 无 abnormal 节点 | `status=insufficient_evidence`，输出未发现明确异常 |
| 关键指标缺失 | `status=partial`，列出缺失字段，不生成确定性建议 |
| 证据互相冲突 | `status=partial`，指出冲突并请求人工确认 |
| LLM 超时或不可用 | 使用模板参考实现，标记 `generator=fallback` |
| JSON Schema 校验失败 | 丢弃原始结果，返回安全模板并记录错误 |
| 推荐动作超出配置范围 | 删除该推荐，保留诊断和人工确认提示 |

LLM 的原始响应仅用于内部调试和评测，不直接返回前端。前端只展示经过 Schema、证据和安全边界校验的结果。

---

## 7. Golden Case

### 7.1 场景事实

| 事实 | 值 |
| --- | --- |
| 日预算 | 1000 |
| 当前消耗 | 300，达成率 30% |
| 配置变更 | 11:50，准入门槛 40% -> 80% |
| 生效时间 | 12:00 |
| 参竞率 | 60% -> 10% |
| 影响范围 | 实验组 A，5/10 分桶 |

### 7.2 标准结论

- 主因：实验组准入门槛从 40% 调高到 80%，导致参竞率骤降。
- 因果链：门槛调高 -> 参竞率下降 -> 曝光下滑 -> 消耗不足 -> 预算未达标。
- 次因：无独立次因；曝光和消耗是传导结果。
- 建议：门槛回调至 55%-65% 区间内的小流量试跑，默认建议值为 60%。
- 观察指标：参竞率、曝光、消耗、CPA。
- 成功标准：验证窗口 24 小时内，参竞率恢复至 50% 以上，预算达成率达到 80% 以上。
- 回滚条件：CPA 上涨超过 20%、CTR 下降超过 30% 或接口出现异常。

Golden Case 不是唯一答案，而是用于验证根因、方向、约束和证据引用的最小基准。措辞可以变化，事实和因果方向不能变化。

---

## 8. 评测方案

### 8.1 评测门槛

**L0 数据完整性**：检查必填字段、时间顺序、单位、数值类型和数据新鲜度。关键字段缺失时不进入模型评分。

**L1 规则判定正确性**：D1-D14 与标准判定必须 100% 一致。规则判定失败时，整条样本不进入 AI 质量评分。

**L2 归因正确性**：

| 指标 | 通过标准 |
| --- | --- |
| 主因命中 | 命中门槛变更这一独立根因 |
| 因果方向 | 门槛 -> 参竞率 -> 曝光 -> 消耗，顺序正确 |
| 次因识别 | 正确输出无独立次因，不把传导结果当根因 |
| 证据引用 | 至少引用配置变更和指标变化两类证据 |

L2 任一硬性项失败，样本判定为不通过。

**L3 解释质量**：问题、影响、建议三要素齐全；管理、运营、技术三种说明有信息层级差异；术语和数值准确。

**L4 规划质量**：动作在允许范围内；包含观察指标、验证窗口、成功标准和回滚条件；不包含自动执行或无依据的收益承诺。

**L5 安全与边界**：不编造数据、不泄露敏感字段、不引用输入外事实、不改变规则判定、不输出未经授权的执行动作。

### 8.2 评分与分档

| 档位 | 条件 |
| --- | --- |
| 通过 | L0/L1 通过，L2 全部命中，L3 >= 0.7，L4 >= 0.7，L5 无违规 |
| 待改进 | L0/L1 通过，L2 全部命中，但 L3 或 L4 < 0.7 |
| 不通过 | L0/L1 失败、L2 任一硬性项失败或 L5 出现违规 |

Mock 参考实现和真实 LLM 使用同一输入集、同一 Schema、同一评测器。模板命中只能证明契约和评测器可运行，不能证明 LLM 具备额外能力。

### 8.3 评测集

| 场景 | 主要验证点 |
| --- | --- |
| 单主因 | 根因、传导链和建议完整性 |
| 多主因：门槛 + 出价同时异常 | 独立根因识别与排序 |
| 数据不足：请求量为 0 | 拒答和缺失证据提示 |
| 排除项：媒体流量异常 | 不误调 RTA 策略 |
| 回传异常：CPA 虚高 | 识别效果可信度问题 |
| 时间冲突：配置晚于指标异常 | 不倒置因果方向 |
| 无可调配置 | 只输出诊断，不生成实验动作 |
| 用户线索与证据冲突 | 以结构化证据为准并提示冲突 |

---

## 9. 运行质量指标

接入真实 LLM 后，除离线评测外，持续记录以下指标：

- Schema 校验通过率。
- 证据引用完整率。
- `insufficient_evidence` 和人工接管率。
- LLM 超时率、降级率和平均响应时延。
- 事实冲突率、数字不一致率和越界推荐率。
- 不同模型、Prompt 和版本在同一评测集上的回归结果。

任何模型或 Prompt 变更，都必须重新跑 Golden Case 和扩展评测集；只允许在评测通过后进入 Demo 或灰度环境。

---

## 10. 版本演进

| 阶段 | 状态 | AI 层能力 |
| --- | --- | --- |
| v0.6 Demo | 当前 | Mock 数据、模板参考实现、离线评测和只读展示 |
| v0.7 | 已落地 | 可查询 Mock 数据、证据编号、Schema 校验、拒答和降级 |
| v0.8 | 后续 | 接入受控只读媒体工具，支持趋势、实验组和配置变更查询 |
| v1.0 | 目标 | 真实 LLM、离线回归集、线上质量监控和人工确认闭环 |

真实媒体 API 接入与真实 LLM 接入是两个独立变更：前者解决数据来源和权限，后者解决开放文本归因、解释与规划。两者都不能绕过规则引擎、证据校验和人工确认边界。

---

## 11. 总结

AI 层的职责不是替代规则引擎，而是在确定性事实之上完成证据约束下的归因、解释和规划。只有当输出能够引用输入证据、在不确定时拒答、通过结构校验并满足离线评测时，才允许进入前端展示或后续人工确认流程。
