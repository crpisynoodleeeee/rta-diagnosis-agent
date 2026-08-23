# 项目三：AI 层设计与评测方案 v0.1

> 本文档回答一个问题：**这个 Agent 里，AI 到底做了什么规则引擎做不到的事，以及怎么证明它做对了。**
> 这是项目三的"价值证明文件"——它是面试时回应"为什么要用 AI、怎么保证 AI 不乱说"的依据，也是 Demo 重构时 AI 层接口设计的依据。
> 关联文档：《Agent 输入输出结构契约 v0.2》《MVP 诊断规则表 v0.1》《产品定义 v0.1》。

---

## 1. 核心论断

用"替代测试"论证 AI 的不可替代性——把 Agent 的每一条输出，问一句"能不能用确定性 if-else 生成"：

| 输出类型 | 能否 if-else 写尽 | 归属 |
| --- | --- | --- |
| 判定（D1-D12 的 normal/abnormal） | ✅ 能（有限状态 + 阈值） | 规则引擎 |
| **归因**（从多个布尔值合成因果链） | ❌ 不能（因果方向是语义关系） | **AI 层** |
| **解释**（分角色自然语言解释） | ❌ 不能（开放文本空间） | **AI 层** |
| **规划**（生成带约束的实验方案） | ❌ 不能（开放方案空间） | **AI 层** |

一句话结论：

> **规则引擎回答"哪个环节出了问题"（判定），AI 回答"为什么出问题、影响多大、下一步怎么验证"（归因 + 解释 + 规划）。前者是有限状态的可枚举逻辑，后者是开放空间的因果推理与生成。**

---

## 2. 分工线（规则引擎 vs AI 层）

`DiagnosisReport` 的每个字段，明确归属哪一层：

| 字段 | 归属 | 说明 |
| --- | --- | --- |
| causeTree（12 节点 + result/confidence/impact/evidence/metrics） | **规则引擎** | D1-D12 硬判定直出，到此为止 |
| timeline（事件序列） | **规则引擎** | 从 changes + trend 提取事件，程序化构造 |
| impact.budget/cost/gap/achievementRate | **规则引擎** | 场景前置数据的四则运算 |
| technical（RTAID/实验 ID/分桶/日志路径/configBefore/After） | **规则引擎** | 从 ConfigSnapshot 拼接 |
| **oneLiner** | **AI 层** | 一句话因果链 |
| **managerSummary** | **AI 层** | 管理摘要 |
| **impact.affectedScope** | **AI 层** | 受影响范围的语义判断 |
| **causes（primary/secondary/excluded）** | **AI 层** | 原因排序 + 因果链 |
| **recommendations[]** | **AI 层** | 实验方案（含三要素） |

**关键边界**：AI 层**只消费**规则引擎的结构化输出，**不自己算指标、不自己查数、不改变判定结果**。AI 层拿到的是 causeTree + timeline + changes，不是原始日志。

---

## 3. AI 层输入契约

AI 层接收的固定结构（全部来自规则引擎或系统，无用户自由文本之外的输入）：

```json
{
  "causeTree": [ { "id", "category", "label", "result", "confidence", "impact", "evidence", "metrics" } ],
  "timeline":  [ { "time", "label", "category", "detail", "value" } ],
  "configChanges": [ { "time", "operator", "object", "field", "before", "after" } ],
  "budget": { "dailyBudget", "actualCost", "controlGroupCost", "treatmentGroupCost" },
  "userContext": { "recentAdjustments", "suspectedCauses", "businessContext" }
}
```

> 说明：`userContext` 是可选的用户补充（如"最近改过门槛"），AI 需在结论中回应它，但不能被它带偏——最终归因仍以 causeTree + timeline 的证据为准。

---

## 4. AI 层输出契约

| 字段 | 类型 | 语义要求 |
| --- | --- | --- |
| oneLiner | string | 一句话因果链：`配置变更对象 + 变更动作 + 导致 + 指标后果` |
| managerSummary | string | 管理摘要，含问题/影响/建议三要素，30 秒可读 |
| causes.primary | string | 主因 = abnormal 节点中 impact×confidence 最高且因果链成立者 |
| causes.secondary | string | 次因；单主因场景必须输出"无独立次因"，不得硬凑 |
| causes.excluded | string[] | 已排除原因，每条附排除依据 |
| impact.affectedScope | string | 受影响范围（如"实验组 A · 5/10 分桶，约 50% 项目流量"） |
| recommendations[] | object[] | 每套方案含 action/before/after/impact/observeMetrics/successCriteria/rollbackCondition |

> `recommendations` 的 before/after 必须从 `configChanges[].before/after` 推导，禁止硬编码。

---

## 4.1 AI 层接口形状（实现依据）

本节定义 AI 层的**函数签名与调用示例**，是 Demo 中 AI 层拆分（V0.3）和后续接入真实 LLM 的实现依据。Mock 阶段参考实现、真实 LLM 阶段函数体替换，**接口形状不变**。

### 4.1.1 函数签名

```ts
// AI 层唯一入口：输入规则引擎结构化输出 + 系统数据，输出 DiagnosisReport 的 AI 字段
// 纯函数：无副作用、不查库、不调 API（LLM 调用仅在函数体内发生）
function generateDiagnosis(input: AILayerInput): AILayerOutput
```

**输入 AILayerInput**（对齐 §3）：

```ts
interface AILayerInput {
  causeTree: CauseNode[]        // 规则引擎 D1-D13 输出（含 result/confidence/impact/evidence/metrics）
  timeline: TimelineEvent[]     // 配置变更 + 指标拐点事件
  configChanges: ChangeRecord[] // 配置变更记录（含 before/after）
  budget: { dailyBudget; actualCost; controlGroupCost; treatmentGroupCost }
  userContext?: { recentAdjustments?; suspectedCauses?; businessContext? }
}
```

**输出 AILayerOutput**（对齐 §4）：

```ts
interface AILayerOutput {
  oneLiner: string
  managerSummary: string
  operationsNote: string
  causes: { primary: string; secondary: string; excluded: string[] }
  affectedScope: string
  recommendations: Recommendation[] // 含 action/before/after/impact/observeMetrics/successCriteria/rollbackCondition
}
```

### 4.1.2 调用约定

- AI 层**只消费** `AILayerInput`，不自己算指标、不查数、不改变 causeTree 判定结果。
- `recommendations[].before` = 从 `configChanges` 推导的**当前生效值**；`after` = 建议值（禁止把历史变更 before 当建议前值）。
- 单主因场景（causeTree 仅 1 个 abnormal 根因）时，`causes.secondary` 必须输出"无独立次因"。
- 无异常信号时，输出"未发现明确异常，请人工复核"。

### 4.1.3 Golden Case 完整输入输出示例

**输入**（对应 demo/v3 Golden Case）：

```json
{
  "causeTree": [
    { "id": "c-strategy", "category": "strategy", "label": "参竞率（对照组 vs 实验组）",
      "result": "abnormal", "confidence": 92, "impact": "high",
      "evidence": "对照组 60% vs 实验组 10%，差 50pp（阈值 20pp）",
      "metrics": [ { "name": "对照组参竞率", "value": "60%" }, { "name": "实验组参竞率", "value": "10%" } ] }
  ],
  "timeline": [
    { "time": "11:50", "category": "config", "label": "实验组准入门槛变更", "detail": "40% → 80%", "value": "调整" },
    { "time": "12:00", "category": "config", "label": "新配置生效", "detail": "准入门槛 80% 生效" },
    { "time": "12:05", "category": "metric", "label": "实验组参竞率骤降", "detail": "60% → 10%", "value": "−50pp" },
    { "time": "12:30", "category": "impression", "label": "实验组曝光下滑", "detail": "较 11:30 下降约 80%" }
  ],
  "configChanges": [
    { "time": "11:50", "operator": "lina", "object": "实验组 A", "field": "准入门槛", "before": "40%", "after": "80%" }
  ],
  "budget": { "dailyBudget": 1000, "actualCost": 300, "controlGroupCost": 250, "treatmentGroupCost": 50 }
}
```

**期望输出**：

```json
{
  "oneLiner": "实验组准入门槛从 40% 调高到 80%，导致参竞率从 60% 骤降至 10%，曝光与消耗下滑，日预算 1000 元仅消耗 300 元（达成率 30%）。",
  "managerSummary": "夏季大促项目今天日预算 1000 元，只消耗 300 元（达成率 30%）。排查发现：实验组在 11:50 把准入门槛从 40% 调高到 80%，12:00 生效后参竞率从 60% 掉到 10%，实验单元只花了 50 元。请求量、RTA 接口、回传均正常，问题不在渠道流量而在实验策略。建议把门槛回调到 60% 小流量验证，观察参竞率、曝光、消耗、CPA。",
  "operationsNote": "本次为单主因场景，无独立次因。曝光与消耗下滑是门槛收紧的传导结果，非独立根因；其余检查项（RTAID/绑定/QPS/策略发布/实验状态/分桶/请求量/命中率/执行质量/出价/回传）均已排除。",
  "causes": {
    "primary": "实验组准入门槛 40%→80% 导致参竞率骤降（置信度 92%，高影响）",
    "secondary": "无独立次因",
    "excluded": [
      "RTAID 状态=上线，BidURL 已配置 → 排除",
      "媒体账户已绑定 1 个 → 排除",
      "QPS 使用率 4.2%，无限流记录 → 排除",
      "策略均已发布 → 排除",
      "实验运行中 → 排除",
      "分桶兜底占比 25.7%，未超阈值 → 排除",
      "请求量 12480，环比 −37.6%，未超阈值 → 排除",
      "命中率 55%，未低于 50% → 排除",
      "P99 96ms、超时率 1.2%、失败率 2%，执行正常 → 排除",
      "出价系数 1.0、CPA 200，均在合法范围 → 排除",
      "回传成功率 97%，正常 → 排除"
    ]
  },
  "affectedScope": "实验组 G-TREAT-A · 5/10 分桶（约 50% 项目流量）",
  "recommendations": [
    {
      "action": "回退实验组准入门槛至 60%，先小流量试跑验证",
      "before": "准入门槛 = 80%",
      "after": "准入门槛 = 60%",
      "impact": "实验组参竞率预计从 10% 回升至 50%+，消耗预计从 50 提升至 200+",
      "observeMetrics": ["实验组参竞率", "实验组消耗", "总预算达成率"],
      "successCriteria": "实验组参竞率 ≥ 50%，预算达成率 ≥ 80%（验证窗口 24h）",
      "rollbackCondition": "若参竞率回升后 CTR 下降 > 30% 或 CPA 上涨 > 20%"
    }
  ]
}
```

> 此示例即 AI 层评测的 Golden 基准：真实 AI 输出与期望输出的语义一致性 ≥ 阈值时判定通过（打分细则见 §5.3）。

---

## 5. 评测方案

### 5.1 评测对象

评测的是 **AI 层的输出质量**，不是 AI 层的实现方式。同一套评测标准：
- Mock 阶段：AI 层用"参考实现"（模板/规则）占位，评测用来**校准标准答案是否合理**；
- 真实阶段：AI 层替换为 LLM 调用，用**同一套标准**测真实 AI 输出。

> 这句话是评测不变成自欺的关键：如果 mock 阶段用模板就拿到高分，说明评测标准太松；真实 AI 接入后必须用同一把尺子，才能证明"AI 的价值增量"。

### 5.2 Golden Case 标准答案

| 评测项 | 标准答案 |
| --- | --- |
| 场景 | 日预算 1000，消耗 300，达成率 30%；11:50 门槛 40%→80%，12:00 生效，参竞率 60%→10% |
| **主因** | 实验组准入门槛从 40% 调高到 80%，导致参竞率骤降 |
| **因果链** | 门槛调高 → 参竞率降 → 曝光下滑 → 消耗不足 → 预算未达标（方向不可反、不可跳） |
| **次因** | 无独立次因（曝光/消耗下滑是主因的传导结果，非独立根因） |
| **建议动作** | 门槛回调至 60%（允许 55–65 区间），小流量试跑 |
| **三要素** | 观察指标=参竞率/曝光/消耗/CPA；成功标准=消耗+50% 且 CPA≤+10%；回滚=CPA>+20% 或接口异常 |

### 5.3 评测维度与打分

分四层，从硬到软：

**L1 判定正确性（规则引擎，前置门槛，不计入 AI 评分）**
- D1-D12 判定 vs 标准判定，**必须 100% 一致**，否则 AI 评测直接中止（判定错，归因必错）。

**L2 归因正确性（AI 核心价值，一票否决）**

| 指标 | 通过标准 | 权重 |
| --- | --- | --- |
| 主因命中 | primary 语义命中"门槛变更"（措辞可不同，根因不可错） | 硬性 |
| 因果链方向 | 门槛→参竞→曝光→消耗，顺序正确 | 硬性 |
| 次因识别 | 单主因场景正确输出"无独立次因" | 硬性 |

> L2 任一硬性项不命中 → 整体不合格，L3/L4 得分作废。

**L3 解释质量（打分 0–1）**

| 指标 | 打分标准 |
| --- | --- |
| 管理摘要三要素 | 问题/影响/建议，缺一扣 0.33 |
| 分角色分层 | 管理摘要≠运营解释≠技术证据（语义差异检测，非复制三遍） |
| 术语翻译 | 参竞率/分桶/门槛等黑话翻译准确 |

**L4 规划质量（打分 0–1）**

| 指标 | 打分标准 |
| --- | --- |
| 动作命中 | 门槛回调 60% 区间命中 |
| 三要素齐全 | 观察指标/成功标准/回滚条件，缺一扣 0.33 |
| 可执行性 | 有数值、有时间窗、有阈值，非空话 |

### 5.4 评测结论分档

| 档位 | 条件 |
| --- | --- |
| ✅ 通过 | L2 全命中 + L3≥0.7 + L4≥0.7 |
| ⚠️ 待改进 | L2 全命中，但 L3 或 L4 < 0.7 |
| ❌ 不通过 | L2 任一硬性项未命中 |

---

## 6. 评测集的扩展（后续）

Golden Case 是"单主因"场景，评测集后续需扩展以覆盖边界：

| 场景 | 测什么 |
| --- | --- |
| 多主因（门槛 + 出价同时异常） | AI 能否识别多个独立根因并正确排序 |
| 数据不足（请求量为 0） | AI 是否诚实输出"数据不足"而非编造 |
| 排除项（问题在媒体流量，不在 RTA 策略） | AI 是否敢于说"不调 RTA 策略" |
| 回传异常（CPA 虚高） | AI 是否识别"效果可信度"问题 |

---

## 7. 落地路径

1. **现在**：本方案作为"AI 价值"的论证依据，写进作品集叙事。
2. **Demo 重构时**：规则引擎与 AI 层**显式拆开**——规则引擎产 causeTree/timeline/technical，AI 层产 oneLiner/summary/causes/recommendations。Mock 阶段 AI 层可用模板占位，但接口形状必须按 §3/§4。
3. **接真实 AI 时**：把 AI 层模板替换为 LLM 调用，用 §5 同一套评测标准验证。
4. **作品集/面试**：核心叙事 = "规则引擎判定 + AI 归因/解释/规划，用 Golden Case 评测证明 AI 价值"。

---

## 8. 一句话总结

> 这个 Agent 的意义不靠"用了 AI"来证明，靠的是：**把归因、解释、规划三件事真正交给 AI，并用 Golden Case 标准答案评测它做对了。** 评测通过的那一刻，意义就不再是争论，而是证据。
