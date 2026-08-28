# RTA 投放诊断 Agent

> 面向 RTA（实时竞价）投放优化的受控 Agentic Workflow：规则引擎确定性判定 → 场景识别 → AI 归因/解释/规划 → 人工确认执行。

当前发布版本：`v0.8.0`（Provider-backed Read-only Demo）

V0.8.0 已正式发布。当前 Demo 通过 Provider Envelope 驱动只读工具，包含 MediaDataProvider 契约、MockMediaDataProvider、ReplayMediaAdapter（缓存、新鲜度和错误降级）以及只读工具白名单。智能参谋可在当前 RTA、当前合成 Mock/Replay 数据范围内查询指标、趋势、实验组/对照组、配置变更和证据引用；不接真实媒体 API。

V0.9（服务端只读 Staging 接入准备）开发中（未发布），见 [docs/architecture/v0.9-field-mapping-baseline.md](docs/architecture/v0.9-field-mapping-baseline.md)、[v0.9-staging-adapter-design.md](docs/architecture/v0.9-staging-adapter-design.md)、[v0.9-security-audit-design.md](docs/architecture/v0.9-security-audit-design.md) 三份契约。

## 在线 Demo

[打开 GitHub Pages Demo](https://crpisynoodleeeee.github.io/rta-diagnosis-agent/)

建议使用桌面浏览器体验。3 分钟路径：

1. 打开列表页第 1 行 `juliang-rta-2086`，查看 Golden Case。
2. 点击「发起诊断」，查看读取、诊断和待人工确认状态。
3. 查看七段式输出：准入门槛 `40% → 80%`，参竞率 `60% → 10%`，曝光与消耗下滑。
4. 点击「批准方案」，体验人工执行、数据回流和复盘状态。
5. 进入「投放管理 > RTA > 智能参谋」，体验当前诊断范围内的受限问答。

在线版默认使用模板模式，完全离线运行。可选 DeepSeek 模式需要在本地启动代理；前端不保存 API Key。

## 核心能力

| 能力 | 当前实现 |
| --- | --- |
| 规则诊断 | D1-D14 配置、流量、命中、参竞、服务、出价和归因检查 |
| 场景识别 | S0-S7 卡点定位 + 预算未达标、CPA 过高、可安全放量标签 |
| AI 层 | 原因排序、因果解释、实验方案、观察指标、成功标准和回滚条件 |
| 人工控制 | 十状态工作流，AI 只生成草稿，不直接修改投放配置 |
| 智能参谋 | 围绕当前 RTA 和当前诊断报告的受限追问、解释与 V0.8 Provider/Mock/Replay 查数 |
| Mock 查询层 | QueryContext + evidenceId，支持指标、趋势、组间、配置变更和证据查询 |
| 工程验证 | Golden Case、场景、LLM 安全路径、智能参谋、v0.7 查询层和 V0.8 Provider 专项验收脚本 |

## 架构边界

```text
ConfigSnapshot + MetricBundle
          ↓
规则引擎 D1-D14
          ↓
场景识别 S0-S7
          ↓
AI/模板诊断输出
          ↓
人工确认与模拟复盘
```

规则引擎负责确定性判定和证据收集；AI 负责解释、原因排序和方案草拟。所有展示数据均为合成 Mock 数据，不包含真实媒体账户或公司业务数据。

当前版本不包含真实媒体 API、自动异常监控、跨 RTA 历史查询、行业大盘、生产级权限审计或真实配置修改。

完整边界见 [产品边界](docs/BOUNDARIES.md)。

## 文档

| 文档 | 用途 |
| --- | --- |
| [v0.8.0 发布说明](docs/releases/v0.8.0.md) | 当前发布版本、Provider/Replay 只读边界和专项验收 |
| [v0.7.0 发布说明](docs/releases/v0.7.0.md) | 历史版本、Mock 查询层、证据编号和专项验收 |
| [V0.8 Provider 契约](docs/architecture/v0.8-provider-contract.md) | 统一数据 Provider、Mock 抽离、回放 Adapter、Adapter 边界和分批迁移方案 |
| [V0.9 字段映射基线](docs/architecture/v0.9-field-mapping-baseline.md) | V0.9 契约：Staging 规范化字段与待外部核验项 |
| [V0.9 Staging 只读 Adapter 设计](docs/architecture/v0.9-staging-adapter-design.md) | V0.9 契约：服务端只读 Adapter 组件边界、回放样本格式和授权前提 |
| [V0.9 安全、审计与监控设计](docs/architecture/v0.9-security-audit-design.md) | V0.9 契约：凭证、脱敏、审计、监控 schema 和 P2 验收标准 |
| [v0.6.0 发布说明](docs/releases/v0.6.0.md) | 历史版本、验证范围和已知限制 |
| [PRD v0.2.1](PRD%20v0.2.1.md) | 产品范围、页面、状态机和验收标准 |
| [Agent 输入输出结构契约 v0.3](Agent输入输出结构契约%20v0.3.md) | 输入、输出和字段契约 |
| [AI 层设计与评测方案](AI层设计与评测方案.md) | AI 分工、Golden Case 和 L1-L4 评测 |
| [MVP 诊断规则表](MVP诊断规则表.md) | D1-D14 规则与阈值 |
| [RTA 对象模型与字段清单](RTA对象模型与字段清单.md) | O1-O11 对象模型 |
| [Mock 数据口径说明](Mock数据口径说明.md) | 数据来源层级和模拟数据边界 |
| [Demo v6 说明](demo/v6/README.md) | 功能、架构、LLM 接入和本地运行 |
| [部署说明](docs/DEPLOYMENT.md) | GitHub Pages、本地 Demo 和发布检查 |
| [Changelog](CHANGELOG.md) | 版本变更记录 |

## 验收

在 `demo/v6` 目录运行：

```powershell
node _verify.cjs
node _verify_scenes.cjs
node _verify_llm.cjs
node _verify_assistant.cjs
node _verify_v07.cjs
node _verify_v08_provider.cjs
```

六组验收脚本覆盖 Golden Case（7/7）、5 类扩展场景（5/5）、LLM 路径（10/10）、智能参谋（47/47）、v0.7 查询层（30/30）和 V0.8 Provider 专项（34/34）。测试使用 Mock 数据和 Stub，不代表真实媒体接口联调或业务收益。

V0.9 验收脚本为 `server/_verify_v09.cjs`（开发中），按 contract / adapter / security / audit / llm-tools 五组执行中，结果待验收；V0.9 尚未发布。

V0.8.0 已合并到 `main`、打标签并发布；真实 Staging API 只读联调、服务端凭证与最小权限、Token 轮换、脱敏日志、调用审计、真实 LLM 工具调用验证、监控和租户治理属于 V0.9。

## 部署

```powershell
.\deploy-ghpages.ps1
```

详细步骤见 [部署说明](docs/DEPLOYMENT.md)。
