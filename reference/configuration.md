---
title: Configuration & Environment Variables
parent: Reference
nav_order: 3
---

# Configuration & Environment Variables

Each service documents its own settings on its page. This page lists the conventions they share.

## Conventions

| Topic | Convention |
|---|---|
| Credentials | Only from Kubernetes Secrets or environment variables; charts render them from `secrets.data` or an `ExternalSecret`, never into a ConfigMap. |
| Application settings | Java services take Spring properties; with the charts, set them under `applicationYaml`. |
| Identity | Services do not validate tokens; they read the trusted `X-Auth-*` headers set by the [Auth Gateway](../modules/auth-gateway/index.md). |
| Databases | One database and one least-privilege login per service. |
| Message broker | Only AuditFlow uses one (RabbitMQ). |
| Telemetry | Injected by the deployment when `observability.enabled` is on. |

## Shared environment variables

| Variable | Set by | Purpose |
|---|---|---|
| `OTEL_EXPORTER_OTLP_ENDPOINT` | The charts, when observability is enabled | Where services send traces, logs and metrics |
| `JAVA_TOOL_OPTIONS` | The charts | Java runtime options, including the OpenTelemetry Java agent |
| `SPRING_PROFILES_ACTIVE` | You | Spring Boot profile of a Java service |

## Service settings

| Service | Settings |
|---|---|
| Auth Gateway | [`OIDC_*`, `CERBOS_URL`, `ROUTES_DIR`, …](../modules/auth-gateway/index.md#configure) |
| AuditFlow | [Tenants, pipelines, redaction](../modules/auditflow/pipelines.md); RabbitMQ credentials as `RABBITMQ_USERNAME` and `RABBITMQ_PASSWORD` |
| Payment Gateway | [Payment definitions, `AUDITFLOW_*`](../modules/payment-gateway/index.md#configure) |
| Checkout | [Database, UI `env.json`](../modules/checkout/index.md#configure) |
