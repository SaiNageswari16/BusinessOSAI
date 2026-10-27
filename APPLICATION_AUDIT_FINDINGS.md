# BusinessOSAI Application Audit Findings

**Review date:** 2026-10-26  
**Review type:** Static architecture, wiring, configuration, and integration review  
**Repository state:** Read-only review. Existing user edit in `frontend/src/components/pos/PosInvoicesHistory.tsx` was left untouched.

## Executive summary

The repository contains multiple application surfaces that currently behave as a unified product primarily through the main FastAPI backend and React/TanStack frontend. The main source inventory is approximately 82 FastAPI route files, 7 model files, 438 frontend component files, and 47 frontend route files, alongside a partial POS backend subtree, a desktop Electron wrapper, data importer, and WhatsApp gateway.

The highest risk areas are configuration-dependent production connectivity and security: the frontend's API base defaults to loopback; the WhatsApp gateway's webhook defaults to loopback; backend CORS is unrestricted while credentials are allowed; and credential-like values are present in backend configuration defaults and the tracked sample environment file. The API assembly also registers POS routers twice. Database schema changes are applied imperatively at service startup, while the health endpoint does not report database degradation.

This report prioritizes concrete, source-supported risks. It does not claim that external services are live or broken: no deployment environment, production secrets, or external account connectivity was available for verification.

## Severity scale

- **Critical:** credible path to unauthorized privileged access or secret compromise.
- **High:** likely production outage, materially unsafe configuration, or misleading operational status.
- **Medium:** duplicated/ambiguous wiring or a feature that is liable to fail under common deployment configurations.
- **Low / follow-up:** maintainability, documentation, or verification gap without a demonstrated immediate failure.

## Findings

### F-01 — Credential-like secrets are committed in source/configuration

**Severity: Critical**  

`backend/src/config/settings.py` supplies non-empty defaults for Whitebooks client secrets and the Razorpay key secret. `backend/.env.example` is tracked and contains a credential-looking SMTP password rather than a neutral placeholder. Whether those values are currently valid is unknown; because they are committed, treat them as compromised until checked and rotated. The local `backend/.env` is ignored and was not included in this report.

**Impact:** source access can expose credentials; fallback defaults can silently authenticate against an unintended or shared integration account if environment variables are missing. A sample file that looks copy-ready can also cause accidental credential reuse.

**Recommended action:** revoke/rotate any live values, remove all credential defaults from code, replace committed sample values with explicit placeholders, and make integration startup/configuration fail closed or report disabled when required settings are missing. Review git history for prior secret exposure.

**References:** [settings.py](backend/src/config/settings.py:105), [settings.py](backend/src/config/settings.py:157), [backend/.env.example](backend/.env.example:46)

### F-02 — Frontend production build can call localhost for the API

**Severity: High**  

The API client falls back to `http://127.0.0.1:8000/api/v1` when `VITE_API_BASE_URL` is absent. The frontend Dockerfile has no build argument or build-time validation for that variable, and `.dockerignore` excludes `.env`. Unless the deployment injects `VITE_API_BASE_URL` into the image build, browser requests from a deployed user's machine target that user's own loopback interface and fail.

There are also independent ad hoc fetch paths in the same API client with their own `localhost:8000` defaults, so fixing only the shared constant will not cover all endpoints.

**Impact:** login and normal API-backed functionality can fail after a successful frontend container deployment; some specific upload/export paths may fail differently from calls routed through the shared request helper.

**Recommended action:** use a same-origin relative `/api/v1` default when a reverse proxy is expected, or require a validated build-time API URL. Remove per-endpoint URL fallbacks and route all requests through the shared URL builder.

**References:** [api-client.ts](frontend/src/lib/api-client.ts:9), [api-client.ts](frontend/src/lib/api-client.ts:5423), [frontend/Dockerfile](frontend/Dockerfile:1), [frontend/.dockerignore](frontend/.dockerignore:1)

### F-03 — WhatsApp gateway default webhook points back to itself

**Severity: High**  

`backend/whatsapp_gateway/index.js` defaults the FastAPI webhook to `http://localhost:8000/...`. In a container, `localhost` names the gateway container, not the separate backend container. Unless `FASTAPI_WEBHOOK_URL` is explicitly set to a routable backend service name/address, inbound WhatsApp events cannot reach the application webhook.

**Impact:** WhatsApp session management may appear connected while inbound message/automation processing silently fails or logs request errors.

**Recommended action:** make the webhook URL required in deployed environments; provide the correct service DNS name in the deployment configuration; add startup validation and a health/readiness check that verifies backend reachability.

**Reference:** [index.js](backend/whatsapp_gateway/index.js:42)

### F-04 — CORS policy permits every origin with credentialed requests

**Severity: High**  

The FastAPI app configures `allow_origins=["*"]` and `allow_credentials=True`, bypassing the `CORS_ORIGINS` setting defined in `settings.py`. Starlette's response behavior may reflect origins for credentialed requests, but the policy still allows arbitrary sites to make credentialed cross-origin calls where browser cookie/auth semantics permit it. This is broader than the configured allowlist and increases CSRF/data-exposure risk.

**Recommended action:** use `settings.cors_origin_list`, keep allowed origins explicit per environment, and review cookie `SameSite`, CSRF protection, and token storage together.

**Reference:** [main.py](backend/src/main.py:97)

### F-05 — POS routers are registered twice at the same prefixes

**Severity: Medium**  

Products, sessions, and transactions routers are included once in the first POS block and again later with the same `/pos` prefix. This produces duplicate route entries and can create ambiguous OpenAPI operation IDs, duplicate documentation, and brittle route-order behavior. The repeated includes appear accidental; the later block adds tags but the earlier includes are untagged.

**Recommended action:** keep one registration per router and apply tags there; inspect generated route/OpenAPI output after consolidation.

**Reference:** [router.py](backend/src/api/v1/router.py:85), [router.py](backend/src/api/v1/router.py:111)

### F-06 — Database failure is reported as a healthy service

**Severity: High**  

Startup catches database-health and schema-initialization exceptions and continues to serve requests. The `/health` endpoint always returns `{"status":"ok"}` without checking database connectivity or degraded state. An unavailable database can therefore produce a green health check while API requests fail.

**Recommended action:** separate liveness from readiness; readiness should verify the database and any required dependencies, return a non-2xx status when unavailable, and include a sanitized degraded-state signal.

**References:** [main.py](backend/src/main.py:44), [main.py](backend/src/main.py:268)

### F-07 — Schema migration work runs inside every app startup

**Severity: High**  

`init_database()` runs a large list of direct PostgreSQL DDL statements during startup, individually swallowing failures at debug level. It also invokes barcode repair and attempts a table reindex. This is an unversioned migration mechanism, runs from each application replica, and mixes schema repair/data mutation with API boot. `AUTO_CREATE_TABLES=false` disables `create_all` only; it does not disable the subsequent DDL list.

**Impact:** deploys can race when multiple replicas start, DDL changes can be missed without an operator noticing, and production startup can unexpectedly mutate or reindex data. A failed statement may leave the application running on a partially upgraded schema.

**Recommended action:** move schema changes into versioned Alembic migrations and a single deploy step; fail deployment on migration errors; remove automatic data repair/reindex from web-process startup or make it an explicit maintenance operation.

**References:** [init_db.py](backend/src/database/init_db.py:144), [init_db.py](backend/src/database/init_db.py:690), [main.py](backend/src/main.py:49)

### F-08 — Manual database seed script can create a predictable tenant administrator

**Severity: Critical if run against a reachable production database; otherwise dormant code**  

`backend/seed_db.py` explicitly invokes `bootstrap_defaults()`. When no tenant exists and `SEED_DEFAULT_PERMISSIONS` is true, that routine creates a tenant owner with a hard-coded, predictable password and logs the credentials. Normal `main.py` startup does not call `bootstrap_defaults()` based on the inspected call graph, so this is not an automatic fresh-start backdoor. However, running the convenient seed script against production would establish a privileged known account.

**Recommended action:** remove privileged default-user creation from seed routines; require an explicit one-time admin bootstrap flow that generates a random credential and forces reset; refuse to run demo seeding when `APP_ENV=production`; remove credential logging.

**References:** [seed_db.py](backend/seed_db.py:4), [init_db.py](backend/src/database/init_db.py:780), [init_db.py](backend/src/database/init_db.py:803)

### F-09 — POS contains a second, partial backend subtree with unclear deployment ownership

**Severity: Medium / architecture follow-up**  

`POS/backend/src/api/v1/` contains separate POS and barcode route files, but this subtree has no backend application entry point, dependency manifest, Dockerfile, or visible registration in the root backend. The root FastAPI app independently implements and registers POS routes. The frontend POS client imports the root `api-client` module. It is therefore unclear whether `POS/backend` is an abandoned copy, a future service, or meant to be deployed independently.

**Impact:** future fixes may land in an unserved copy, or duplicate API ownership may drift.

**Recommended action:** declare the source of truth in the architecture docs; either remove/archive the orphaned subtree or add the explicit runtime, deployment, and contract tests needed to make it a supported service.

**References:** [POS/backend/src/api/v1/pos/transactions.py](POS/backend/src/api/v1/pos/transactions.py), [router.py](backend/src/api/v1/router.py:85), [pos-api.ts](frontend/src/lib/pos-api.ts:1)

### F-10 — Demo POS fallback uses unrelated sample geography and currency

**Severity: Medium**  

The POS fallback module contains sample US store/customer/product data, USD pricing, and US-format contact details, while the backend and other configuration emphasize Indian GST and INR flows. If an API failure path renders fallback records in a real tenant workflow, it can mislead operators and potentially contaminate operational actions if fallback data is writable or selectable.

**Recommended action:** ensure fallback records are display-only and development-only; show an explicit offline/error state in production instead of substituting demo business records.

**Reference:** [pos-fallback.ts](frontend/src/lib/pos-fallback.ts:1)

### F-11 — Frontend has 322 non-localization TypeScript contract diagnostics

**Severity: High**  

The production Vite build succeeds because it transpiles without enforcing the TypeScript program's type checks. A separate `npx tsc --noEmit` run exits with errors. After excluding `i18n-context.tsx` diagnostics as requested, 322 diagnostics remain across 24 frontend files. The largest groups are `inventory/PrintTemplates.tsx` (143) and `hrms/PayslipTemplateStudio.tsx` (101); the remaining errors include client/server interface drift for company, warehouse, employee, invoice, GST, batch, barcode, and call-stat fields, plus invalid component props.

**Impact:** invalid component props and mismatched API contracts can render broken controls, discard intended filters/fields, or display incomplete data. The current production build does not catch these errors.

**Recommended action:** reconcile each failing call site against the actual backend response/schema, then make the build pipeline run `tsc --noEmit` before Vite bundling. Treat errors from the ignored i18n file separately from the 322 application diagnostics.

**Validation evidence:** `npx tsc --noEmit --pretty false`: exit 2; 1,755 diagnostics total, of which 322 were outside the ignored i18n file(s), spread across 24 non-i18n files.

### F-12 — Several live UI call sites pass the wrong modal props

**Severity: High**  

These are not merely type declaration gaps: callers omit required data/callbacks or use prop names the component does not read.

- `FullInvoicePrinter.tsx` renders `InvoiceQuickSettingsModal` with only `isOpen` and `onClose`, while the modal requires `settings` and `onSave`. Saving settings from this instance cannot work correctly.
- `PosProformaInvoices.tsx` calls `AiCallingModal` using `isOpen`, `leadId`, `leadName`, and `phoneNumber`, but the modal requires `open`, `targetType`, `contactName`, and related props. The call flow receives undefined target/contact state.
- `AiCallLogs.tsx` passes `isOpen` to `CallTranscriptModal`, which reads `open`; selecting a transcript does not open the modal.
- `ReceiptTemplates.tsx` supplies `value` to `RealBarcodeSvg`, whose public prop is `code`; the preview may render without barcode data.
- `QuickMartFooter.tsx` navigates to `/store/wallet` without the router-required `search` params, so the route link is rejected by the type checker and may fail when activated.

**Recommended action:** correct each caller/component contract and add focused interaction tests for settings save, AI call launch, transcript open, barcode preview, and wallet navigation.

**References:** [FullInvoicePrinter.tsx](frontend/src/components/pos/FullInvoicePrinter.tsx:2956), [InvoiceQuickSettingsModal.tsx](frontend/src/components/pos/InvoiceQuickSettingsModal.tsx:210), [PosProformaInvoices.tsx](frontend/src/components/pos/PosProformaInvoices.tsx:1072), [AiCallingModal.tsx](frontend/src/components/crm/AiCallingModal.tsx:20), [AiCallLogs.tsx](frontend/src/components/crm/AiCallLogs.tsx:592), [CallTranscriptModal.tsx](frontend/src/components/crm/CallTranscriptModal.tsx:33), [ReceiptTemplates.tsx](frontend/src/components/pos/ReceiptTemplates.tsx:3041), [QuickMartFooter.tsx](frontend/src/components/storefront/templates/speed_mart/QuickMartFooter.tsx:114)

### F-14 — Payment gateway secrets are returned by a broadly authenticated config endpoint

**Severity: Critical**  

`GET /payments/gateways/config` returns `saved.credentials` directly in the response, including configured `keySecret`, `secretKey`, and webhook credentials. The endpoint depends on `get_current_user_context` but does not call the available `require_permission()` helper. The same lack of endpoint-level permission checks appears on payment gateway config mutation, connection testing, and refund routes. Client-side navigation visibility does not protect the API.

**Impact:** any authenticated tenant user who can reach the endpoint can read payment provider secrets; users without finance/admin permission may also change gateway settings or initiate sensitive payment actions. Tenant filtering exists in the query, but it does not provide least-privilege within a tenant.

**Recommended action:** never return stored secrets after initial save; return a masked/present boolean and support secret rotation. Enforce server-side finance/admin permissions on configuration, test, refund, void, and settle actions, with audit events.

**References:** [payments.py](backend/src/api/v1/payments.py:246), [payments.py](backend/src/api/v1/payments.py:273), [payments.py](backend/src/api/v1/payments.py:287), [payments.py](backend/src/api/v1/payments.py:297), [payments.py](backend/src/api/v1/payments.py:641), [deps.py](backend/src/api/deps.py:203)

### F-15 — Razorpay webhook accepts payment-state updates when no secret is configured

**Severity: Critical**  

The webhook only verifies `X-Razorpay-Signature` when `RAZORPAY_WEBHOOK_SECRET` is truthy. With the setting absent (its default), the handler processes caller-supplied event JSON and can set a matching marketplace order and invoice to paid. The route has no other authentication or provider-source validation.

**Impact:** a forged request that identifies a known gateway order/payment can mark an order paid and commit the change, potentially releasing goods without payment.

**Recommended action:** reject webhooks when the secret is not configured; verify signatures unconditionally before parsing business events; use provider event IDs for replay idempotency; add tests for missing, invalid, duplicate, and valid signatures.

**References:** [payments.py](backend/src/api/v1/payments.py:666), [payments.py](backend/src/api/v1/payments.py:681), [payments.py](backend/src/api/v1/payments.py:773)

### F-16 — Razorpay verification reports a captured payment when provider lookup fails

**Severity: High**  

After checking the checkout HMAC signature, `/razorpay/verify` tries to fetch the payment status from Razorpay. If that provider call fails, it still returns `success: true` and defaults the status to `captured` even though the code has no captured-status evidence.

**Impact:** callers that treat this response as fulfillment authority can mark an order paid during provider outage or transient network failure.

**Recommended action:** return a pending/unverified result or a retryable error if the provider status cannot be fetched; only report captured after an authoritative captured/paid status is confirmed.

**References:** [payments.py](backend/src/api/v1/payments.py:422), [payments.py](backend/src/api/v1/payments.py:448), [payments.py](backend/src/api/v1/payments.py:460)

### F-13 — Frontend lint is overwhelmed by line-ending violations and broad unsafe typing

**Severity: Medium**  

`npm run lint` exits 1 with 320,615 reported problems (320,375 errors and 240 warnings), overwhelmingly Prettier CRLF/LF differences. Re-running ESLint with only the Prettier rule disabled still reports 4,717 errors and 237 warnings outside the ignored i18n file; prominent rules include `no-explicit-any`, empty blocks, and component-export Fast Refresh warnings. The default lint output is too noisy to identify newly introduced correctness issues.

**Recommended action:** align Prettier's `endOfLine` setting with the repository's Windows line endings (or normalize line endings in a dedicated change), then triage the remaining lint rules by correctness risk. Do not apply a mass formatter change during this audit.

## Expanded validation pass

| Check | Result | Scope / limit |
|---|---|---|
| Frontend production build | **Pass** | Vite transforms 3,709 client modules and 562 server modules. Build warns that several chunks exceed 500 kB, with application module chunks above 1 MB. Build does not run TypeScript checking. |
| Existing frontend Node tests | **Pass: 22/22** | Three storefront routing/theme suites only; this is not broad module or API integration coverage. |
| TypeScript check | **Fail** | 322 non-i18n diagnostics across 24 files; 1,433 further diagnostics are in the excluded i18n context. |
| ESLint | **Fail** | 320,375 errors dominated by line-ending formatting; with Prettier rule disabled, 4,717 errors and 237 warnings remain outside i18n. |
| Python compileall | **Pass** | Backend source, importer, WhatsApp gateway, tests, migration scripts, POS backend, frontend Python utilities, and the `/scripts` maintenance directory compiled without syntax errors. Root-level standalone Python utilities were not included. This does not resolve imports or exercise runtime dependencies. |
| Backend application import | **Blocked** | System Python fails at import because `authlib` is not installed. The checked-in backend `.venv` points to a Windows Store interpreter path that is absent. `Authlib` is declared in `backend/requirements.txt`. |
| Backend DB-backed tests | **Not run** | The test fixture defaults to `settings.async_database_url`; marketplace tests commit created tenants/products and have no teardown. Running them as configured could alter the app database. |
| Local frontend HTTP route probe | **Blocked by sandbox** | The built server started on a local port, but loopback HTTP requests were denied by the sandbox. No route response is claimed. |

## File-level coverage tracking


The repository inventory (excluding i18n/localization, lockfiles, generated outputs, and asset/data/cache directories) contains 853 tracked source/config files and roughly 384,700 physical lines. Project-wide build, type, lint, and syntax tools have now touched most frontend/backend source files, but these sweeps do not equal a semantic file-by-file integration review. A companion CSV, `APPLICATION_AUDIT_FILE_LEDGER.csv`, lists every in-scope file, its module, physical line count, executable-check status, and semantic-review status. The detailed review should proceed module by module, logging each source file's upstream/downstream contracts, connected tests, test result, and any unresolved dependencies. The current deep review has covered the app entry points, API router, shared API client, deployment configuration, POS/CRM modal call sites, startup database path, and integration service inventory; the remaining components and endpoints are still outstanding.

During the review, working-tree edits were present in `backend/src/api/v1/crm_modules/whatsapp_automation.py`, `backend/src/api/v1/inventory/alerts.py`, `backend/src/services/inventory_alert_service.py`, `backend/src/services/payment_reminder_engine.py`, `backend/src/services/quotation_sender.py`, `backend/src/services/whatsapp_invoice_sender.py`, `frontend/src/components/crm/WhatsappCampaigns.tsx`, and `frontend/src/components/pos/PosInvoicesHistory.tsx`. These files were preserved and not changed by this audit.

## Module and integration map

| Area | Primary implementation | Wiring observed | Audit status |
|---|---|---|---|
| Frontend app shell and navigation | `frontend/src/routes`, `frontend/src/components/layout`, `frontend/src/data/navigation.ts`, `modules-config.ts` | TanStack Start routes and `_app.*` module routes | Static route inventory reviewed; no browser walkthrough |
| Shared API/auth | `frontend/src/lib/api-client.ts`, `auth-context.tsx`, `rbac-context.tsx`, backend `auth.py`, `deps.py` | Shared client targets `/api/v1`; auth/RBAC have dedicated context and backend modules | URL configuration and individual fetch bypass risks found; token and permission behavior not end-to-end verified |
| ERP/accounting | `frontend/src/components/erp`, `accounting`; backend `api/v1/erp`, models/schemas | Mounted through central router; includes invoices, vouchers, bank, tax, assets, budgets, expense claims and reports | Wiring present; ledger/accounting invariants need database-backed workflow verification |
| HRMS | `frontend/src/components/hrms`; backend `api/v1/hrms`, employee and payroll services | Employee, attendance, leaves, payroll, recruitment, performance, learning, exit, travel, intelligence routers | Broad wiring present; payroll/legal rules and tenant permission matrix not runtime validated |
| CRM/social/communications | `frontend/src/components/crm`, `social`; backend `crm.py`, `crm_modules`, `social.py` | CRM subrouters and social router mounted centrally; Meta/Facebook services and WhatsApp automation present | External credentials, webhook delivery, rate limits and OAuth callbacks not verified |
| POS | `frontend/src/components/pos`, `lib/pos-api.ts`, `pos-fallback.ts`; backend `api/v1/pos` | Shared backend API is the active-looking path; duplicate root registrations; separate POS subtree exists | High duplication/ownership concern; fallback data concern |
| Inventory/warehouse/procurement | `frontend/src/components/inventory`, `procurement`; backend `api/v1/inventory`, `procurement.py` | Product master/catalog, stock operations, warehouse, barcode, alerts, procurement mounted | Broad wiring present; duplicate procurement router is mounted under both `/inventory` and `/erp` (may be intentional compatibility alias; document/verify) |
| Marketplace/storefront | frontend `components/storefront`, `marketplace`, `routes/store.*`; backend `storefront.py`, `marketplace/` | Storefront and marketplace routers mounted | Dedicated frontend rendering tests exist but were not run; checkout/payment and tenant isolation require integration verification |
| Payments | backend `payments.py`, `razorpay_service.py`, `pinelabs_service.py`; frontend API client/SDK helpers | Payment router mounted; providers depend on environment credentials | No live sandbox/production transaction or webhook signature verification performed |
| GST/e-invoice/e-way bill | backend `whitebooks_service.py`, `gst_lookup_service.py`, `erp/{gst_filing,einvoice,eway_bill,whitebooks_config}.py` | Routes mounted and settings expose provider configuration | Defaults target sandbox; credentials, GSTIN/tenant mapping, provider contract and retries unverified |
| Zoho Recruit | `backend/src/integrations/zoho/*`, recruitment UI | Zoho router is mounted centrally; OAuth/client/service/mapper/token-manager files present | Code path exists; callback, refresh token lifecycle and actual account scopes not verified |
| AI/copilot/RAG | frontend copilot, backend `copilot.py`, `rag_enricher.py`, Gemini/OpenAI/Anthropic settings | Copilot router mounted; RAG background service starts at app startup | Provider fallback/model availability, vector storage, and rate/error behavior not verified |
| Email, PDF, notifications | backend `utils/email.py`, `invoice_pdf.py`, quotation/WhatsApp senders, `notifications.py` | Notification and document routes/services present | SMTP and outbound delivery are environment-dependent; sample config secret concern; delivery receipts not verified |
| WhatsApp gateway | `backend/whatsapp_gateway/index.js`, Dockerfile, CRM automation webhook | Standalone Express service on port 8005 calls FastAPI webhook | Webhook default points to container-local address; session persistence and WhatsApp account behavior need deployed validation |
| Desktop wrapper | `desktop/main.js`, `desktop/package.json` | Electron loads hosted URL with localhost fallback | No embedded backend; fallback only helps if a separate frontend dev/server is running. Packaged offline behavior is not implemented |
| Importer | `backend/importer/*` | Separate importer package with its own requirements/config | Not traced to production trigger/scheduler; reconciliation/error retry semantics unverified |
| Secondary POS backend | `POS/backend/src/api/v1/*` | No application/deployment root found | Ownership unresolved; see F-09 |

## Cross-cutting loose ends

- **Configuration contract is fragmented.** Shared API calls, direct fetches, desktop defaults, and gateway defaults each have their own URLs. Centralize and validate them per runtime.
- **No single deployment manifest was identified in the reviewed root inventory.** Frontend, backend, desktop, and gateway Dockerfiles exist, but the intended service graph, persistent volumes, environment injection, readiness dependencies, and startup ordering are not documented in one deployable compose/manifest file in the inspected repository.
- **Alembic is a dependency but startup DDL is hand-maintained.** This creates two competing migration models and makes schema version state difficult to audit.
- **Background services start inside each FastAPI worker.** With multiple Uvicorn workers/replicas, periodic payment reminder scheduling and RAG enrichment may run more than once unless the service implementations use a distributed singleton/lock. This should be checked before horizontal scaling.
- **Top-level documentation is extensive but likely stale relative to current wiring.** Compare `ARCHITECTURE.md`, `BACKEND_DOCUMENTATION.md`, `FULL_MODULES_DOCUMENTATION.md`, and `BUSINESSOSAI_DOCUMENTATION.md` against the current route registration and deployed service graph.
- **A tracked change was already present** in `frontend/src/components/pos/PosInvoicesHistory.tsx`; it was not inspected or modified as part of this audit to avoid conflating existing work with review findings.

## Review boundaries and verification still needed

This pass traced the repository structure, runtime entry points, router aggregation, primary API URL construction, database startup/bootstrap behavior, Docker build inputs, and the available integration service modules. It did not review every statement in all 438 UI components or every handler in all 82 backend route files; the inventory above is module-level coverage with deeper tracing where the highest-risk cross-cutting breakpoints appeared.

No tests, lint, builds, database migrations, or external integrations were run. This avoids mutating the local database, changing generated artifacts, or relying on unavailable production credentials. The following checks are needed to close the remaining uncertainty:

1. Build the frontend with production deployment variables and verify the generated API target is not loopback.
2. Start backend plus database through the actual deployment topology and verify readiness failure behavior.
3. Compare FastAPI route/OpenAPI inventory for duplicate operation IDs and confirm `/inventory` and `/erp` procurement aliases are intentional.
4. Run isolated integration smoke tests against each configured sandbox: OAuth callbacks, GST/e-invoice/e-way bill, Razorpay/Pine Labs, WhatsApp inbound/outbound, SMTP, and AI provider fallback.
5. Exercise representative tenant-scoped workflows across POS → inventory → invoice/accounting, HRMS → payroll/payslip, and storefront → payment → order lifecycle.
6. Review secrets in git history and production secret manager; rotate anything that was ever valid.

