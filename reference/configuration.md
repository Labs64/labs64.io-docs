---
title: Configuration & Environment Variables
parent: Reference
nav_order: 3
---

# Ecosystem Configuration

While individual modules document their specific configuration properties, this page highlights shared ecosystem configurations that span multiple modules.

## Centralized Configurations

| Component | Shared By | Configuration Strategy |
|-----------|-----------|------------------------|
| **Credentials** | All services | Only from Kubernetes Secrets or environment variables. The charts render them from `secrets.data` or an `ExternalSecret`, never into a ConfigMap. |
| **Application settings** | Java services | Spring properties. With the charts, set them under `applicationYaml`; the chart mounts them and loads them through `SPRING_CONFIG_IMPORT`. |
| **Identity** | All services | Services do not validate tokens. They read the trusted `X-Auth-*` headers that the [Auth Gateway](../modules/auth-gateway/index.md) sets. |
| **Authorization** | AuditFlow, Payment Gateway, Checkout | Each service also asks the central Cerbos policy engine before it runs an operation, at `LABS64_AUTH_AUTHZ_PDPADDRESS` (gRPC). |
| **Databases** | Payment Gateway, Checkout | One database and one least-privilege login per service. AuditFlow has no database. |
| **Message broker** | AuditFlow | The only module with a broker dependency. `auditflow.broker.type`: `rabbitmq` (credentials injected via `SPRING_RABBITMQ_USERNAME` and `SPRING_RABBITMQ_PASSWORD`) or `sqs` (Amazon SQS, credentials from the pod's IAM role). See [Choose a message broker](../modules/auditflow/deployment/index.md#choose-a-message-broker). |
| **Observability (Tempo/Loki/Prometheus)** | All services | The charts inject runtime instrumentation and `OTEL_EXPORTER_OTLP_ENDPOINT` when `observability.enabled` is on. |

## Shared environment variables

| Variable | Description | Applicable to |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Selects the Spring Boot runtime profile. The charts do not set it. `local` is for gateway-less development only. | Java services |
| `LABS64_AUTH_AUTHZ_PDPADDRESS` | gRPC address of the Cerbos policy engine, `<release>-authz-pdp:3593` in a cluster. The default `localhost:3593` finds no engine in a cluster, so the service denies every request. | AuditFlow, Payment Gateway, Checkout |
| `LABS64_AUTH_AUTHZ_MODE` | `ENFORCE`, the services' default, answers a denied operation with `403` and also denies when the policy engine fails. `SHADOW` only records the decision and lets every operation through, so never use it in production. | AuditFlow, Payment Gateway, Checkout |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Points telemetry at the OpenTelemetry Collector. The charts set it from `observability.otlpEndpoint`. | Instrumented services |
| `JAVA_TOOL_OPTIONS` | Java runtime options. The charts set it, adding the OpenTelemetry Java agent when observability is enabled. | Java services |
| `AUDITFLOW_BROKER_TYPE` | Selects the message broker: `rabbitmq` (default) or `sqs`. | AuditFlow |
| `SPRING_RABBITMQ_HOST` | Addresses the configured RabbitMQ broker (`rabbitmq` only). | AuditFlow |
| `AWS_REGION` | Region of the SQS queues when `auditflow.broker.sqs.region` is empty; set by IRSA / EKS Pod Identity. | AuditFlow (`sqs`) |

Use Helm values to describe non-secret settings and Kubernetes Secret references for credentials. Module-specific variables remain documented on the relevant service page:

| Service | Settings |
|---|---|
| Auth Gateway | [`OIDC_*`, `CERBOS_URL`, `ROUTES_DIR` and more](../modules/auth-gateway/index.md#configuration) |
| AuditFlow | [Broker, redaction, promoted keys](../modules/auditflow/index.md#configuration); tenants and pipelines in [Configuring pipelines](../modules/auditflow/configuring-pipelines/index.md) |
| Payment Gateway | [Database, Redis, `AUDITFLOW_*`](../modules/payment-gateway/index.md#configuration) |
| Checkout | [Database, UI `env.json`](../modules/checkout/index.md#configuration) |
