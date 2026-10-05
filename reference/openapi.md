---
title: API Reference (OpenAPI)
parent: Reference
nav_order: 1
---

# API Reference (OpenAPI)

Every Labs64.IO service is OpenAPI-first: the contract is the source of truth, server interfaces and models are generated from it, and its `x-labs64.auth` blocks generate the authorization policy and gateway routing (see [Shared libraries](../development/shared-libraries.md#authorization-from-the-openapi-contract)).

## Browse the APIs

With the `api-docs` chart installed, the gateway serves an aggregated Swagger UI at `/swagger-ui` (locally `http://gateway.localhost/swagger-ui`). Each service also serves its own document at `/<module>/v3/api-docs`.

## Contracts

| Service | Contract in the repository | Gateway prefix |
|---|---|---|
| [AuditFlow](../modules/auditflow/index.md) | `labs64.io-auditflow`: `auditflow-api/src/main/resources/openapi/openapi-audit-v1.yaml` | `/auditflow/api/v1` |
| [Payment Gateway](../modules/payment-gateway/index.md) | `labs64.io-payment-gateway`: `payment-gateway-api/src/main/resources/openapi/openapi-payment-gateway-v1.yaml` | `/payment-gateway/api/v1` |
| [Checkout](../modules/checkout/index.md) | `labs64.io-checkout`: `checkout-be/src/main/resources/openapi/openapi-checkout-v1.yaml` | `/checkout/api/v1` |

The Auth Gateway and Customer Portal have no business API.

Java models are published for two contracts: `io.labs64:auditflow-api` (models and a client) and `io.labs64:payment-gateway-api` (models), both compatible with Java 17.
