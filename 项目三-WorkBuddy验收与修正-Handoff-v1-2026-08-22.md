# 项目三 WorkBuddy 验收与修正 Handoff v1

> 项目：RTA 投放诊断 Agent  
> 日期：2026-08-22  
> 用途：供新 Codex 会话专门验收 WorkBuddy 交付、定位问题并形成返修指令  
> 项目根目录：`D:\AI_Codex\Projects\program3-r`

---

## 1. 新会话任务定位

新会话只负责项目三，不继续处理简历。

主要职责：

1. 检查 WorkBuddy 对 Demo v6 的修改；
2. 对照本 Handoff、PRD、契约和 Golden Case 做验收；
3. 运行自动验证并检查真实代码，而不是只接受 WorkBuddy 的文字汇报；
4. 必要时输出可直接交给 WorkBuddy 的返修提示词；
5. 完成最终浏览器验收和封版判断。

未经用户明确授权，不删除文件、不新建 Demo 版本、不扩大产品范围。

---

## 2. 项目定位

项目三是嵌入广告投放平台的 **RTA 投放诊断 Agent**，用于 AI 产品经理秋招作品集。

一句话定位：

> 面向 RTA 投放优化的受控 Agentic Workflow，通过规则引擎、场景识别和 AI 归因解释定位投放异常，并生成可验证、可回滚的实验草稿，由人工确认后执行。

核心产品形态：

```text
投放管理 > RTA > RTAID 配置列表 > 发起诊断 > 右侧诊断抽屉
```

它不是独立聊天机器人、独立 AI 工作台或自动执行机器人。

---

## 3. 当前唯一正式 Demo

```text
D:\AI_Codex\Projects\program3-r\demo\v6\index.html
```

`demo` 目录已完成清理，目前只保留 `v6`。

已经删除：

- `demo/v2` 至 `demo/v5`；
- `demo/prototype.html`；
- 旧 `demo/src`、`public` 和 Vue/Vite 构建文件；
- `rebuild-v5.mjs`。

删除为直接删除，未进入回收站。不要恢复旧版本，不要创建 v7。

保留：

- `demo/v6` 全部文件；
- `R (2)` 业务资料和参考截图；
- `program3-r-01` 多 Agent 蓝图；
- PRD、规则表、对象模型、契约、评测、作品集和面试材料。

---

## 4. 核心架构与边界

```text
规则引擎 D1-D14
→ 场景识别 S0-S7
→ AI 归因 / 解释 / 规划
→ 人工确认
→ 人工执行
→ 数据回流与复盘
```

边界：

- AI 只读取结构化事实、解释原因和生成方案草稿；
- AI 不覆盖规则引擎判定；
- AI 不直接修改预算、出价、策略、实验或媒体配置；
- 建议必须包含观察指标、成功标准和回滚条件；
- 数据不足时必须降级，不得编造。

蓝图关系：

> RTA 投放诊断 Agent 是智能投放多 Agent 蓝图中的诊断归因层，位于异常感知之后、优化建议和人工执行之前。

`program3-r-01` 只作为上位架构参考。本轮不要把效果预测、趋势分析、自然语言问数或应急暂停等其他 Agent 扩入 Demo。

---

## 5. Golden Case 标准答案

项目：`P-2026-SUMMER 夏季大促`

- 日预算：1,000 元；
- 实际消耗：300 元；
- 对照组消耗：250 元；
- 实验组消耗：50 元；
- 11:50，实验组准入门槛由 40% 调整为 80%；
- 12:00，新配置生效；
- 实验组参竞率由 60% 降至 10%；
- 随后曝光和消耗下降；
- 预算达成率 30%。

标准诊断：

> 实验组准入门槛过严，导致参竞率下降，进一步导致曝光和消耗下降，最终造成日预算未达标。

标准建议：

- 门槛 80% 调整至 60%；
- 小流量运行 24 小时；
- 观察参竞率、消耗、预算达成率和 CPA；
- 成功标准：参竞率至少 50%，预算达成率至少 80%；
- 回滚条件：CPA 上涨超过 20% 或流量质量明显下降；
- 人工确认后执行。

任何修改不得改变以上标准答案。

---

## 6. WorkBuddy 首轮修改与验收结论

WorkBuddy 首轮返工后，已确认完成：

### 6.1 QPS 口径

页面已删除“系统上限 300,000”的硬编码，改为 10 个 RTAID 的统一聚合口径：

- 总配置；
- 已占用；
- 剩余；
- 使用率。

页面蓝条和三张 QPS 卡使用同一 `qpsSummary` 数据源。

### 6.2 场景验证漏检

`_verify_scenes.cjs` 已从：

```js
a.affectedScope
```

改为读取：

```js
rpt.impact.affectedScope
```

五个扩展场景均增加“影响范围非空”断言，控制台不再出现 `scope: undefined`。

### 6.3 Mock 信息

技术详情已加入：

- `dataSource: Mock 数据（v6 Demo）`；
- `dataUpdatedAt`。

但首轮仍缺 `dataRange`。

### 6.4 自动验证

2026-08-22 验收运行：

```powershell
node _verify.cjs
node _verify_scenes.cjs
node _verify_llm.cjs
```

结果：

- Golden Case 与 HTML 合规：通过；
- 5 个扩展场景叙事：通过；
- LLM stub 路径：通过。

注意：LLM 测试通过不代表 Key 安全方案合格，也不代表真实 DeepSeek 端到端请求已验收。

---

## 7. 首轮验收未通过项

首轮结论为“部分通过，不能封版”。

### P0：LLM Key 安全架构未改

验收时仍发现：

- `index.html` 保留 `LLM_CONFIG.apiKey`；
- 前端仍提示在源码中填写 Key；
- 前端仍发送 `Authorization: Bearer ...`；
- `llm-proxy.mjs` 仍从前端 Authorization 读取 Key；
- README 仍要求把 Key 填入前端；
- `_verify_llm.cjs` 仍通过设置前端 `apiKey` 启用 LLM。

目标方案必须是：

```text
浏览器前端
→ 本地代理
→ 代理从 DEEPSEEK_API_KEY 读取密钥
→ DeepSeek
```

前端不得持有、填写、展示或发送真实 API Key。

### P1：README 仍有旧 QPS 口径

页面已经改为聚合口径，但 README 首轮验收时仍写“系统 QPS 上限 30 万”。必须与页面同步。

### P1：缺诊断数据范围

已有数据来源和更新时间，但还需：

```text
dataRange: 2026-08-14 00:00—13:30
```

或等价的“当日 00:00—数据更新时间”。应在技术详情展示并增加非空验证。

### P1：缺蓝图定位说明

README 需要加入：

> RTA 投放诊断 Agent 是智能投放多 Agent 蓝图中的诊断归因层，位于异常感知之后、优化建议和人工执行之前。

不得借此扩展新功能。

### P1：浏览器验收未完成

上次 Codex 环境没有可调用的浏览器控制接口，因此尚未完成 1440px 可视化验收。新会话若具备浏览器能力，应补验。

---

## 8. WorkBuddy 二次返修验收标准

### 8.1 LLM 代码

- `index.html` 不存在 `LLM_CONFIG.apiKey`；
- 前端请求不发送 Authorization；
- `llm-proxy.mjs` 从 `process.env.DEEPSEEK_API_KEY` 读取 Key；
- 代理缺少环境变量时返回清晰错误，不泄露 Key；
- 默认模板模式离线可用；
- AI 模式失败自动回退模板。

### 8.2 LLM 测试

`_verify_llm.cjs` 至少覆盖：

1. LLM 关闭；
2. 合规 stub 成功；
3. 网络错误；
4. HTTP 500；
5. HTTP 503 / 未配置；
6. 错误 JSON；
7. 输出不合规；
8. 前端 headers 不含 Authorization；
9. 前端无 `LLM_CONFIG.apiKey`；
10. 前端无填写真实 Key 的提示。

stub 测试不得读取或打印真实密钥。

### 8.3 README

- 默认离线模板无需联网；
- 真实 LLM 只通过本地代理；
- Key 只放服务端环境变量；
- 前端不持有 Key；
- stub 测试不等于真实 DeepSeek 端到端验收；
- QPS 描述与页面聚合口径一致；
- v6 是唯一正式版本；
- 不把已删除旧路径写成当前入口；
- 加入诊断归因层定位。

### 8.4 数据可信度

技术详情中必须同时显示：

- Mock 数据来源；
- 数据范围；
- 数据更新时间。

三项均应有非空检查。

### 8.5 Golden Case

- 场景仍为 S3；
- 主因仍是门槛 40%→80%；
- 参竞率仍为 60%→10%；
- 建议仍为 80%→60%；
- 观察指标、成功标准、回滚条件完整；
- 人工确认流程不变。

---

## 9. 浏览器最终验收

建议使用 1440px 桌面视口打开：

```text
D:\AI_Codex\Projects\program3-r\demo\v6\index.html
```

验收路径：

1. 列表、筛选区和 QPS 聚合正常；
2. 点击 Golden Case“发起诊断”；
3. 抽屉依次进入读取、诊断完成、待人工确认；
4. 检查七段式结果、主因和建议；
5. 展开技术详情，确认 Mock 来源、数据范围和更新时间；
6. 点击“批准方案”，进入待人工执行；
7. 检查页面无 JavaScript error；
8. 检查表格、按钮、抽屉无重叠、截断或横向溢出。

如果无法使用浏览器工具，应明确说明未完成可视化验收，不得假称通过。

---

## 10. 新会话推荐操作顺序

1. 完整读取本文档；
2. 读取 `项目三-Handoff交接文档-2026-08-21.md`；
3. 检查 `demo/v6` 最近修改文件；
4. 使用 `rg` 搜索：

```text
apiKey
Authorization
DEEPSEEK_API_KEY
系统 QPS 上限
30 万
dataRange
dataUpdatedAt
dataSource
诊断归因层
```

5. 阅读 `index.html`、`llm-proxy.mjs`、`README.md`、`_verify_llm.cjs` 和 `_verify_scenes.cjs`；
6. 运行三组验证；
7. 检查验证是否真正覆盖验收要求；
8. 完成浏览器验收；
9. 输出 findings-first 的验收报告；
10. 只有全部 P0/P1 通过后，才判断项目三具备封版条件。

---

## 11. 核心文件

```text
D:\AI_Codex\Projects\program3-r\项目三-WorkBuddy验收与修正-Handoff-v1-2026-08-22.md
D:\AI_Codex\Projects\program3-r\项目三-Handoff交接文档-2026-08-21.md
D:\AI_Codex\Projects\program3-r\PRD v0.2.1.md
D:\AI_Codex\Projects\program3-r\Agent输入输出结构契约 v0.3.md
D:\AI_Codex\Projects\program3-r\AI层设计与评测方案.md
D:\AI_Codex\Projects\program3-r\MVP诊断规则表.md
D:\AI_Codex\Projects\program3-r\Mock数据口径说明.md
D:\AI_Codex\Projects\program3-r\demo\v6\index.html
D:\AI_Codex\Projects\program3-r\demo\v6\README.md
D:\AI_Codex\Projects\program3-r\demo\v6\llm-proxy.mjs
D:\AI_Codex\Projects\program3-r\demo\v6\_verify.cjs
D:\AI_Codex\Projects\program3-r\demo\v6\_verify_scenes.cjs
D:\AI_Codex\Projects\program3-r\demo\v6\_verify_llm.cjs
```

---

## 12. 可直接发给新会话的开场指令

```text
请接手项目三“RTA 投放诊断 Agent”的 WorkBuddy 验收与返修工作。

先完整读取：
D:\AI_Codex\Projects\program3-r\项目三-WorkBuddy验收与修正-Handoff-v1-2026-08-22.md

项目根目录：
D:\AI_Codex\Projects\program3-r

唯一正式 Demo：
D:\AI_Codex\Projects\program3-r\demo\v6\index.html

不要恢复旧版 Demo，不要创建 v7，不要扩展新场景。

请先检查 WorkBuddy 二次返修是否真正解决前端 Key、代理环境变量、README 一致性、dataRange 和蓝图定位问题，再运行三组验证并完成浏览器验收。请以问题优先的方式汇报，在我确认前不要擅自删除文件。
```
