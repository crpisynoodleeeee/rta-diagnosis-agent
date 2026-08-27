# Changelog

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
