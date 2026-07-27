---
title: Configuration
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
