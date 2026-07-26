# Auth Gateway

## What it is

Auth Gateway is the ecosystem's single authenticated edge: a Traefik ForwardAuth proxy that every inbound request passes through before it reaches a module. It verifies the caller's OIDC/JWT token (RS256, JWKS), asks the central Cerbos PDP for the authorization decision, and — on success — emits a trusted header contract that every upstream module relies on without re-validating it. Requests that don't match a known route fail closed (403).

## Status and version

- **Status:** beta
- **Version:** 0.0.2

Source of truth: [`_data/modules.yml`](https://github.com/Labs64/labs64.io-website/blob/master/_data/modules.yml) in `labs64.io-website`.

## What it owns

- The `/auth` ForwardAuth decision: token verification, scope extraction, and the Cerbos PDP call.
- Route policy matching — per-operation OpenAPI-template routes generated per module, plus static prefix policies for non-OpenAPI surfaces (UI bundles).
- The trusted header contract emitted on every 2xx response: `X-Auth-User`, `X-Auth-Scopes`, `X-Auth-Tenant`, `X-Request-ID`.
- Fail-closed behavior for any route it cannot match to a policy.

It does not own business logic, tenant data, or the authorization policy content itself — policy is authored per module (`x-labs64-auth` in each module's OpenAPI) and evaluated by the central Cerbos PDP.

## Quickstart

To run Auth Gateway — standalone or as part of the ecosystem — start at **[labs64.io/get-started/](https://labs64.io/get-started/)**.

## API contract

Auth Gateway is Traefik ForwardAuth middleware, not a business REST API consumed by other modules — it has no OpenAPI contract of its own. Its interactive docs (ReDoc + Swagger for the `/auth`, `/reload`, and health endpoints) are served locally at `:8081/docs`.

## Configuration

Chart values: [`charts/api-gateway/values.yaml`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/charts/api-gateway/values.yaml) in `labs64.io-helm-charts`.

Key environment variables (see the repo's own `AGENTS.md` for the complete list):

| Variable | Default | Purpose |
|---|---|---|
| `OIDC_URL` / `OIDC_DISCOVERY_URL` | — | OIDC provider discovery endpoint |
| `OIDC_AUDIENCE` | `account` | Expected JWT audience |
| `TOKEN_SCOPES_CLAIM_PATHS` | `scope,realm_access.roles,resource_access.{audience}.roles` | JWT claim paths for scopes |
| `TOKEN_TENANT_CLAIM_PATH` | `tenant` | JWT dot-path for the tenant claim (`X-Auth-Tenant`) |
| `CERBOS_URL` | `http://localhost:3592` | Central Cerbos PDP endpoint |
| `ROUTES_DIR` | `routes` | Directory of generated per-module route manifests |
| `STATIC_ROUTES_FILE` | `static_routes.yaml` | Static prefix policies for non-OpenAPI surfaces |
| `JWKS_CACHE_TTL` | `3600` | JWKS cache TTL, seconds |

## Operations

- Repo: [`labs64.io-authproxy`](https://github.com/Labs64/labs64.io-authproxy) — read its `AGENTS.md` first.
- Hot reload: `POST /reload` re-reads route manifests and static routes without a restart.
- Health: `GET /health` (liveness, also reports the PDP URL), `GET /health/ready` (readiness — 503 until at least one module's routes have loaded).
- Enforcement logging (summary + detail logger) is documented in the repo's `AGENTS.md`.

## Known gaps

None reported for Auth Gateway at this time.
