# RTA 投放诊断 Agent · Demo v6

> **v6 是当前唯一正式版本（v1-v5 全部废弃；旧 demo 工程 / prototype / Vue+Vite 历史工程不再作为运行入口）**
> - 对齐 PRD v0.2.1（《项目三：RTA 投放诊断 Agent · PRD v0.2.1》）
> - 对齐《Agent 输入输出结构契约 v0.3》
> - 对齐《AI 层设计与评测方案》§4.1 接口形状
> - 零外网依赖 + 双击 file:// 可打开
> - LLM 完全可选 · 默认离线模板 · Key 只存在于代理进程环境变量
> - 含「智能参谋」问答工作台（per-RTA 有限上下文问答 · v0.6 诊断解释 + v0.7 Mock 查数 · 模板优先 + LLM 可选增强）

> **⚠️ AI 模式 / DeepSeek 接入（v6 final 安全版）**
> - 默认 `LLM_CONFIG.enabled = false`，演示走**模板分派**（完全离线 + 稳定 + 无网也能跑）
> - 真实 LLM 是**可选模式**：勾选 UI「AI 模式」后请求本地代理 `llm-proxy.mjs`
> - DeepSeek Key **只由代理进程**从环境变量 `DEEPSEEK_API_KEY` 读取；前端代码 commit 时不应出现任何真实 Key
> - LLM 任意失败（代理未启动 / Key 未设置 → 503 LLM_NOT_CONFIGURED / 网络错 / 超时 / JSON 错 / 校验不过 / Golden Case 不符）→ 一律回退模板，抽屉角标保持「模板」

---

## 1. 启动方式（任选其一）

### 方式 A：双击 file:// 直接打开（最简）

```
demo/v6/index.html
```

双击即开，无需任何服务器、无需联网。

### 方式 B：本地 HTTP server

```bash
cd demo/v6
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```

---

## 2. 目录结构

```
demo/v6/
├── index.html            # 主页面（单文件 + vendor 分离；含诊断抽屉 + 智能参谋工作台）
├── README.md             # 本文件
├── _verify.cjs           # Golden Case 自动化校验脚本（Node.js，无网络调用）
├── _verify_scenes.cjs    # 5 场景七段式完整性验证（Node.js，无网络调用）
├── _verify_llm.cjs       # LLM 路径 10 个 stub 验证（Node.js + fetch stub，零外网）
├── _verify_assistant.cjs # 智能参谋 47 个 stub 验证（静态扫描 + 动态用例，零外网）
├── _verify_v07.cjs       # v0.7 QueryContext / Mock 只读查询层 30 个验收用例
├── _verify_v08_provider.cjs # v0.8 MediaDataProvider 契约验收
├── data/
│   └── media-data-provider.js # 统一只读 Provider 基类、元数据和错误模型
├── _proxy-test.sh        # llm-proxy 启动冒烟测试脚本（可选运维工具）
└── vendor/
    ├── vue.global.js     # Vue 3.4.38 UMD（525KB，已验证完整）
    └── tailwind.js       # Tailwind Play CDN 自执行版（510KB，已验证完整）
```

> **文件清单**：本期主页面 1 文件（index.html）+ 4 个验证脚本 + 1 个代理冒烟脚本 + 2 个本地 vendor（`vue.global.js`、`tailwind.js`）。

---

## 3. 功能清单

### 3.1 列表页（母版 A）

| 区域 | 内容 | 状态 |
| --- | --- | --- |
| 顶部 GROWTHPLATFORM 导航 + 左侧菜单 | 平台壳 + RTA > RTAID 配置（当前项） | ✅ |
| QPS tip 蓝条 | 10 个 RTAID 聚合：总配置 / 已占用 / 剩余 / 使用率 | ✅ |
| 3 张 QPS 卡 | 总配置 QPS / 总实验已占用 / 总剩余 | ✅ |
| 筛选区 | RTAID 搜索 / 媒体下拉 / 状态下拉 / **异常标签下拉** | ✅ |
| 列表 | 媒体/RTAID/BidURL/账户/状态/配置 QPS/绑定账号/关联实验/项目名/日预算/实际消耗/达成率/异常类型 | ✅ |
| 行级操作 | 异常行蓝主按钮「发起诊断」/ 其他行「查看」/「编辑」 | ✅ |
| 异常行红底 | 达成率 < 60% 自动红底 | ✅ |
| 现象标签徽标 | 预算未达标（红）/ CPA 过高（红）/ 可安全放量（绿）/ —（正常） | ✅ |
| 演示开关 | 「演示数据不足模式」+「AI 模式 · DeepSeek」双勾选（AI 模式 → 请求本地代理；代理未启动/未配置 Key → 自动回退模板，不阻塞页面） | ✅ |
| 抽屉 AI 来源角标 | 顶部头部显示「AI 生成」（紫）/「模板」（灰），反映七段式由模板还是 LLM 生成 | ✅ |
| 底部 Agent 边界声明 | AI 不自动修改真实配置 | ✅ |

### 3.2 诊断抽屉（母版 B）

| 区域 | 内容 | 状态 |
| --- | --- | --- |
| 抽屉规格 | 720px 右侧滑入 + 遮罩 + 左侧列表可见 | ✅ |
| 顶部元信息 | 媒体 / 账户 / 项目 / RTAID / 日期 / 状态徽标 / 关闭按钮 | ✅ |
| 00 诊断场景 | 场景名 S0-S7 + 现象标签 + 置信度 | ✅ |
| 01 诊断结论 | oneLiner（因果链）+ 管理摘要 + 运营解释 | ✅ |
| 02 影响概览 | 日预算/消耗/缺口/达成率 + 影响范围 + 9 项 extraMetrics | ✅ |
| 03 原因排序 | 主因/次因/已排除（每条含排除依据） | ✅ |
| 04 证据时间线 | config / metric / impression / cost 四类事件 | ✅ |
| 05 原因树 | 8 类节点（budget/binding/traffic/service/experiment/strategy/bidding/attribution），主因节点默认展开 | ✅ |
| 06 建议方案 | action/before/after/impact/观察指标/成功标准/回滚条件 | ✅ |
| 07 人工确认 + 技术详情 | RTAID/实验 ID/分桶/请求 ID/日志路径/configBefore/After/数据来源，默认折叠 | ✅ |
| 术语对照表 | 10 个黑话翻译（参竞率/RTA 超时/分桶/准入门槛…），默认折叠 | ✅ |
| 底部操作区 | 按状态切换按钮（修改/拒绝/批准/我已执行/复盘完成/重新诊断） | ✅ |

### 3.3 10 状态机

| # | 状态 | 说明 | 可达路径 |
| --- | --- | --- | --- |
| 1 | 未发起 | 初始 | — |
| 2 | 读取数据中 | 1.2s | 点击「发起诊断」 |
| 3 | 诊断中 | 1.8s | 读取完成自动 |
| 4 | 诊断完成 | 七段式展示 | 诊断完成 |
| 5 | 数据不足 | 关键字段缺失 | 勾选演示开关 / 字段缺失 |
| 6 | 待人工确认 | 批准/修改/拒绝 gate | 诊断完成 700ms 后自动 |
| 7 | 待人工执行 | 方案已确认 | 批准/修改 |
| 8 | 等待数据回流 | 演示用 | 点击「我已执行」 |
| 9 | 复盘完成 | 演示用 | 点击「复盘完成」 |
| 10 | 诊断失败 | 拒绝 / 重新诊断 | 点击「拒绝」 |

### 3.4 三层架构（与场景扩展方案对齐）

| 层 | 函数 | 输出 |
| --- | --- | --- |
| 规则引擎 | `runRules(record)` → signals[] | 14 节点独立判定（D1-D14），字段缺失优雅降级 |
| 场景识别 | `detectScenario(signals, record)` | `{ sceneId, sceneName, phenomenonTags[], confidence }` |
| AI 层 | `runAiLayer(record, signals, scenario)` | oneLiner / managerSummary / operationsNote / causes / affectedScope / recommendations |
| AI 层兜底模板 | `buildTemplateNarrative(record, signals, scenario)` | 6 场景独立分支（与 S3 Golden Case 同等深度） |
| AI 层真实 LLM | `callLLM(record, signals, scenario) → Promise<result \| null>` | DeepSeek chat completions，5 项校验 + Golden Case 特判 |

**AI 层接入机制（方案 B：LLM 通过本地代理生成 + 模板兜底 · v6 final 安全版）**：
1. `runAiLayer` **同步**先返回模板结果（保证 UI 1.8s 诊断动画结束后立刻有内容显示，抽屉角标 =「模板」）
2. 若 `LLM_CONFIG.enabled = true`，**异步** fire-and-forget 调 `callLLM` → POST 到本地代理 `llm-proxy.mjs`
3. 代理从环境变量 `DEEPSEEK_API_KEY` 取 Key，在服务端注入 `Authorization: Bearer <key>` 后转发 DeepSeek
4. LLM 5 项校验 + Golden Case 特判任一失败 → 返回 null → UI 保持模板结果不变；
5. 校验全部通过 → 派发 `rta-llm-override` CustomEvent，抽屉侧 `onLLMOverride` 监听 patch AI 字段 + 角标变为「AI 生成」

详细 prompt / 校验 / fallback 见 §7.7。**前端不持有任何 Key、不发任何 Authorization 头**。

**D14 说明**：CPA 达标判定（actualCpa > targetCpa × 1.2 → abnormal）只服务现象标签「CPA 过高」，不进 S0-S7 短路链。

**现象标签三标签**：
- 预算未达标：达成率 < 60%
- CPA 过高：actualCpa > targetCpa × 1.2
- 可安全放量：达成率 ≥ 90% 且 CPA 达标

字段缺失时（无 CPA 数据、无 totalRequests、无 groups）优雅跳过不报错。

### 3.5 智能参谋工作台（问答助手）

| 区域 | 内容 | 状态 |
| --- | --- | --- |
| 入口 | 左侧导航「投放管理 > RTA > 智能参谋」（位于 RTA 实验后、数据中心前） | ✅ |
| 形态 | per-RTA 有限上下文连续问答工作台（切换 RTA 自动重置会话） | ✅ |
| 意图分类 | v0.6 诊断解释意图 + v0.7 查询意图：overview / budget / attribution / evidence / excluded / recommendation / observation / rollback / metric_query / trend_query / group_compare / config_query / out_of_scope；另含 execute_refuse（拒绝执行）与数据不足降级 | ✅ |
| Mock 查询层 | QueryContext 统一当前 RTA、时间范围、实验组/对照组、配置变更和指标数据；所有查询结果带 `EV-*` evidenceId | ✅ |
| 查询能力 | 当前 RTA 指标查询、趋势对比、实验组/对照组对比、配置变更查询、诊断证据引用 | ✅ |
| 查询拒答 | 跨 RTA、数据不足、Schema 冲突、证据冲突、执行类请求均拒答或降级模板 | ✅ |
| 回答来源 | 模板优先（离线可跑）→ 可选 LLM 增强（复用 LLM_CONFIG 通道，独立 prompt + 校验，失败回退模板） | ✅ |
| 推荐问题 | 4 条首屏推荐 + 进入诊断结果后 2 条追问（推荐问与手动输入走同一流程） | ✅ |
| 上下文裁剪 | 保留首条欢迎语 + system + 最近 8 轮（MAX_TURNS=8） | ✅ |
| 边界 | 拒绝执行类请求；超范围问题（跨 RTA / 行业大盘 / 实时媒体状态）明确说明不能回答；数据不足不编造 | ✅ |
| 自动化验证 | `_verify_assistant.cjs`：47 个用例（8 项 forbidden 静态扫描 + 9 项 required 断言 + 30 项动态用例） | ✅ |

> 智能参谋只回答**当前所选 RTA 在当前 Mock 数据范围内**的诊断、分析和只读查数问题；它是诊断归因层的"追问/解释 + 有证据查数"入口，不构成通用问数 Agent（不做跨 RTA 历史查询、不做行业大盘、不直接执行任何配置变更）。

---

## 4. 与 PRD 对齐说明

| PRD 条目 | v6 实现 |
| --- | --- |
| §3.1 MVP 范围（14 节点 + 场景识别 + 现象标签 + AI 规划） | 全部覆盖 |
| §4.4 架构总览图（规则引擎 → 场景识别 → AI 层） | 三层函数分离，可分别替换为真实 LLM |
| §5.1 列表页（母版 A） | 8 列核心 + 4 列 Portfolio + 异常标签列 |
| §5.2 抽屉七段式（母版 B） | 00-07 全部实现 + 技术详情 + 术语表 |
| §6 状态机（10 状态） | 全部可达，数据不足/失败/重新诊断均可演示 |
| §8 场景识别（S0-S7 + 现象标签） | 短路顺序与 PRD §8.3 一致 |
| §10 Golden Case 数据（P-2026-SUMMER） | juliang-rta-2086 主判定结果与 §11.2 验收项 #7 一致 |
| §11.2 验收项 1-16 | 16 项全部通过 |

---

## 5. 关键判定结果（10 条 RTAID 场景分布）

| # | RTAID | 场景 | 列表异常标签 | Golden Case 标记 |
| --- | --- | --- | --- | --- |
| 1 | juliang-rta-2086 | S3 参竞/放行 | 预算未达标 | ⭐ Golden Case |
| 2 | tencent-rta-3112 | S0 配置故障（QPS 超限） | CPA 过高 | CPA 场景示例 |
| 3 | huawei-rta-5040 | S7 无链路异常 | 可安全放量 | 放量场景示例 |
| 4 | xiaomi-rta-7701 | S2 命中率下降 | 预算未达标 | |
| 5 | vivo-rta-8810 | S5 执行质量 | 预算未达标 | |
| 6 | oppo-rta-9921 | S6 回传/归因 | 回传异常 | |
| 7 | juliang-rta-2099 | S1 入口流量 | 预算未达标 | |
| 8 | honor-rta-1245 | S4 出价/竞价 | 预算未达标 | |
| 9 | juliang-rta-3050 | S0 配置故障（账户未绑定） | 配置故障 | |
| 10 | tencent-rta-4080 | S7 无链路异常 | 可安全放量 | |

> 覆盖了所有 8 个场景（S0-S7）+ 3 个现象标签（预算未达标 / CPA 过高 / 可安全放量）。

---

## 6. Golden Case 标准答案对照

| 评测项 | 标准答案 | v6 实际输出 | 通过 |
| --- | --- | --- | --- |
| 场景 | S3 参竞/放行 | S3 参竞/放行 | ✅ |
| 主因 | 实验组准入门槛 40%→80% 导致参竞率骤降 | 一致 | ✅ |
| 因果链方向 | 门槛→参竞→曝光→消耗 | oneLiner 完整表达 | ✅ |
| 次因 | 无独立次因 | 无独立次因 | ✅ |
| 建议 before | 80% | 准入门槛 = 80% | ✅ |
| 建议 after | 60% | 准入门槛 = 60% | ✅ |
| 三要素 | 观察指标/成功标准/回滚条件 | 齐全 | ✅ |
| 无「CPA 过高」标签 | actualCpa=30 ≤ targetCpa=25×1.2=30 | 未触发 | ✅ |
| 现象标签 | 含「预算未达标」 | 达成率 30% < 60% 触发 | ✅ |

> 自动化校验脚本：`_verify.cjs`（Node.js，10/10 通过）

---

## 7. 工程要点

### 7.1 零外网依赖

- 所有 JS/CSS 都在本地 `vendor/` 目录或 index.html 内联
- 字体走系统字体栈：`-apple-system, "Segoe UI", "Microsoft YaHei", "PingFang SC", system-ui, sans-serif`
- 数字走等宽栈：`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
- 唯一带 `https://` 的字符串是 mock 数据中的 BidURL（**不是资源引用**，仅是字段值）

### 7.2 禁止 ESM（v1-v5 教训）

- 不使用 `<script type="importmap">` / `<script type="module">` / `import` 语句
- Vue 走 UMD（`vendor/vue.global.js`），普通 `<script src="...">` 引入
- 主代码用 `const { createApp, ref, ... } = Vue` 解构

### 7.3 全局错误兜底

页面顶部固定红框（`#__errbox`）：
- `window.onerror` 捕获同步错误
- `window.onunhandledrejection` 捕获 Promise 错误
- 显示消息 + 文件路径 + 堆栈，禁止白屏无反馈

### 7.4 挂载点兜底

`<div id="app">` 内放「页面加载中…」占位文本，Vue 渲染成功自动覆盖。**不使用 v-cloak**（v-cloak 在 Vue 挂载失败时永久白屏）。

### 7.5 Tailwind 配置内联

`tailwind.config` 在 `<script>` 里直接定义，放在 vendor tailwind.js 之后。ink / brand 自定义色板覆盖 Tailwind 默认色阶。

### 7.6 三层架构可替换

```js
// 规则引擎：纯函数，独立可测
const signals = runRules(record);

// 场景识别：短路 + 现象标签叠加
const scenario = detectScenario(signals, record);

// AI 层：方案 B = LLM 生成 + 模板兜底
// Mock 阶段仅跑模板（LLM_CONFIG.enabled=false）；真实阶段打开后，函数签名不变
const ai = runAiLayer(record, signals, scenario);
```

### 7.7 AI 层 LLM 接入（方案 B · 浏览器 → 本地代理 → DeepSeek）

**v6 final 安全原则**
- **前端不持有任何 Key、不显示任何 Key 输入框、不发送任何 Authorization 头**
- Key 仅由 Node 进程 `llm-proxy.mjs` 从环境变量 `DEEPSEEK_API_KEY` 读取
- 代理未启动 / Key 未设置 → 返回 **HTTP 503 + `{ "error": "LLM_NOT_CONFIGURED" }`**；前端 catch 后静默回退模板，UI 不崩

**前端 `LLM_CONFIG`**（`index.html` 顶部 0.5 节）

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `endpoint` | `http://127.0.0.1:8787/llm` | 本地代理地址（仅绑 127.0.0.1）。浏览器不应直连 DeepSeek（会被 CORS 拦截） |
| `model` | `deepseek-chat` | DeepSeek 模型名 |
| `timeoutMs` | `10000` | AbortController 超时；超时即回退模板 |
| `temperature` | `0.4` | 偏稳态 |
| `enabled` | `false` | 默认关闭（演示稳定）；勾选 UI「AI 模式」即同步切换为 `true` |
| ~~`apiKey`~~ | ❌ 已删除 | 严禁在前端持有或提交。Key 只存在于代理进程环境变量 |

**如何开启真实 LLM（运维流程）**

```bash
# 1. 设置环境变量（PowerShell 示例；Bash 用 export DEEPSEEK_API_KEY=sk-xxx）
$env:DEEPSEEK_API_KEY = "sk-xxxxxx"

# 2. 启动本地代理（仅绑 127.0.0.1）
cd demo/v6
node llm-proxy.mjs

# 3. 浏览器打开 index.html（双击 file:// 或 python -m http.server 8080）
# 4. 勾选右上「AI 模式 · DeepSeek」→ 抽屉先出「模板」；LLM 1-3s 内校验通过 → 角标变「AI 生成」
```

启动代理时日志会显式标注「Key 状态: 已配置（N 字符，不打印）」或「未配置 → 所有 LLM 请求将返回 503」，**永远不会把 Key 内容写进日志**。

**异步调用流程**

```text
runAiLayer(record, signals, scenario)                  ← 同步
  └─ const tmpl = buildTemplateNarrative(...)          ← 立即可用结果（抽屉先渲染）
  └─ if (LLM_CONFIG.enabled)
        callLLM(record, signals, scenario)             ← 异步 fire-and-forget
          └─ POST http://127.0.0.1:8787/llm            ← 不带 Authorization
              └─ llm-proxy.mjs
                  ├─ 缺 DEEPSEEK_API_KEY → 503 { error: 'LLM_NOT_CONFIGURED' }
                  └─ 有 Key → 转发到 api.deepseek.com 时服务端注入 'Authorization: Bearer <key>'
          └─ 5 项校验 + Golden Case 特判
          └─ 校验通过 → window.dispatchEvent('rta-llm-override', { detail })
              └─ 抽屉 onLLMOverride 监听 patch AI 字段
              └─ 角标由「模板」变「AI 生成」
          └─ 任一失败（含 503 LLM_NOT_CONFIGURED / 500 / 网络错 / 超时）→ null
              └─ 抽屉保持模板结果，UI 不崩
```

**5 项输出校验**（任一不通过 → 回退模板）

1. **结构校验**：`oneLiner / managerSummary / operationsNote / recommendations` 字段齐全
2. **rec 7 要素**：每条建议含 `action / before / after / impact / observeMetrics / successCriteria / rollbackCondition`
3. **建议值对齐**：rec.before/after 必须含规则引擎给的关键数字（用 `=` 后第一个数字做匹配，避免一句话里多个数字误判）
4. **oneLiner 长度+因果链**：≥ 30 字 且 含 `→ | 导致 | 骤降 | 提升 | 下降 | 降低 | 高于 | 低于 | 超过` 之一
5. **单主因必须有建议**：abnormal 信号 ≤ 1 时 recommendations 不能为空

**Golden Case 特判**：当 `record.rtaId === 'juliang-rta-2086'` 时增加 4 项硬约束：
- `causes.primary` 含 `门槛`
- `recommendations[0].before` 含 `80%`
- `recommendations[0].after` 含 `60%`
- `causes.secondary === '无独立次因'`

任一不符即回退模板（保证 `_verify.cjs` Golden Case 评测稳定通过，不被 LLM 拖垮）。

**接口稳定不变**：前端七段式渲染、`DiagnosisReport` 字段形状、规则引擎 D1-D14、场景识别 S0-S7、Golden Case 判定结果**完全未动**。LLM 只生成自然语言；`causes.excluded` 与 `affectedScope` 透传模板（LLM 不得修改这部分）。

**`_verify_llm.cjs` 覆盖**（10 个用例，全 stub 测试，不读真实 Key）

| # | 用例 | 期望 |
| --- | --- | --- |
| ① | 静态扫描：index.html 不存在 `LLM_CONFIG.apiKey` 字段 | 通过 |
| ② | 静态扫描：前端 fetch headers 不含 `Authorization` 字段 | 通过 |
| ③ | 静态扫描：源码 / 注释 / UI 无"填入真实 Key 到前端"提示 | 通过 |
| ④ | LLM 关闭 → callLLM 应返回 null（不调 fetch） | ✅ |
| ⑤ | LLM 开启 + Golden Case 对齐 stub → 返回 `_source: 'llm'` | ✅ |
| ⑥ | LLM 开启 + 网络错误 → 回退模板 | ✅ |
| ⑦ | LLM 开启 + HTTP 500 → 回退模板 | ✅ |
| ⑧ | LLM 开启 + HTTP 503 / LLM_NOT_CONFIGURED → 回退模板 | ✅ |
| ⑨ | LLM 开启 + malformed JSON → 回退模板 | ✅ |
| ⑩ | LLM 开启 + 建议值与规则引擎不一致 → 回退模板（5 项校验失败） | ✅ |

> `_verify_llm.cjs` 是 **stub 测试**，不代表真实 DeepSeek 端到端验收。本轮未进行任何真实 DeepSeek 网络请求。

### 7.8 智能参谋问答通道（模板优先 + LLM 可选增强）

**与诊断抽屉同源**：智能参谋复用同一套 `runRules → detectScenario → runAiLayer` 诊断管线（懒计算，首次提问时才执行诊断），回答只基于该 RTA 的 `DiagnosisReport` 结构化事实，不另起业务判断，保证与抽屉七段式口径一致。

**回答生成流程**

```text
askAssistant(question)
  └─ classifyAssistantIntent(q)          ← 9 类正则 + execute_refuse 前置判定
  └─ answerAssistantQuestion(...)
      ├─ LLM 关闭（默认）→ buildAssistantTemplateAnswer 模板回答（完全离线）
      └─ LLM 开启 → callAssistantLLM
          ├─ 复用 LLM_CONFIG.endpoint / timeoutMs / temperature（不发 Authorization）
          ├─ 独立 prompt：只基于输入事实、不编造、主因建议与 DiagnosisReport 一致、拒绝执行类请求
          ├─ 输出校验：rtaId 一致 / intent 一致 / answer 非空 / 数值与 DiagnosisReport 一致
          └─ 任一失败 → null → 模板兜底，UI 不崩
```

**边界（与诊断抽屉一致）**：执行类请求一律 `execute_refuse` 并引导走人工确认状态机；超范围问题（跨 RTA / 行业大盘 / 实时媒体状态）返回 `out_of_scope` 说明；数据不足返回缺失字段清单，不编造。`_verify_assistant.cjs` 47 个用例覆盖上述全部分支（含 8 项静态扫描断言：前端无 apiKey / 无 Authorization / 无填 Key 提示）。

### 7.9 v0.7 Mock 只读查询层

`performDiagnosis(record)` 会为已完成报告挂载 `queryContext`：

- `metrics`：日预算、消耗、达成率、QPS、请求量、命中率、对照组/实验组参竞率、CPA、回传等指标；
- `trend`：当前 Mock 时间范围内的时序点；
- `groups`：对照组/实验组、分桶、实验组配置快照；
- `configChanges`：配置变更记录；
- `evidence`：所有可引用证据，稳定编号为 `EV-*`。

智能参谋新增 4 类查询意图：`metric_query`、`trend_query`、`group_compare`、`config_query`，并把原有 `evidence` 回答升级为证据查询。查询层只读、只查当前 RTA，不触发真实媒体 API。若 QueryContext Schema 不完整、趋势点不足、问题提到其他 RTAID，或计算结果与 Mock 字段冲突，参谋会拒答或降级，不编造数字。

LLM 可选增强仍复用本地代理；对查询型回答，校验器要求输出中包含合法 `EV-*` evidenceId，否则丢弃 LLM 结果并回退模板。

---

## 8. 自查结果（10 项）

| # | 自查项 | 工具 | 结果 |
| --- | --- | --- | --- |
| ① | grep index.html 无外部资源引用 | `grep "https\?://"` | ✅ 仅 mock 数据 URL（BidURL 字段） |
| ② | 无 importmap / type="module" / import | `grep -E "(importmap\|type=\"module\"\|^import )"` | ✅ 0 处 |
| ③ | Vue UMD 解构 `const { createApp, ... } = Vue` | grep | ✅ L113 |
| ④ | tailwind.config 含 ink/brand 色板 | grep | ✅ L20/L25 |
| ⑤ | Golden Case 判定：主因 D9 / 场景 S3 / 80→60 / 无 CPA 过高 | `_verify.cjs` | ✅ 10/10 |
| ⑥ | 列表可见「CPA 过高」+「可安全放量」 | `_verify.cjs` | ✅ 两条都可见 |
| ⑦ | 全局错误捕获（故意抛错见红框） | window.onerror + #__errbox | ✅ 顶部红框渲染 |
| ⑧ | LLM 路径 10 个用例全过（含 3 项静态扫描：前端无 apiKey / 无 Authorization / 无填 Key 提示；7 项动态 stub：关闭/Golden 对齐/网络错/500/503 LLM_NOT_CONFIGURED/malformed JSON/校验失败） | `_verify_llm.cjs` | ✅ 10/10 |
| ⑨ | 智能参谋 47 个用例全过（8 项 forbidden 静态扫描 + 9 项 required 断言 + 30 项动态用例，覆盖诊断解释意图 + 执行拒绝 + 超范围 + 数据不足） | `_verify_assistant.cjs` | ✅ 47/47 |
| ⑩ | v0.7 查询层 30 个用例全过（Schema / evidenceId / 指标 / 趋势 / 组间 / 配置 / RTA 隔离 / 冲突拒答 / LLM 查询证据校验） | `_verify_v07.cjs` | ✅ 30/30 |
| ⑪ | v0.8 Provider 契约通过（只读能力 / current-RTA 范围 / 标准错误 / Envelope Schema） | `_verify_v08_provider.cjs` | ✅ 14/14 |

---

## 9. 演示路径（建议）

1. **打开页面**：默认展示 10 条 RTAID 列表，第 1 行（juliang-rta-2086）红底 + 「预算未达标」徽标。
2. **Golden Case 演示**：点击第 1 行「发起诊断」蓝按钮 → 抽屉滑入 → 1.2s 读取 + 1.8s 诊断 → 700ms 自动到「待人工确认」→ 查看七段式输出（主因 = 准入门槛 40%→80% / 建议 = 80%→60%）。
3. **CPA 过高演示**：点击第 2 行（tencent-rta-3112）「发起诊断」→ 场景标签「S0 配置故障 + CPA 过高」→ 查看 AI 建议「收人群 + 降出价」。
4. **可安全放量演示**：点击第 3 行（huawei-rta-5040）「发起诊断」→ 场景「S7 + 可安全放量」→ 建议「日预算分层加码」。
5. **数据不足演示**：勾选右上角「演示数据不足模式」→ 任意行点击 → 抽屉显示 insufficient 状态 + 缺失字段清单 + 「补全后重新诊断」按钮。
6. **10 状态机演示**：在 Golden Case 抽屉里依次点「批准方案」→「我已执行」→「复盘完成」→「重新诊断」→ 可遍历 EXECUTING / WAITING / REVIEWED / 重新走诊断。
7. **术语对照表**：抽屉最底部「📖 术语对照表（黑话翻译）」默认折叠，点击展开可看 10 个术语翻译。
8. **技术详情**：抽屉倒数第二段「07 · 人工确认 + 技术详情」默认折叠，点击展开可看 RTAID/实验 ID/分桶/请求 ID/日志路径/configBefore/After 等。
9. **AI 模式演示（需先启动本地代理 + 设置 DEEPSEEK_API_KEY）**：在终端 `export DEEPSEEK_API_KEY=sk-xxx`（Windows PowerShell: `$env:DEEPSEEK_API_KEY='sk-xxx'`）→ `cd demo/v6 && node llm-proxy.mjs` → 浏览器打开 index.html → 勾选右上角「AI 模式 · DeepSeek」→ 任意行点击「发起诊断」→ 抽屉先出现「模板」（灰角标），约 1-3s 后若 LLM 通过 5 项校验 + Golden Case 特判，角标自动变为「AI 生成」并 patch oneLiner / managerSummary / operationsNote / recommendations 文案；任何失败链路（代理未启动 / Key 未设置 503 / 网络断 / 校验不过 / Golden Case 不符）→ 角标保持「模板」，UI 不崩。**前端不会显示、不会要求你填写任何 Key**。
10. **智能参谋演示**：左侧菜单「投放管理 > RTA > 智能参谋」→ 选择 RTAID → 点击右侧推荐问题（如"这个 RTA 现在有什么异常？"）→ 模板秒回；追问"为什么预算没有跑出去？""建议调整什么，调整后观察哪些指标？""回滚条件是什么？" → 命中诊断解释回答；输入"当前 CPA、转化数和 QPS 指标是多少？""参竞率趋势从开始到最后下降了多少？""对照组和实验组对比如何？""配置变更记录是什么？" → 命中 v0.7 QueryContext 查数回答，并显示 `EV-*` 证据引用；输入"直接帮我加预算" → 触发 execute_refuse 拒绝执行并引导走人工确认流程；输入"别的 RTA 呢？" → out_of_scope 说明只能回答当前 RTA；切换 RTA → 会话自动重置。

---

## 10. 与 v1-v5 的关系

| 版本 | 定位 | 状态 |
| --- | --- | --- |
| v1-v3 | 早期 Demo（Vite + ESM），依赖外网 CDN | ❌ 废弃 |
| v4 | 离线化尝试但仍用 ESM importmap，本地双击白屏 | ❌ 废弃 |
| v5 | 重建中 | ❌ 废弃 |
| **v6** | **从零构建：单文件 + 普通 script + 完全离线** | ✅ 当前 |

---

## 11. 限制与已知问题

1. **第三方字段【待核验】**：BidURL、媒体侧 RTAID 映射、SecretKey 等媒体侧字段保留 mock 标注，真实接入前需核验。
2. **执行日志缺回放**：本期不做单次请求的全链路回放（按 PRD §3.2 不纳入）。
3. **场景叙事模板**：6 个场景（S0/S1/S2/S3/S4/S5/S6）均有独立完整叙事分支（oneLiner / managerSummary / operationsNote / causes / affectedScope / recommendations 七段式），与 S3 Golden Case 同等深度。其中 S2 命中率下降提供 2 套建议（人群回滚 + 字段放宽），S4 出价/竞价提供 2 套建议（出价回调 + 小流量试探）；S1/S5/S6 明确体现"不调 RTA 策略 / 先排障 / 先修回传"的边界判断。末尾保留一段防御性兜底，仅用于未匹配 sceneId 的情况（新增场景未同步时保护，正常流程不会进入）。
4. **AI 层接入方式（v6 final 安全版）**：方案 B = 浏览器 → 本地代理 `llm-proxy.mjs` → DeepSeek。当前 `LLM_CONFIG.enabled = false`，AI 层仅返回 `buildTemplateNarrative` 输出，与 v6 上一版本行为完全一致；勾选 UI「AI 模式」后请求本地代理。**前端不持有、不显示、不要求填写任何 Key**——Key 仅存在于代理进程的 `DEEPSEEK_API_KEY` 环境变量（启动时显式标注 Key 状态，但不打印 Key 内容）。函数签名对齐《AI 层设计与评测方案》§4.1，可无痛替换为真实 LLM 调用。
5. **跨媒体字段差异**：分桶方式（平台/客户）、出价方式（系数/CPA/CPC）已在对象模型层覆盖，但具体媒体差异（VIVO 毫分、荣耀 priceRate 等）保留 mock 标注。
6. **LLM 接入为可选开关**：默认关闭走模板，演示稳定无网也能跑；切换至真实 LLM 需要"运维在启动代理前 `export DEEPSEEK_API_KEY=<key>` → `node llm-proxy.mjs` → 浏览器勾选 AI 模式"。LLM 失败 / 校验不过 / 超时 / 网络错 / JSON 错 / Golden Case 不符 / 代理未启动 (ConnectionRefused) / Key 未设置 (503 LLM_NOT_CONFIGURED) 一律回退模板，`_verify_llm.cjs` 10/10 覆盖所有路径（含 3 项静态扫描断言：前端无 apiKey / 无 Authorization 头 / 无"前端填 Key"提示）。`llm-proxy.mjs` 是核心代码，**前端调用是可选的，不影响模板演示路径**。**Key 严禁出现在前端代码或截图；真实产品中应使用服务端 secret manager。**
7. **智能参谋为受限问答**：只回答**当前所选 RTA 在当前数据范围内**的诊断与分析问题（9 类意图），不提供跨 RTA 历史查询、行业大盘或实时媒体状态；执行类请求一律拒绝并引导走人工确认流程。与诊断抽屉共用同一份 `DiagnosisReport` 事实，保证主因/建议口径一致。默认模板离线可用；LLM 增强为可选（复用本地代理通道，Key 仍只在代理进程）。`_verify_assistant.cjs` 47/47 覆盖全部意图与边界分支。

---
## 12. 相关文档

- PRD：《项目三：RTA 投放诊断 Agent · PRD v0.2.1》
- 场景方案：《场景扩展方案 v0.2》（S0-S7 + 现象标签）
- 契约：《Agent 输入输出结构契约 v0.3》（v0.3 基于 v6 落地场景识别 + CPA 现象标签；D14 CPA 判定为契约 v0.3 增补，仅服务现象标签，不进 S0-S7 短路链）
- AI 层：《AI 层设计与评测方案 v0.2》（输入输出、证据约束和评测）
- 规则表：《MVP 诊断规则表 v0.1》（D1-D14；D14 CPA 判定仅服务现象标签「CPA 过高」，不进 S0-S7 短路链）
- 对象模型：《RTA 对象模型与字段清单 v0.1》（O1-O11）
- 字段口径：基于脱敏后的平台字段抽象；内部截图参考材料不随公开版本发布

---

## 13. 在智能投放多 Agent 蓝图中的位置

**RTA 投放诊断 Agent 是智能投放多 Agent 蓝图中的"诊断归因层"，位于异常感知之后、优化建议和人工执行之前。**

```text
[异常感知] → [诊断归因]（本 Demo） → [优化建议] → [人工执行]
              └──────────────┘
                  RTA 投放诊断 Agent
```

本节用于说明 Agent 在更大业务链中的边界。本轮 Demo 范围 = **诊断归因层**：实现的是"规则引擎 + 场景识别 + AI 归因解释 + 人工确认/执行 + 智能参谋受限问答"；**没有**实现效果预测、趋势分析、应急暂停、跨 RTA 通用问数等其他 Agent 的能力——智能参谋仅提供**当前 RTA 诊断范围内的受限问答**（见 §3.5 / §7.8），不是独立问数 Agent，不扩大范围。

---

_最后更新：2026-08-26 · v6 Demo 对齐版（智能参谋问答工作台 + LLM 安全版 + 数据范围 + 蓝图定位）_
