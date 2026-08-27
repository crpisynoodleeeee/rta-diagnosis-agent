# Product Boundaries

## Current release

This repository publishes RTA Diagnosis Agent v0.7.0, the Queryable Mock Evidence Layer. The product documents are PRD v0.2.1 and Agent input/output contract v0.3.

## Included

- RTA diagnosis and attribution for the selected RTA.
- D1-D14 rule checks and S0-S7 scenario recognition.
- AI or template-based explanation, cause ranking and experiment planning.
- Ten-state human confirmation workflow.
- Restricted assistant for follow-up questions about the current diagnosis report.
- v0.7 read-only Mock query layer for the selected RTA: metrics, trends, experiment/control comparison, configuration changes and evidence references.

## Not included

- Real media API or production advertising account integration.
- Real company, customer or campaign data.
- Automatic anomaly monitoring or proactive alerting.
- Cross-RTA historical queries or industry benchmarks.
- General-purpose data agent, cross-RTA comparison, account-wide historical analysis or real-time media status.
- Direct budget, bid or strategy modification.
- Production-grade authentication, tenancy, audit, rollback and observability.
- Proven business uplift, diagnosis accuracy on historical production data or commercial results.

## Data and AI boundary

All visible data is synthetic Mock data. The rules engine performs deterministic checks and evidence collection. The v0.7 query layer reads only the selected RTA's Mock `QueryContext` and returns numbered evidence references. The AI layer explains, ranks causes and drafts experiments; it must not calculate authoritative metrics, invent evidence or override rule results.

The public GitHub Pages Demo runs in template mode by default. Optional DeepSeek access is routed through the local `demo/v6/llm-proxy.mjs`; no API key belongs in frontend code or repository history.
