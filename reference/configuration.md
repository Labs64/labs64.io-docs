---
title: Configuration & environment variables
parent: Reference
nav_order: 3
---

# Configuration & environment variables

Each service documents its own settings on its page. This page lists the conventions they share.

## Conventions

| Topic | Convention |
|---|---|
| Credentials | Only from Kubernetes Secrets or environment variables. The charts render them from `secrets.data` or an `ExternalSecret`, never into a ConfigMap. |
| Application settings | Java services take Spring properties. With the charts, set them under `applicationYaml`. |
| Identity | Services do not validate tokens. They read the trusted `X-Auth-*` headers that the [Auth Gateway](../modules/auth-gateway/index.md) sets. |
| Databases | One database and one least-privilege login per service. |
| Message broker | Only AuditFlow uses one, RabbitMQ. |
| Telemetry | The deployment injects it when `observability.enabled` is on. |

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
| AuditFlow | [Tenants, pipelines, redaction](../modules/auditflow/pipelines.md). RabbitMQ credentials go in `RABBITMQ_USERNAME` and `RABBITMQ_PASSWORD`. |
| Payment Gateway | [Payment definitions, `AUDITFLOW_*`](../modules/payment-gateway/index.md#configure) |
| Checkout | [Database, UI `env.json`](../modules/checkout/index.md#configure) |
