# Changelog

## v1.0.0 - 2026-08-31

### Added

- 异常诊断工作台（P5）：任务队列支持待关注、数据不足、待审批、观察中计数与筛选 tab；任务详情提供任务摘要、判断过程五步、判断依据三组证据、下一步动作四件套；数据不足或过期时不生成伪结论；语境化智能参谋通过 `blockedTopics` 拒答。
- 可治理诊断闭环（V1.0）：observer / optimizer / approver 角色与最小权限控制（领域层一致拒绝并保留审计留痕）；处置草稿与人工审批状态机 `draft` → `pending_approval` → `approved/rejected` → `execution_recorded` → `observing` → `reviewed` → `closed`；审计时间线；`normal` / `stale` / `partial` / `timeout` / `permission_denied` / `cross_tenant_denied` 稳定性与降级可视化；观察与复盘闭环。
- 治理核心为 `demo/v6/governance/` 下的纯前端 Mock 领域层（Mock-Ready）；租户隔离、Token 轮换、限流熔断、审计不可篡改为契约设计 + 离线测试，未建设生产基础设施。
- 证据面板产品化（P3）：证据按支持当前判断、已排除的原因、当前仍需确认三类分组，并提供数据质量摘要、`EV-*` 编号与技术详情折叠。
- 业务语言收口：页面主层级统一为投放优化师视角，使用异常任务、投放对象、异常类型、数据状态、处理状态、建议动作，以及判断过程、判断依据、处理进度、处理操作、操作记录、诊断助手、完整诊断报告。
- 验收结果：V1.0 专项 7/7、P5 专项 6/6、一键回归 8/8、智能参谋 47/47、P3 静态断言 20/20，浏览器 CDP 实测通过。

### Boundaries

- 全部业务数据为合成 Mock/Replay，未接入真实媒体 API、未使用真实凭证、未发真实请求。
- 不直接修改预算、出价或策略；处置草稿人工审批为模拟流程（零真实写接口）。
- 真实媒体 API 联调待企业主体授权（外部条件成就项，不阻塞本版本）。
- 租户隔离、密钥托管、限流熔断等为契约设计 + 离线测试，非生产基础设施。

## v0.9.1 - 2026-08-29

### Added

- 基于巨量开放平台公开接口文档完成字段契约核验（28 份文档、72 项待核验：20 已核验 / 27 部分核验 / 19 未找到公开依据 / 6 需真实响应）。
- Staging Adapter 对齐巨量公开契约：RTA 字段（`rta_id` / `interface_info.status` / `delivery_range` / `local_qps` / `union_qps` / `vid` / `cus_vid` / `strategy` 分桶）、指标字段（`request_count` / `bid_count` / `convert` / `cost` / `bid_coef`）与 15 个业务码到 5 类 `ProviderError` 的映射。
- adapter 验收组新增 6 项巨量契约对齐用例（8 → 14）。

### Boundaries

- 零凭证：仅核验公开文档，未调用媒体业务接口、未使用真实凭证、未发真实请求。
- 真实凭证验证待企业授权；6 项字段需真实响应确认（不阻塞封版）。
- 不引入写接口；只读边界与离线 Mock/Replay 口径保持不变。

## v0.9.0 - 2026-08-28

### Added

- 服务端只读 Staging 接入准备（契约三件套）：字段映射基线、Staging 只读 Adapter 设计（含回放样本格式）、安全-审计-监控设计。
- 回放样本与验证聚合器骨架。
- 服务端 staging adapter / security / audit / monitor 模块（实现中）。
- `server/_verify_v09.cjs` 验收脚本按 5 组（contract / adapter / security / audit / llm-tools）执行中。

### Boundaries

- 真实 Staging 联调须等待 API 文档、字段核验、脱敏样本、测试凭证/权限和明确的 Staging 授权。
- 不接生产 API、生产凭证和真实公司数据；不引入任何预算、出价、策略等写接口。

## v0.8.0 - 2026-08-27

### Added

- Unified read-only `MediaDataProvider` contract and `ProviderEnvelope`.
- `MockMediaDataProvider` extraction for Demo record access.
- `ReplayMediaAdapter` with normalized media-shaped responses, cache, freshness and typed degradation.
- Read-only tool whitelist for metrics, trends, group comparison, configuration changes and diagnosis evidence.
- Provider provenance and quality metadata retained through query results and `EV-*` evidence.
- `_verify_v08_provider.cjs` with 34 validation cases.

### Boundaries

- Data remains synthetic Mock/Replay data; no real media API or production account is connected.
- No budget, bid or strategy write operation is introduced.
- Production credentials, staging integration, monitoring and tenant governance remain planned for V0.9.

## v0.7.0 - 2026-08-26

### Added

- QueryContext Mock data layer with stable `evidenceId` references.
- Read-only assistant queries for current-RTA metrics, trend comparison, control/treatment comparison, configuration changes and diagnosis evidence.
- QueryContext Schema validation with missing-data and evidence-conflict refusal paths.
- LLM assistant validation for query answers: query responses must cite valid `EV-*` evidence IDs or fall back to templates.
- `_verify_v07.cjs` validation script covering 30 query-layer cases.

### Boundaries

- Querying remains limited to the selected RTA and synthetic Mock data.
- No real media API, production data, write operation, budget change or automated execution is introduced.
- Cross-RTA history, industry benchmarks and real-time media status remain out of scope.

## v0.6.0 - 2026-08-23

### Added

- D1-D14 deterministic diagnosis rules.
- S0-S7 scenario recognition and phenomenon tags.
- Ten-state human confirmation workflow.
- Seven-section diagnosis report with technical evidence.
- Optional DeepSeek local proxy with template fallback.
- Restricted assistant for the selected RTA diagnosis context.
- Four groups of automated validation scripts.
- Offline-capable Demo v6 and GitHub Pages deployment.

### Boundaries

- All accounts, configurations, metrics and logs are synthetic Mock data.
- No real media API, production account or business result is included.
- The public Demo defaults to template mode; LLM mode requires a local proxy.
- The system does not directly modify budgets, bids or strategies.

## Next

V0.8 introduces a unified read-only `MediaDataProvider` contract, Mock Provider extraction, normalized data metadata and replay-based Adapter validation. Real staging API integration remains planned for V0.9.
