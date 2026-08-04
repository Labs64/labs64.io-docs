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
| **Database Credentials** | All backend modules | Provisioned per module, injected via K8s Secrets. |
| **RabbitMQ Connection** | AuditFlow, Checkout, Payment Gateway | Single broker, credentials injected via `SPRING_RABBITMQ_USERNAME` and `SPRING_RABBITMQ_PASSWORD`. |
| **Auth Gateway JWKS URL** | Auth Gateway, Checkout, Customer Portal | Standardized endpoint at `/auth/jwks` for token validation. |
| **Observability (Tempo/Loki/Prometheus)** | All modules | OTel endpoint injected globally via `OTEL_EXPORTER_OTLP_ENDPOINT`. |

## Shared environment variables

| Variable | Description | Applicable to |
|---|---|---|
| `SPRING_PROFILES_ACTIVE` | Selects the Spring Boot runtime profile. | Java services |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | Points telemetry at the OpenTelemetry Collector. | Instrumented services |
| `JAVA_TOOL_OPTIONS` | Supplies Java runtime options such as the telemetry agent. | Java services |
| `SPRING_RABBITMQ_HOST` | Addresses the configured RabbitMQ broker. | Event-producing or event-consuming services |

Use Helm values to describe non-secret settings and Kubernetes Secret references for credentials. Module-specific variables remain documented on the relevant service page.
