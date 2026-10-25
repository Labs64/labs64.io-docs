---
title: API Reference (OpenAPI)
parent: Reference
nav_order: 1
---

# API Reference (OpenAPI)

Every Labs64.IO module with an API follows an **OpenAPI-first** approach. The OpenAPI contract is the source of truth: the build generates the server interfaces and models from it. The `x-labs64.auth` block of each operation also generates the gateway's routes manifest and the Cerbos authorization policies, so the [Auth Gateway](../modules/auth-gateway/index.md) enforces exactly what the contract declares.

## Accessing the APIs

With the `api-docs` chart installed, the gateway serves all module APIs in one Swagger UI:

- **Aggregated Docs:** `/swagger-ui` on the gateway, for example `http://localhost:8000/swagger-ui/` after the [Quickstart](../getting-started/quickstart.md), or `http://gateway.localhost/swagger-ui` on the local development cluster.

Each module also serves its own OpenAPI document publicly at `/<module>/v3/api-docs`, for example `/auditflow/v3/api-docs`.

## Spec Locations

For deep integration or client generation, you can find the raw OpenAPI YAML files within each module's repository:

| Module | Spec Location in Repository | Gateway prefix |
|--------|-----------------------------|----------------|
| **AuditFlow** | `labs64.io-auditflow`: `auditflow-api/src/main/resources/openapi/openapi-audit-v1.yaml` | `/auditflow/api/v1` |
| **Payment Gateway**| `labs64.io-payment-gateway`: `payment-gateway-api/src/main/resources/openapi/openapi-payment-gateway-v1.yaml` | `/payment-gateway/api/v1` |
| **Checkout** | `labs64.io-checkout`: `checkout-be/src/main/resources/openapi/openapi-checkout-v1.yaml` | `/checkout/api/v1` |
| **Auth Gateway** | N/A (Proxies upstream APIs) | |
| **Customer Portal**| N/A (Frontend application) | |

Each contract declares the server URL `/api/v1`; the gateway adds the module prefix and Traefik strips it again before the request reaches the service.

AuditFlow also publishes a Java client: `io.labs64:auditflow-api` contains the validated models and an HTTP client, compiled for Java 17. Every AuditFlow release publishes it to the Labs64 Nexus repository (`https://nexus.labs64.com/repository/labs64.io-releases/`).
