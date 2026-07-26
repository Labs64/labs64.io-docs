# Checkout

## What it is

Checkout is the ecosystem's whitelabel checkout and order workflow: a Vue 3 frontend and a Spring Boot backend that take a buyer from a Purchase Order through payment initiation to a completed Checkout Transaction. It calls Payment Gateway to execute payments and publishes order events to RabbitMQ, which AuditFlow consumes.

## Status and version

- **Status:** alpha
- **Version:** no tagged release yet

Source of truth: [`_data/modules.yml`](https://github.com/Labs64/labs64.io-website/blob/master/_data/modules.yml) in `labs64.io-website`.

## What it owns

- Purchase Orders (PO) — items, prices, quantities, currency, and calculated totals; the source of truth for what the buyer is about to pay for.
- Checkout Transactions (CTX) — the financial object created when a buyer initiates payment, including billing/shipping info, selected payment method, and transaction status; read-only for clients once created.
- Consent tracking — validates that all PO-level consents marked `required` are accepted before checkout proceeds.
- Its own PostgreSQL database, scoped to Checkout's data only.
- Publishing order/checkout events to RabbitMQ for AuditFlow to consume.

### Detailed specification

For the full domain model, entity definitions, actors, and API proposal, see [`checkout-service-spec-en.md`](./checkout-service-spec-en.md) in this repo. That document is the detailed service specification; this page is the module's landing page.

## Quickstart

To run Checkout — standalone or as part of the ecosystem — start at **[labs64.io/get-started/](https://labs64.io/get-started/)**.

## API contract

- Canonical spec: [`checkout-be/src/main/resources/openapi/openapi-checkout-v1.yaml`](https://github.com/Labs64/labs64.io-checkout/blob/main/checkout-be/src/main/resources/openapi/openapi-checkout-v1.yaml) in `labs64.io-checkout`.
- Swagger UI: `:8080/swagger-ui.html` locally, or `gateway.localhost/checkout/v3/api-docs` through the gateway.

## Configuration

Chart values: [`charts/checkout/values.yaml`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/charts/checkout/values.yaml) in `labs64.io-helm-charts`.

Credentials are supplied as Secret-backed environment variables, never defaults — set via the chart's `secrets.data`, notably `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD` and `SPRING_RABBITMQ_USERNAME` / `SPRING_RABBITMQ_PASSWORD`. The frontend's runtime configuration is a mounted `env.json` ConfigMap rather than a build-time setting.

## Operations

- Repo: [`labs64.io-checkout`](https://github.com/Labs64/labs64.io-checkout) — read its `AGENTS.md` first.
- Database-per-service model: [`labs64.io-helm-charts/DATABASES.md`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/DATABASES.md).
- Observability is infrastructure-owned; see [`labs64.io-helm-charts/OBSERVABILITY.md`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/OBSERVABILITY.md).
- Images: `labs64/checkout` (backend), `labs64/checkout-ui` (frontend).

## Known gaps

- No tagged release yet.
- Known cross-tenant read gap under review.
