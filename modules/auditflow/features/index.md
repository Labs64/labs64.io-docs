---
title: Features
parent: AuditFlow
grand_parent: Core Platform
nav_order: 1
---

# Features

Everything below ships in the box and works today. [Usage scenarios](../usage-scenarios/index.md) shows which of it you need for a given situation.

## Pipeline-as-configuration
Define where events go — and under what conditions — entirely in YAML or environment variables. Multiple pipelines evaluate independently for each event; one failing pipeline never stops the others. No backend code changes, no rebuilds, no restarts required to add or reroute a destination.

## Intelligent event routing
Route events selectively using rich field-level condition rules on any JSON field, including nested paths (`extra.userId`) and array indices (`items[0].name`). Combine rules with AND / OR logic and nest groups, e.g. "A and (B or C)". Supported operators: `eq`, `neq`, `eqIgnoreCase`, `contains`, `startsWith`, `endsWith`, `in`, `notIn`, `exists`, `notExists`, `regex`, `gt`, `gte`, `lt`, `lte`, `cidr`, `notCidr`, `wildcard`, `notWildcard` (IP ranges and glob patterns included). Unrelated traffic never reaches sinks that don't need it. A **dry run** shows which pipelines a sample event would reach and why, and fixture files test a tenant's pipelines before they are deployed.

## Asynchronous, decoupled processing
Every audit event is buffered on the message broker before processing. Your calling service gets an immediate acknowledgement and continues — the pipeline runs on a separate consumer thread. API latency stays flat under burst load, and the broker absorbs traffic spikes without back-pressure reaching upstream services.

## RabbitMQ or Amazon SQS, by configuration
The event backbone is a choice of configuration (`auditflow.broker.type`), with the same delivery guarantees on either:

- **RabbitMQ** (AMQP 0-9-1, 4.x): the in-cluster broker of the Helm chart, Amazon MQ for RabbitMQ, CloudAMQP or any other RabbitMQ service. AuditFlow relies on standard AMQP features only (publisher confirms, durable queues, per-queue TTL with dead-letter exchanges), so no broker plugin is required.
- **Amazon SQS**: no broker to run, size or patch; AuditFlow authenticates with its IAM role and creates each tenant's dead-letter queue on first use. SQS caps an event at about 1 MiB and keeps messages, dead-letter entries included, for at most 14 days.

Kafka is not supported: delayed redelivery and per-tenant dead-lettering would need a different design there. Details and the setup of each: [Choose a message broker](../deployment/index.md#choose-a-message-broker).

## Multi-destination fan-out
A single event can be delivered to multiple sinks simultaneously — log it to Loki, archive it to S3, and alert via webhook, all from one publish call. Each pipeline is independent: different conditions, different transformers, different destinations, evaluated in parallel.

## Rich sink catalogue
Deliver audit events without writing glue code. Destinations include: log output (for local dev), HTTP webhook, RFC 5424 syslog, Grafana Loki, OpenSearch / Elasticsearch, Amazon S3, Amazon CloudWatch Logs, Google Cloud Storage, Azure Blob Storage, Datadog Logs API, Splunk HEC, Snowflake, ClickHouse, PostgreSQL, and a licensing-platform integration. Sink properties (URLs, API keys, bucket names) are declared per-pipeline and resolved from environment variables — no credentials in configuration files.

## Transformer pipeline with chaining
Shape or enrich an event before delivery. Transformers are Python modules loaded dynamically at runtime. The built-in set covers pass-through, Loki-optimised labels, and OpenSearch indexing conventions. Chain multiple transformers in sequence within a single pipeline to compose richer transformations without coupling them together.

## PII and sensitive data redaction
Declare which fields to mask (`***`), hash or drop entirely. A hashed value is an HMAC-SHA256 under a secret key: equal values still give equal hashes, so events stay correlatable, but the value cannot be recovered by hashing guesses. Redaction runs at ingest — before the event is published to the broker — so sensitive values never reach the message broker, never appear in broker logs, and are never forwarded to any downstream sink. Rules are fine-grained, per field, with an independent action per rule.

## Idempotent event processing
Each event carries an `eventId`. The consumer checks a deduplication store before processing: duplicate deliveries from broker redelivery, network retries, or at-least-once producers are silently suppressed. Uses Redis (Valkey) for distributed dedup, in the local stack as in Kubernetes; an in-memory store is available for single-process runs without Redis. Claim TTL and completion TTL are independently configurable.

## Resilience and fault tolerance
- **End-to-end acknowledgement.** `/audit/publish` answers 200 only after the broker has confirmed it stored the event (RabbitMQ: publisher confirms, durable queue, persistent message; SQS: a successful `SendMessage`). If the broker cannot confirm, the client gets 503 and retries with the same `eventId`.
- **Per-pipeline delivery.** Each event becomes one delivery per matching pipeline, so a slow or failing destination never holds up the others or causes duplicates in them.
- **Retries over hours, per pipeline.** A failed delivery comes back after growing delays (5 s, 30 s, 2 min, 10 min, 30 min, 1 h, then every 3 h) until it succeeds, the pipeline's `retry.maxAttempts` is used up, or `retry.maxAge` (default 24 h) has passed. A ten-minute sink outage is ridden out without operator action.
- **Backpressure, not failure.** Throttling (pipeline rate limit, a tenant's in-flight cap, a full bulkhead) defers a delivery for a few seconds without spending an attempt.
- **Nothing silently dropped.** Exhausted, expired and poison deliveries (a 4xx or malformed transformer output) go to the **tenant's own DLQ**, one entry per failed pipeline with the reason and last error. `/actuator/dlq/<tenantId>` inspects (GET, counts by pipeline and reason), replays (POST, optionally one pipeline) or purges (DELETE, **irreversible**, optionally one pipeline).
- **Circuit breakers** and short in-call HTTP retries guard every transformer and sink call. **Graceful shutdown** drains in-flight work before the process exits.

## Tamper-evidence for the archive
The S3 sink stores an S3-verified SHA-256 with every object and, with `digest: "true"`, writes a signed (Ed25519), hash-chained digest record per object. An auditor with the public key can prove that no archived object was altered and no record removed, using [`verify_s3_digests.py`](https://github.com/Labs64/labs64.io-auditflow/blob/master/auditflow-sink/scripts/verify_s3_digests.py). Combine it with S3 Object Lock for a write-once archive.

## Batching
- **Batch publish:** `POST /audit/publish/batch` takes up to 100 events and answers with a result per event; one invalid or over-quota event never blocks the others.
- **Sink batching:** with `batch.enabled` a pipeline hands its sink up to `batch.maxSize` events in one call. Eleven sinks write the batch with one request to the destination: one object per partition folder (S3, GCS, Azure Blob), one multi-row insert (ClickHouse, Snowflake, PostgreSQL), one `_bulk` request (OpenSearch), one multi-record call (CloudWatch Logs, Datadog, Splunk HEC, Loki). The other sinks get the events of a batch a few at a time. Each event still gets its own outcome, so one refused event never fails the rest.

## Sink fallback routing
Designate a fallback sink per pipeline. If the primary sink returns a retryable error (network failure, timeout, 5xx), AuditFlow automatically routes the event to the fallback rather than the DLQ — keeping delivery continuity during planned maintenance windows or transient dependency outages.

## Secure plugin sandboxing
Transformer and sink module IDs are validated against an allow-list regex (`^[a-zA-Z0-9_]+$`) at the HTTP boundary, preventing path traversal and arbitrary module injection. Custom plugin directories (`sinks_bootstrap/`, `transformers_bootstrap/`) are separate from built-in modules and can be mounted at runtime via ConfigMap or volume without modifying the image. Each service exposes a `/registry` endpoint that lists all available modules with their version, description, and documented properties — also used as the Docker healthcheck.

## Full OpenTelemetry observability
Distributed traces (OTLP → Tempo), structured logs (OTLP → Loki), and metrics (Prometheus scrape + OTLP push) are wired end-to-end across all three services. A pre-provisioned Grafana dashboard surfaces request rate, error rate, recent traces, and live log streams out of the box — one command starts the full observability stack. Cross-signal linking is built in: clicking a trace in Tempo opens the correlated logs in Loki.

## Pluggable service discovery
Switch between `local` (a configured base URL) and `kubernetes` (fabric8 `KubernetesClient` resolves the Service ClusterIP at runtime) with a single property. No code paths change; only the discovery implementation is swapped. The same configuration file works identically in local Docker Compose and in a Kubernetes cluster.

## OpenAPI-first contract
The public API contract lives in a single YAML spec. Java models and the controller interface are generated at build time — generated sources are never committed and never hand-edited. Changing the API means editing the YAML. The Swagger UI ships with the backend for interactive exploration at `/swagger-ui.html`.

## v1 compatibility promise

[`openapi-audit-v1.yaml`](https://github.com/Labs64/labs64.io-auditflow/blob/master/auditflow-api/src/main/resources/openapi/openapi-audit-v1.yaml) is **frozen**: within v1, changes are additive-only. You can build against it once and upgrade AuditFlow without your integration breaking.

**What "additive-only" means in practice** — always allowed:
- New paths, operations, response status codes, schemas, properties, parameters, enum values.
- A previously-required property or parameter becoming optional.
- Documentation-only changes (descriptions, examples).

**Never allowed within v1** — any of these require a v2 spec instead:
- Removing a path, operation, response code, schema, or property.
- A previously-optional property or parameter becoming required.
- Changing a property's or parameter's declared type.
- Removing an enum value.

A breaking change to v1 is a bug, not a release. **CI enforces this mechanically**: every pull request diffs `openapi-audit-v1.yaml` against its version on the base branch and fails the build if anything above was removed or narrowed (`scripts/check_openapi_breaking_changes.py`, wired into `labs64io-ci.yml`'s `api-contract-freeze` job). A genuine breaking change needs a new spec file (`openapi-audit-v2.yaml`) and a new major version — never an edit to the frozen file.
