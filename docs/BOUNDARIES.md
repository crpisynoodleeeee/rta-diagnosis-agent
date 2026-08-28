# Product Boundaries

## Current release

This repository publishes RTA Diagnosis Agent v0.8.0, the Provider-backed Read-only Demo. The product documents are PRD v0.2.1 and Agent input/output contract v0.3.

## Included

- RTA diagnosis and attribution for the selected RTA.
- D1-D14 rule checks and S0-S7 scenario recognition.
- AI or template-based explanation, cause ranking and experiment planning.
- Ten-state human confirmation workflow.
- Restricted assistant for follow-up questions about the current diagnosis report.
- v0.8 MediaDataProvider contract, MockMediaDataProvider, ReplayMediaAdapter and Provider Envelope integration for read-only tools.
- Read-only queries for the selected RTA: metrics, trends, experiment/control comparison, configuration changes and evidence references.

## Not included

- Real media API or production advertising account integration.
- Real company, customer or campaign data.
- Automatic anomaly monitoring or proactive alerting.
- Cross-RTA historical queries or industry benchmarks.
- General-purpose data agent, cross-RTA comparison, account-wide historical analysis or real-time media status.
- Direct budget, bid or strategy modification.
- Production-grade authentication, tenancy, audit, rollback and observability; these are V0.9 preparation areas.
- Proven business uplift, diagnosis accuracy on historical production data or commercial results.

## Data and AI boundary

All visible data is synthetic Mock or Replay data. The rules engine performs deterministic checks and evidence collection. The V0.8 query layer reads only the selected RTA through the Provider Envelope and returns numbered evidence references; it does not connect to a real media API. The AI layer explains, ranks causes and drafts experiments; it must not calculate authoritative metrics, invent evidence or override rule results.

The public GitHub Pages Demo runs in template mode by default. Optional DeepSeek access is routed through the local `demo/v6/llm-proxy.mjs`; no API key belongs in frontend code or repository history.

V0.9 may add a server-side Staging read-only Adapter only after API documentation, field mappings, test credentials or permissions, and desensitized replay samples are provided and Staging access is explicitly approved. Production credentials, real company data and write APIs remain out of scope.
