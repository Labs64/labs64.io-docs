# Payment Gateway

## What it is

Payment Gateway gives the ecosystem one API across multiple Payment Service Providers (PSPs). Checkout and other modules call it to list payment methods, create a payment, and execute it; Payment Gateway talks to the configured PSP behind a common abstraction, handles idempotent retries, and publishes payment lifecycle events for the rest of the ecosystem (including AuditFlow) to consume.

## Status and version

- **Status:** alpha
- **Version:** no tagged release yet

Source of truth: [`_data/modules.yml`](https://github.com/Labs64/labs64.io-website/blob/master/_data/modules.yml) in `labs64.io-website`.

## What it owns

- Payments and transactions: creation, state (`ACTIVE` / `INCOMPLETE` / `PAUSED` / `CLOSED` for payments; `PENDING` / `SUCCESS` / `FAILED` for transactions), and their PostgreSQL storage.
- The PSP abstraction layer (SPI) and the provider registry that resolves a payment method to a concrete provider.
- Idempotency and distributed locking for concurrent `/pay` requests, backed by Redis.
- Publishing `payment.created`, `payment.finalized`, and `payment.closed` domain events to RabbitMQ.
- PSP webhook receipt at `POST /webhooks/{provider}` and settlement of asynchronous transactions.

It does **not** own tenant identity — `tenantId` is taken from the JWT and used only as a scoping key; Payment Gateway never creates or manages a Tenant entity.

## Quickstart

To run Payment Gateway — standalone or as part of the ecosystem — start at **[labs64.io/get-started/](https://labs64.io/get-started/)**.

## API contract

- Canonical spec: [`payment-gateway-be/src/main/resources/openapi/openapi-payment-gateway.yaml`](https://github.com/Labs64/labs64.io-payment-gateway/blob/main/payment-gateway-be/src/main/resources/openapi/openapi-payment-gateway.yaml) in `labs64.io-payment-gateway`.
- Swagger UI: `http://localhost:8080/swagger-ui/index.html` locally, or `gateway.localhost/payment-gateway/v3/api-docs` through the gateway.

## Configuration

Chart values: [`charts/payment-gateway/values.yaml`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/charts/payment-gateway/values.yaml) in `labs64.io-helm-charts`.

Credentials are supplied as Secret-backed environment variables, never defaults — set via the chart's `secrets.data`, notably `SPRING_DATASOURCE_USERNAME` / `SPRING_DATASOURCE_PASSWORD`, `SPRING_RABBITMQ_USERNAME` / `SPRING_RABBITMQ_PASSWORD`, and `SPRING_DATA_REDIS_PASSWORD`. Payment method definitions (id, currencies, countries, recurring support) and retry behaviour are configured via the Spring Boot `application.yaml` baked into the image; tenant-specific PSP configuration lives in the database, scoped by `tenantId`.

For historical context on the target design (including provider scope beyond what ships today), see the [original module specification](./module-specification.md).

## Extension points

- **PSP SPI** — add a new Maven module under `payment-gateway-providers/<name>/` implementing `PaymentProvider`, and optionally `ProviderCheckoutSupport` and/or `ProviderWebhookSupport`. No changes to existing code are required. Providers shipping today: `NoopPaymentProvider` and `PaypalPaymentProvider`.

## Operations

- Repo: [`labs64.io-payment-gateway`](https://github.com/Labs64/labs64.io-payment-gateway) — read its `AGENTS.md` first.
- Database-per-service model: [`labs64.io-helm-charts/DATABASES.md`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/DATABASES.md).
- Observability is infrastructure-owned; see [`labs64.io-helm-charts/OBSERVABILITY.md`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/OBSERVABILITY.md). Java metrics via Micrometer at `/actuator/prometheus`.

## Known gaps

- **PSP webhook signature verification is incomplete — do not connect to live funds.**
- No tagged release yet.
- No frontend; `payment-gateway-fe` is a placeholder.
