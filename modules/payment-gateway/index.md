---
title: Payment Gateway
parent: Commerce & Billing
nav_order: 2
---

# Payment Gateway

## Overview
Payment Gateway puts one REST API in front of every payment provider (PSP). A shop, app or billing service creates a payment and pays it; Payment Gateway routes it to the tenant's configured provider, normalizes the result and keeps the call safe to retry. Stripe, PayPal and a NoOp test provider ship in the box, and a new provider is a new module behind the provider SPI.

## Capabilities

| Capability | Description |
|------------|-------------|
| **Provider abstraction** | One contract for Stripe, PayPal, NoOp and any provider you add through the SPI. |
| **Idempotent payments** | `POST /payments/{id}/pay` with an `Idempotency-Key` returns the original transaction on replay; it never charges twice. |
| **Per-tenant providers** | Each tenant enables providers and holds their credentials; one deployment serves many merchants. |
| **Webhooks and returns** | PSP webhooks and browser returns are handled per provider, and a terminal transaction is never overwritten by a late event. |
| **Recurring payments** | A payment can carry a recurrence rule (`DURATION` or `CRON`). |
| **Lifecycle events** | `payment.created`, `payment.finalized` and `payment.closed` can be published to AuditFlow. |

## Architecture

Payment Gateway sits behind the API Gateway, which authenticates the caller and passes the tenant and scopes as trusted headers. It stores payments in PostgreSQL, uses Redis for idempotency keys and calls the provider through the SPI.

```mermaid
sequenceDiagram
    autonumber
    participant C as Caller (shop, app, billing)
    participant PG as Payment Gateway
    participant PSP as Provider (Stripe, PayPal, NoOp)
    participant AF as AuditFlow

    C->>PG: POST /payments (paymentProviderId, purchaseOrder, billingInfo)
    PG-->>C: 201 Payment (READY)
    C->>PG: POST /payments/{id}/pay (Idempotency-Key)
    PG->>PSP: Provider call
    PSP-->>PG: Success, or a next action (redirect)
    PG-->>C: Payment (CLOSED) + PaymentTransaction (SUCCESS)
    PSP--)PG: Webhook: POST /providers/{provider}/webhooks
    PG--)AF: payment.* events (HTTP, as a service principal)
```

## Quick Start

The Payment Gateway is installed by the [Quickstart](../../getting-started/quickstart.md) and by the [full local ecosystem](../../getting-started/run-the-full-ecosystem-locally.md). With a token from either guide, list the providers configured for your tenant:

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:8000/payment-gateway/api/v1/payment-providers
```

To see a payment end to end without a cluster, run the published image with PostgreSQL and Valkey. Only Docker and Git are needed:

```bash
git clone https://github.com/Labs64/labs64.io-payment-gateway.git
cd labs64.io-payment-gateway
docker compose -f docker-compose.images.yml up -d
```

The [README](https://github.com/Labs64/labs64.io-payment-gateway#3-docker-on-your-machine) walks through enabling the NoOp provider, creating a payment and paying it twice with one `Idempotency-Key`. That stack runs without an API gateway and with authorization off: do not expose it.

## Configuration

### Service

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRING_PROFILES_ACTIVE` | `local` for a gateway-less run; the chart sets the production profile. | none |
| `DB_HOST`, `DB_PORT`, `DB_NAME` | PostgreSQL connection. | `localhost`, `5432`, `paymentgateway` |
| `DB_USERNAME`, `DB_PASSWORD` | PostgreSQL credentials. | `paymentgateway` (local profile only) |
| `REDIS_HOST`, `REDIS_PORT` | Redis-compatible store for idempotency keys. | `localhost`, `6379` |
| `LABS64_AUTH_AUTHZ_PDPADDRESS` | Central Cerbos policy engine (gRPC). | none |
| `AUDITFLOW_ENABLED` | Publish payment lifecycle events to AuditFlow. | `false` |
| `AUDITFLOW_URL` | AuditFlow base URL, when events are enabled. | none |

### Provider credentials

Provider credentials are **not** environment variables. They are part of the tenant's provider configuration, set through the API when the provider is created:

```json
POST /payment-providers
{
  "provider": "stripe",
  "active": true,
  "name": "Stripe",
  "config": { "apiKey": "sk_test_…", "webhookSecret": "whsec_…" }
}
```

`GET /payment-definitions` lists the supported provider identifiers. Webhook authenticity is verified with the provider's signature, using the secret stored in this configuration.

## REST APIs

All paths are relative to the service; behind the API Gateway they are served under `/payment-gateway/api/v1`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/payment-definitions` | `GET` | Supported providers (public). |
| `/payment-providers` | `GET`, `POST` | List or enable a provider for the tenant. |
| `/payment-providers/{id}` | `GET`, `PATCH`, `DELETE` | Read, update or remove a tenant provider. |
| `/payments` | `GET`, `POST` | List payments or create one (`READY`). |
| `/payments/{id}` | `GET` | Payment status and any pending next action. |
| `/payments/{id}/pay` | `POST` | Execute the payment. Send an `Idempotency-Key`. |
| `/payments/{id}/close` | `POST` | Close a payment. |
| `/payment-transactions` | `GET` | List transactions, filter by `paymentId`. |
| `/payment-transactions/{id}` | `GET` | One transaction. |
| `/providers/{provider}/webhooks` | `POST` | Ingress for a provider's webhooks (public, signature-verified). |
| `/providers/{provider}/checkout-sessions/{sessionId}/return` | `GET` | Browser return after an external checkout (public). |
| `/providers/{provider}/checkout-sessions/{sessionId}/cancel` | `GET` | Browser cancel after an external checkout (public). |
| `/checkout-sessions/{sessionId}/confirmation` | `GET` | Confirmation of a finished checkout session. |

Operations require scopes such as `payment-provider:read`, `payment-provider:write`, `payment:read`, `payment:write`, `payment:pay` and `payment-transaction:read`. The OpenAPI contract is the source of truth: [`openapi-payment-gateway-v1.yaml`](https://github.com/Labs64/labs64.io-payment-gateway/blob/master/payment-gateway-api/src/main/resources/openapi/openapi-payment-gateway-v1.yaml).

## Events

When `AUDITFLOW_ENABLED` is `true`, Payment Gateway publishes lifecycle events to [AuditFlow](../auditflow/index.md) over its HTTP API, as the `service:payment-gateway` principal. It has no message-broker dependency.

| Event Type | Description |
|------------|-------------|
| `payment.created` | A payment was created. |
| `payment.finalized` | A payment reached a final outcome. |
| `payment.closed` | A payment was closed. |

## Examples

### Paying an order

```bash
# 1. Enable the NoOp provider for the tenant
POST /payment-providers
{ "provider": "noop", "active": true }
# -> { "id": "<providerId>", ... }

# 2. Create a payment (201, status READY)
POST /payments
{
  "paymentProviderId": "<providerId>",
  "purchaseOrder": {
    "currency": "USD", "netAmount": 3000, "taxAmount": 0, "grossAmount": 3000,
    "items": [{ "name": "Widget Pro", "sku": "WIDGET-PRO", "price": 3000, "quantity": 1 }]
  },
  "billingInfo": { "firstName": "Jane", "lastName": "Doe", "email": "jane.doe@example.com",
                   "country": "US", "city": "San Francisco", "address1": "123 Market St", "postalCode": "94105" }
}

# 3. Pay it. Replaying with the same key returns the same transaction
POST /payments/{paymentId}/pay          Idempotency-Key: order-1001
# -> payment.status CLOSED, paymentTransaction.status SUCCESS
```

## Operations

Payment Gateway stores payments and transactions in PostgreSQL and idempotency keys in Redis; both are required. Because this module handles payment orchestration, restrict network egress to the providers you use (the chart's NetworkPolicy allows HTTPS only) and keep provider credentials in tenant configuration protected by your access controls.

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `401 Unauthorized` on every call | The trusted `X-Auth-*` headers are missing or invalid | Call through the API Gateway, or send `X-Auth-User`, `X-Auth-Tenant`, `X-Auth-Scopes` (comma-separated) and `X-Request-ID`. |
| `VALIDATION_ERROR` on `paymentProviderId` | The payment names no provider | Create the provider with `POST /payment-providers` first and pass its `id`. |
| `404` for `/api/v1/...` on a direct call | The `/api/v1` prefix is added by the gateway | Call `/payments` directly, or `/payment-gateway/api/v1/payments` through the gateway. |
| Payment fails with the provider | Wrong or missing provider credentials | Check the provider's `config` for the tenant; test with the NoOp provider first. |
| Webhook does not update state | The provider cannot reach the webhook URL or the signature does not match | Make `/providers/{provider}/webhooks` reachable by the provider and verify the webhook secret. |
