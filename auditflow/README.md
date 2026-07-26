# AuditFlow

## What it is

AuditFlow is the ecosystem's audit event router: services publish audit events over REST, AuditFlow queues them on RabbitMQ, and — for each tenant's configured pipelines — runs a transformer and then a sink to deliver the event to its destination. It is deliberately not a system of record: it has no database of its own. The sinks a tenant configures (OpenSearch, S3, Splunk, a relational database, and others) own persistence, retention, and query.

## Status and version

- **Status:** beta
- **Version:** 0.0.3

Source of truth: [`_data/modules.yml`](https://github.com/Labs64/labs64.io-website/blob/master/_data/modules.yml) in `labs64.io-website`.

## What it owns

- Ingestion of audit events via `POST /audit/publish` (direct, or `/auditflow/api/v1/audit/publish` through the gateway).
- Routing: each event is matched against the pipeline set owned by its tenant and dispatched to a transformer, then a sink, over HTTP.
- Multi-tenant silo isolation — a pipeline belongs to exactly one tenant; tenant-less events fall into a reserved `_platform` pseudo-tenant. There is no global pipeline list and no fall-through between tenants.
- Delivery resilience: broker buffering, retry/circuit-breaker, and a tenant-scoped dead-letter queue (`/actuator/dlq/<tenantId>`, replayable).

It does **not** own persistence, retention, or query of audit event data — the configured sink does.

## Quickstart

To run AuditFlow — standalone or as part of the ecosystem — start at **[labs64.io/get-started/](https://labs64.io/get-started/)**.

## API contract

- Canonical spec: [`auditflow-api/src/main/resources/openapi/openapi-audit-v1.yaml`](https://github.com/Labs64/labs64.io-auditflow/blob/main/auditflow-api/src/main/resources/openapi/openapi-audit-v1.yaml) in `labs64.io-auditflow`.
- Swagger UI: `:8080/swagger-ui.html` on the backend service.

## Configuration

Chart values: [`charts/auditflow/values.yaml`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/charts/auditflow/values.yaml) in `labs64.io-helm-charts`.

Key settings (see the repo's own `AGENTS.md` for the complete list). These are Helm value paths, and they live under `applicationYaml` — a bare `--set tenants.source.mode=…` hits an unrelated chart-provisioning block (`tenants.platform.*` / `tenants.additional`, which ships the tenant ConfigMaps themselves) and silently does nothing:

- `applicationYaml.tenants.source.mode` — the chart ships `gitops-configmap` (ConfigMaps labelled `auditflow.io/tenant`); if you unset it entirely, the application's own built-in default is `local-dir` (per-tenant `tenants/<tenantId>.yaml` files polled from a mounted directory).
- `applicationYaml.tenants.ratelimit.backend` — the chart ships `redis` (correct once you run more than one replica); the application's own default is `in-memory` (single replica only).
- `applicationYaml.secretRef.resolver` — the chart ships `k8s-secret` (reads the tenant's own Secret `auditflow-tenant-<tenantId>-creds`); the application's own default is `env` (`AUDITFLOW_TENANT_<ID>_<KEY>`), for resolving `${secretRef:<key>}` sink credentials.
- `RABBITMQ_USERNAME` / `RABBITMQ_PASSWORD` — required, no defaults.

Additional configuration references kept in this repo:

- [Sink configuration reference](./sink-configuration.md) — worked examples for every sink type.
- [AWS CloudWatch setup](./aws-cloudwatch-setup.md).

## Extension points

- **Transformer plugins** — drop `transformers/<name>.py` implementing `transform(input_data: dict) -> dict`.
- **Sink plugins** — drop `sinks/<name>.py` implementing `process(event_data: dict, properties: dict) -> dict`.
- **Runtime plugin mounts** — `transformers_bootstrap/` / `sinks_bootstrap/`, mounted via a ConfigMap volume so plugins can be added without rebuilding the image.
- **Pipelines as configuration** — a per-tenant `tenants/<tenantId>.yaml` file, or a labelled ConfigMap, defines which sinks a tenant's events route through.
- **Pipeline condition operators** — the operators available for matching and routing events within a pipeline definition (`eq`, `neq`, `contains`, `startsWith`, `endsWith`, `in`, `notIn`, `exists`, `notExists`, `regex`, `gt`, `gte`, `lt`, `lte`, `eqIgnoreCase`).

## Operations

- Repo: [`labs64.io-auditflow`](https://github.com/Labs64/labs64.io-auditflow) — read its `AGENTS.md` first.
- Observability is infrastructure-owned; see [`labs64.io-helm-charts/OBSERVABILITY.md`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/OBSERVABILITY.md).
- Database-per-service model and AuditFlow's no-database exception: [`labs64.io-helm-charts/DATABASES.md`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/DATABASES.md).
- Tenant-scoped DLQ: `/actuator/dlq/<tenantId>` (inspect and replay).

## Known gaps

- v1 API contract is not yet frozen.
