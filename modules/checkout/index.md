---
title: Checkout
parent: Commerce & Billing
nav_order: 3
---

# Checkout

## Overview
Checkout is a whitelabel order and checkout layer: an API for purchase orders, customers and checkout transactions, and a brandable Vue 3 checkout page. It validates the order (currency, tax, validity window, required consents) before it records the buyer's checkout transaction.

> **Current scope.** Checkout records the checkout transaction as `PENDING` and returns `nextAction: NONE`. It does not call the Payment Gateway yet, and it does not publish events yet.

## Capabilities

| Capability | Description |
|------------|-------------|
| **Purchase orders** | Items, currency, tax, an optional customer and an optional validity window (`startsAt`, `endsAt`). |
| **Customers** | Create, read and update customer records. |
| **Checkout transactions** | A transaction per checkout, with billing and shipping details, consents and the chosen payment method. |
| **Validation** | Currency, tax rate, time range, extras and required consents are checked before a transaction is created. |
| **Multi-tenant** | Tenant and scopes come from the trusted gateway headers; every query is tenant-scoped. |
| **Checkout page** | A Vue 3 UI configured at runtime through `env.json`, with i18n. |

## Architecture

Checkout sits behind the API Gateway. The API stores orders in PostgreSQL and asks the central policy engine (Cerbos) whether the caller may act on a resource.

```mermaid
sequenceDiagram
    autonumber
    participant B as Buyer / storefront
    participant GW as API Gateway
    participant CO as Checkout API
    participant DB as PostgreSQL

    B->>GW: POST /checkout/api/v1/purchase-orders
    GW->>CO: request + X-Auth-* headers
    CO->>DB: store order
    CO-->>B: 201 PurchaseOrder
    B->>GW: POST /purchase-orders/{id}/checkout
    GW->>CO: request + X-Auth-* headers
    CO->>CO: validate window and consents
    CO->>DB: store CheckoutTransaction (PENDING)
    CO-->>B: transaction + nextAction NONE
```

## Quick Start

Checkout is an optional module. Install the platform with the BYO profile of the [installer](../../getting-started/deploy-to-kubernetes.md) and answer **yes** to "Enable Checkout", or run it in the [full local ecosystem](../../getting-started/run-the-full-ecosystem-locally.md).

To try the API without a cluster, the repository ships a Compose file that runs the published image next to PostgreSQL and the policy engine; the [README](https://github.com/Labs64/labs64.io-checkout#3-docker-on-your-machine) shows the commands, including generating the authorization policies once inside a Maven container.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRING_DATASOURCE_URL` | PostgreSQL JDBC URL. | none |
| `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` | PostgreSQL credentials. | none |
| `SPRING_FLYWAY_ENABLED` | Apply database migrations at start. | `true` |
| `LABS64_AUTH_AUTHZ_PDPADDRESS` | Central Cerbos policy engine (gRPC), required because order access is checked against it. | none |

The checkout page reads `/config/env.json` at runtime. Mount your own to set the API address:

```json
{ "VITE_API_URL": "https://gateway.example.com/checkout/api/v1" }
```

## REST APIs

All paths are relative to the service; behind the API Gateway they are served under `/checkout/api/v1`.

| Endpoint | Method | Scope | Description |
|----------|--------|-------|-------------|
| `/customers` | `GET`, `POST` | `customer:read`, `customer:write` | List or create customers. |
| `/customers/{id}` | `GET`, `PATCH` | `customer:read`, `customer:write` | Read or update a customer. |
| `/purchase-orders` | `GET`, `POST` | `purchase-order:read`, `purchase-order:write` | List or create purchase orders. |
| `/purchase-orders/{id}` | `GET`, `PATCH` | `purchase-order:read`, `purchase-order:write` | Read or update a purchase order. |
| `/purchase-orders/{id}/checkout` | `POST` | `purchase-order:checkout` | Create the checkout transaction for an order. |
| `/checkout-transactions` | `GET` | `checkout-transaction:read` | List checkout transactions. |
| `/checkout-transactions/{id}` | `GET` | `checkout-transaction:read` | Read one transaction. |

The OpenAPI contract is the source of truth: [`openapi-checkout-v1.yaml`](https://github.com/Labs64/labs64.io-checkout/blob/master/checkout-be/src/main/resources/openapi/openapi-checkout-v1.yaml).

## Events

Checkout does not publish events yet. When it does, they will be delivered to AuditFlow over its HTTP API as a service principal, like the Payment Gateway's.

## Examples

### Creating an order and checking out

```json
POST /purchase-orders
{
  "currency": "USD",
  "items": [{ "name": "Widget Pro", "sku": "WIDGET-PRO", "quantity": 1, "price": 3000 }]
}

POST /purchase-orders/{id}/checkout
{
  "paymentMethod": "STRIPE",
  "consents": {},
  "extra": {},
  "billingInfo": { "firstName": "Jane", "lastName": "Doe", "email": "jane.doe@example.com",
                   "country": "US", "city": "San Francisco", "address1": "123 Market St", "postalCode": "94105" }
}
```

The response carries the `transaction` (status `PENDING`) and `nextAction` (`NONE`). Send `consents` and `extra` explicitly: leaving them out currently returns `500`.

## Operations

Checkout needs PostgreSQL for its state and a reachable Cerbos policy engine whose policies were generated from the same API contract version. Back up the database regularly and monitor connection pool metrics through Actuator.

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| The service exits at start with `QueryPlanner` missing | The policy engine is not configured | Set `LABS64_AUTH_AUTHZ_PDPADDRESS` and make Cerbos reachable; authorization cannot be switched off for this module. |
| `401 Unauthorized` on every call | Trusted `X-Auth-*` headers missing | Call through the API Gateway, or send `X-Auth-User`, `X-Auth-Tenant`, `X-Auth-Scopes` (comma-separated) and `X-Request-ID`. |
| `403` from Cerbos on a valid token | Policies do not match the running version | Regenerate the policies from the same checkout of the contract (`mvn package`) and reload the policy engine. |
| `500` on `/checkout` | `consents` or `extra` omitted | Send both, using `{}` when there is nothing to record. |
