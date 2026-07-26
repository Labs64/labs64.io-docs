# Architecture

This is a reference companion to **[labs64.io/architecture/](https://labs64.io/architecture/)**, which has the diagram and the shorter public-facing version of this material. This page goes one level deeper and is consolidated from the `AGENTS.md` files across the ecosystem's repositories — it doesn't introduce anything those files don't already say.

## Mental model

Labs64.IO is a set of independent, polyglot services — Java/Spring Boot, Python/FastAPI, Vue — deployed from one shared Helm chart library, sitting behind one gateway and one auth plane. Every module boundary is an OpenAPI-first contract: the spec is written first, server and client code is generated from it, and other services depend on the contract, not the implementation. No module reaches into another module's process or database; everything crosses a boundary either as a REST call through the gateway or as an event on the message bus.

## The request path

Every request crosses the same edge before it reaches application code:

```
client → Traefik → traefik-authproxy (/auth, ForwardAuth) → Cerbos PDP → module
```

Traefik forwards every request to `traefik-authproxy` before routing it anywhere else. The authproxy verifies the OIDC/JWT token, then asks the central **Cerbos PDP** for the authorization decision — policy evaluation is centralized, not duplicated per module.

On success, the authproxy emits a trusted header contract that every upstream module relies on without re-validating it:

- `X-Auth-User`
- `X-Auth-Scopes`
- `X-Auth-Tenant`
- `X-Request-ID`

Routes that don't match a known policy **fail closed** — rejected, not silently allowed through.

## Module map

Five modules exist today. Each is a separate repository, ships independently, and communicates with the others only through REST calls across the gateway, or through events over RabbitMQ into AuditFlow.

| Module | Status | Version | What it owns |
|---|---|---|---|
| AuditFlow | beta | 0.0.3 | Publish once, route anywhere — audit event routing |
| Auth Gateway | beta | 0.0.2 | The authenticated edge for every module |
| Checkout | alpha | (none) | Whitelabel checkout and order workflow |
| Payment Gateway | alpha | (none) | One API across multiple PSPs |
| Customer Portal | alpha | (none) | Self-service portal for customers |

AuditFlow is the one exception to "REST through the gateway": it's reached only by consuming events published to RabbitMQ by the other modules, plus its own pipeline configuration. It does not expose a public write API that other modules call synchronously.

Invoicing (planned) and AI & MCP Gateway (exploring) have no repository yet and are not part of the module map above.

## Database-per-service

Each module owns its own logical database(s) — with one exception: **AuditFlow owns no persistent store of its own.** It is a router, not a system of record; its configured sinks own persistence, retention, and query. Audit events live wherever a tenant's pipeline sends them, not inside AuditFlow.

Everywhere a database does exist, credentials are never shared between services, and no module connects directly to another module's schema. If one module needs data another module owns, it asks across the gateway as a REST call, or reacts to an event — it never reaches into the other service's storage.

## Tenancy

AuditFlow's pipeline model is the reference implementation for tenant isolation across the ecosystem:

- Every pipeline belongs to exactly one tenant.
- An event is routed only through the pipeline set owned by that event's tenant — no global pipeline list, no fall-through to another tenant's pipelines.
- Events that arrive with no tenant context belong to a reserved `_platform` pseudo-tenant, so tenant-less traffic is still isolated rather than silently merged into a shared bucket.

## Observability

Observability is infrastructure-owned, not something each service builds for itself. Runtime auto-instrumentation — the OTel Java Agent for Java services, `opentelemetry-instrument` for Python services — attaches at deploy time and ships traces, logs, and metrics through an OTel Collector to Tempo (traces), Loki (logs), and Prometheus (metrics), visualized in Grafana. Java services additionally expose Micrometer metrics at `/actuator/prometheus`.

Services carry **no** OpenTelemetry SDK and do no instrumentation bootstrap of their own. The same container image runs with or without observability — it's toggled purely by deployment configuration (`observability.enabled` in Helm, the obs compose overlay), so instrumentation can never drift from the code it's watching. Business telemetry that a service does want to emit goes through that service's own thin `BusinessTelemetry` abstraction, not an SDK.

## Extension points available today

This is the complete list of ways to extend the platform without forking a module:

- **AuditFlow transformer plugins** — a `transformers/<name>.py` file implementing `transform(input_data: dict) -> dict`.
- **AuditFlow sink plugins** — a `sinks/<name>.py` file implementing `process(event_data: dict, properties: dict) -> dict`.
- **Runtime plugin mounts** — `transformers_bootstrap/` and `sinks_bootstrap/`, mounted via a ConfigMap volume so plugins can be added without rebuilding the image.
- **Payment Gateway PSP SPI** — a new Maven module under `payment-gateway-providers/<name>/` implementing `PaymentProvider`, and optionally `ProviderCheckoutSupport` and/or `ProviderWebhookSupport`.
- **Pipelines as configuration** — a per-tenant `tenants/<tenantId>.yaml` file, or a labelled ConfigMap, defines which sinks a tenant's events route through.
- **Pipeline condition operators** — the operators available for matching and routing events within a pipeline definition.
- **Helm values overlays** — on the published charts, for environment-specific configuration without patching the chart itself.

If it isn't on this list, it isn't available yet.

## Go deeper

- [labs64.io/architecture/](https://labs64.io/architecture/) — the diagram and platform-property pages (polyglot microservices, API-first, stateless scalability, zero-trust edge, federated identity, policy-as-code authorization, business telemetry)
- [`getting-started.md`](./getting-started.md) in this repo — building and testing a module
- Each module's own `AGENTS.md` in its repository — the most detailed and current source for that module's internals
