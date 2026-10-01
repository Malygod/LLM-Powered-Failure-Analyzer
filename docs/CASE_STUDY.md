# Causelab: turning an apparently successful run into a testable failure

## Problem and contribution

A knowledge assistant can finish its tools and return a fluent answer while still misleading the user. An execution-success dashboard hides this failure. Causelab connects the answer to its retrieval evidence, checks it against a fixed benchmark, and gives a developer a reviewable repair proposal.

Matías Sepúlveda's prototype supplied FastAPI trace ingestion, SQLAlchemy relationships, version comparison and synchronous LLM diagnostics. This iteration, developed with AI coding assistance, adds a recruiter walkthrough, trace timing and hierarchy, a Python SDK, test-set evaluation, persistent investigation jobs, schema migrations and explicit simulation boundaries.

## The featured failure

The question is whether logs older than 30 days can be exported. The faulty retriever returns only the general retention overview. A second document explains that archives must be enabled before expiry and deleted logs cannot be recovered. Without that document, the agent claims exports are always available for 90 days.

Execution completes, but required-fact, unsupported-claim and citation checks fail. The inspector links the failure to `retrieve` and `compose`. The proposed repair retrieves up to three documents and instructs the candidate to cite evidence and abstain on missing or conflicting facts.

## Measured results

The reproducible fixture suite contains 20 cases: eight ordinary factual questions, three incomplete-retrieval cases, one timeout, two missing-evidence cases, two conflicts, two malformed results and two retrieved prompt injections.

| Scripted version | Cases passing | Quality pass rate | Model calls |
| --- | ---: | ---: | ---: |
| Baseline | 20/20 | 100% | 0 |
| Faulty | 8/20 | 40% | 0 |
| Repaired | 20/20 | 100% | 0 |

Generate these results with `python scripts/build_demo.py`. They are deterministic reference-agent simulations, **not measured improvements from a live language model**. The reference agent uses authored answers; the evaluator tests known requirements. Recorded latency is synthetic, cost is zero, and the suite has not been independently human-reviewed. Each fixture and expected fact is available in `backend/app/fixtures/cases.json` for review.

In local live mode, a real provider proposes the candidate prompt/configuration and answers the same cases using fixed simulated retrieval tools. Those results can differ, time out, or introduce regressions. The report distinguishes its recorded baseline from its live candidate. It never claims to replay arbitrary third-party agents.

## Engineering decisions

**Stable ingestion.** Runs have external IDs and canonical payload fingerprints. An identical retry returns the saved trace; a conflicting payload gets HTTP 409. Traces, analyses and investigations are not deleted to make a retry succeed. Legacy records lacking fingerprints stay intact.

**Explicit comparison.** Cases pair by stable case ID, with normalized input as a compatibility fallback. Repeated observations pair chronologically, and extra runs remain visible as unmatched. Execution and quality results are separate. These comparisons describe a test set, not inferred statistical drift in production traffic.

**Durable work.** A PostgreSQL-backed job queue avoids relying on an API process staying alive. Workers claim jobs with row locks, persist a lease and fencing token, and checkpoint successful cases. Transient provider failures retry at most three job attempts; terminal failures remain explicit.

**Bounded autonomy.** A job can propose one candidate and execute one 20-case suite. Its allowed changes are prompt text, retrieval top-k and one simulated tool retry. It has a durable 24-call budget, per-call timeout and wall-clock deadline. Invalid JSON, invalid span references, absent credentials and exhausted budgets are distinct failures. No repository or production writes are available.

**Deliberate public/private split.** The public frontend uses recorded artifacts and makes no API calls for the walkthrough. Live pages require a local environment switch. The API is localhost-oriented and unauthenticated; enabling it is not a substitute for access control.

**Data evolution.** Alembic first adopts the original tables, then adds trace metadata, case definitions and job state. Tests retain an existing run and failure analysis across migration. The legacy SQLite filename is recognized so rebranding cannot quietly open a different empty database.

## Validation and remaining limits

The repository includes unit/integration tests for idempotency, aggregate metrics, comparison pairing, migration preservation, lease recovery, model-output validation, budget exhaustion, prompt-injection fixtures and repairs that introduce new regressions. SDK checks exercise async context isolation, retries, exception capture, redaction and unavailable ingestion. Playwright checks the full recorded path, keyboard selection, filters, deep links, exports, comparison and a 390-pixel viewport.

A dedicated PostgreSQL concurrency test exercises two workers against a migrated disposable database. CI runs this independently from SQLite unit tests. Browser recording is reproducible through `npm run record`.

Limitations are intentional: no multi-tenant auth, no arbitrary agent replay or code repair, no production provider pricing, no model judge, no persistent SDK disk spool and no claim of statistical significance. Exact-match checks can reject acceptable paraphrases and miss unsupported claims outside the listed patterns. Real deployment would need a larger human-reviewed dataset, tenant isolation, data retention policies, production operational telemetry and domain-specific evaluators.

## Local validation record

Verified in this workspace:

- 23 backend/SDK tests passed; the separate PostgreSQL test is skipped when its dedicated database URL is absent.
- The PostgreSQL 18 migration, canonical seed import, and two-worker concurrency test passed against a disposable UTF-8 database.
- All 10 browser checks passed across desktop and a 390-pixel viewport, including the complete no-backend walkthrough.
- Frontend lint, TypeScript checks and the Next.js production build passed.
- The installed npm dependency audit reported zero vulnerabilities after compatible dependency updates.
- The silent walkthrough recording was generated and the dashboard screenshot visually reviewed.

Live model calls were not run because no provider key was configured. Controlled provider responses exercise the candidate report and failure paths. No production deployment was made because this checkout has neither Vercel project credentials nor a linked project. The frontend-only deployment configuration and instructions are prepared.

## Recruiter review

Start with the interactive trace and its failed checks, then inspect the SDK, migration and worker tests. The core engineering evidence is how a failure becomes understandable and testable, including when automation stops and asks for developer judgment.

## Visual identity

Causelab uses the warm stone surfaces, charcoal trace panels, restrained red accents, and typography of [Matías’s portfolio](https://malygod.netlify.app/). The original SVG mark combines a C with a branching trace: a failed path and a successful path. The public demo remains recorded, and the previous `tracehaven` SDK import and existing database identifiers remain compatible.
