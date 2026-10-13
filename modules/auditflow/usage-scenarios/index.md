---
title: Usage scenarios
parent: AuditFlow
grand_parent: Core Platform
nav_order: 0
---

# Usage scenarios

The fastest way to tell whether AuditFlow fits is to find the situation closest to yours.

- [**Compliance audit trail**](#compliance-audit-trail-gdpr-soc-2-iso-27001-hipaa) — GDPR, SOC 2, ISO 27001, HIPAA
- [**Security event alerting**](#security-event-alerting-and-siem-integration) — route alerts to your SIEM in near real-time
- [**Multi-tenant SaaS audit logs**](#multi-tenant-saas-audit-logs) — a pipeline per tenant, isolated and throttled
- [**Centralised audit hub**](#centralised-audit-hub-across-microservices) — one pipeline serving many services
- [**Observability reference**](#microservices-observability-reference-implementation) — OpenTelemetry across a polyglot stack
- [**Developer sandbox**](#developer-sandbox-and-local-integration-testing) — run the whole thing locally in a minute

## Compliance audit trail (GDPR, SOC 2, ISO 27001, HIPAA)

You need a verifiable record of who did what and when, stored somewhere tamper-resistant and queryable during an audit. AuditFlow publishes events from your services via a single REST call, redacts PII or health data at ingest (before it ever hits the broker), and delivers clean audit records to OpenSearch for full-text search, S3/GCS/Azure Blob for long-term immutable archival, or both simultaneously via fan-out pipelines.

The event payload is yours to define — user identity, action, resource, outcome, timestamp — and the schema is enforced via OpenAPI. Each event carries a correlation ID for cross-service traceability.

**What to try in a POC:**
- Enable PII redaction on `extra.userId` / `extra.email`
- Create two pipelines: one to `opensearch_sink` (searchable), one to `aws_s3_sink` (archival)
- Verify that redacted fields are absent from both destinations

---

## Security event alerting and SIEM integration

Your services generate security-relevant events (login failures, privilege escalations, suspicious access patterns) mixed in with routine operational traffic. You need the security events routed to your SIEM or alerting channel in near real-time, without burdening the core service or slowing down routine calls.

Use a conditional pipeline with `eventType eq security.alert` (or a `regex` on your event schema). Only matching events reach your `splunk_sink`, `datadog_sink`, or `webhook_sink` alert handler. Routine events flow to a separate pipeline targeting cheaper storage. The circuit breaker and retry guard against SIEM downtime — events queue in the broker and replay automatically when the SIEM recovers.

**What to try in a POC:**
- Define two pipelines: `security-alerts` (condition: `eventType = security.alert`) → Splunk; `audit-archive` (no condition) → S3
- Send a mix of event types and confirm only security events reach Splunk
- Take the webhook endpoint offline briefly and confirm events are retried, not lost

---

## Multi-tenant SaaS audit logs

Your SaaS platform serves multiple tenants. Each tenant may have different audit data residency or delivery requirements — one wants logs in their own S3 bucket, another in their Splunk instance. AuditFlow is multi-tenant by construction (silo model): every tenant owns its own config — pipelines, quota, and credentials — and events route **only** through the pipeline set owned by the event's tenant. There is no global pipeline list and no cross-tenant fall-through; an event for an unknown or disabled tenant is rejected at ingest (`403 TENANT_NOT_PROVISIONED` / `TENANT_DISABLED`) or quarantined, never delivered to another tenant's sink. Onboarding a tenant means adding one YAML document (a `tenants/<tenantId>.yaml` file locally, or a labelled ConfigMap on Kubernetes) — no code change, no restart; the config is picked up live.

Per-tenant ingest rate limits (token bucket, `429` + `Retry-After`) and a per-tenant in-flight cap keep noisy tenants from affecting others. Sink credentials use `${secretRef:<key>}` indirection resolved from the tenant's own secret store at delivery time.

**What to try in a POC:**
- Drop two tenant files into `tenants/` (see `tenants/_platform.yaml` for the shape), each pointing at a different `webhook_sink` URL
- Publish events with each `tenantId` and confirm events for tenant A never appear in tenant B's stream
- Publish with an unknown `tenantId` and watch it get `403 TENANT_NOT_PROVISIONED` at ingest

---

## Centralised audit hub across microservices

You have many services — each currently solving audit logging ad hoc (some write to their own DB, some call a shared log API, some do nothing). You want a single, consistent audit pipeline without refactoring every service.

Each service publishes events to AuditFlow's REST endpoint. From there, one set of pipelines handles routing, transformation, and delivery for all of them. New services onboard by making one REST call — the pipeline logic stays in one place.

**What to try in a POC:**
- Stand up AuditFlow alongside two existing services
- Have each service publish events with a distinct `sourceSystem` field
- Use `sourceSystem`-based conditions to route each service's events to a different sink

---

## Microservices observability reference implementation

You're building or evaluating a microservices platform and want a reference that shows how to wire distributed tracing, structured logging, and metrics end-to-end across a polyglot stack (Java + Python). AuditFlow ships with a full OpenTelemetry observability stack: one Compose overlay brings up OTel Collector, Tempo (traces), Loki (logs), Prometheus (metrics), and a pre-wired Grafana dashboard.

Traces flow from the Java backend through the Python transformer and sink services. Log records carry trace IDs so clicking a trace in Grafana shows correlated logs in Loki. All three signal types are auto-configured — no hand-written OTel SDK beans, no manual appender wiring.

**What to try in a POC:**
- Start the stack with the observability overlay (`docker compose -f docker-compose.yml -f docker-compose-observability.yml up --build -d`) and open Grafana at http://localhost:3000
- Explore the AuditFlow Overview dashboard — click a trace, then follow it to its correlated logs

---

## Developer sandbox and local integration testing

You're building a service that publishes audit events and want to verify end-to-end behaviour locally without standing up a full production stack. The local stack (three services + RabbitMQ + Valkey + Cerbos + ClickHouse — the Kubernetes stack without the gateway) starts in under a minute. Tenant pipelines live in `tenants/`; redaction rules are configured via `JAVA_OPTS` in `docker-compose.yml`.

**What to try:**
- `docker compose up --build -d` starts the stack (build the backend jar first, see the [Quick Start](../index.md#quick-start))
- Walk through the step-by-step [Manual Verification (Smoke Test)](https://github.com/Labs64/labs64.io-auditflow/blob/master/DEVELOPERS.md#manual-verification-smoke-test) checklist — publish an event, confirm tenant isolation, confirm redaction, confirm the DLQ — each step with an expected result to check against

---
