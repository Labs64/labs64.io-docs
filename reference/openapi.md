---
title: OpenAPI
parent: Reference
nav_order: 1
---

# OpenAPI Specifications

Every Labs64.IO module strictly follows an **OpenAPI-first** approach. The OpenAPI spec is the absolute source of truth; both server stubs and client libraries are generated directly from it.

## Accessing the APIs

When deploying the ecosystem locally via Kubernetes, all module APIs are aggregated and accessible via Swagger UI at the gateway:

- **Aggregated Docs:** `http://gateway.localhost/docs`

## Spec Locations

For deep integration or client generation, you can find the raw OpenAPI YAML files within each module's repository:

| Module | Spec Location in Repository |
|--------|-----------------------------|
| **AuditFlow** | `auditflow-api/src/main/resources/openapi/openapi-audit-v1.yaml` |
| **Auth Gateway** | N/A (Proxies upstream APIs) |
| **Checkout** | `checkout-be/src/main/resources/openapi/` |
| **Payment Gateway**| `payment-gateway-be/src/main/resources/openapi/` |
| **Customer Portal**| N/A (Frontend application) |
