# Customer Portal

## What it is

Customer Portal is the ecosystem's self-service portal for customers — today a Vue 3 single-page application only. `customer-portal-be/` exists in the repository as a stub (just a `justfile`); no backend has been implemented, so the portal has no server-side capability of its own.

## Status and version

- **Status:** alpha
- **Version:** no tagged release yet

Source of truth: [`_data/modules.yml`](https://github.com/Labs64/labs64.io-website/blob/master/_data/modules.yml) in `labs64.io-website`.

## What it owns

- The customer-facing SPA (`customer-portal-fe/`) — Vue 3 Composition API, Bootstrap 5 + Bootstrap Vue Next.
- Its own runtime configuration, injected via `env.json` mounted as a Kubernetes ConfigMap rather than a build-time environment variable.

It does **not** own any backend data or API today — `customer-portal-be/` is an unimplemented stub, not a working service.

## Quickstart

To run Customer Portal — standalone or as part of the ecosystem — start at **[labs64.io/get-started/](https://labs64.io/get-started/)**.

## API contract

Customer Portal has no backend and therefore no OpenAPI contract of its own. The frontend consumes other modules' APIs through the gateway; see those modules' own API contracts.

## Configuration

Chart values: [`charts/customer-portal/values.yaml`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/charts/customer-portal/values.yaml) in `labs64.io-helm-charts`.

Runtime configuration is set under `ui.application.runtimeEnv` — `enabled`, `strict` (fail the container rather than start with a missing/invalid config), the in-container `path` for `env.json`, and the `env` key/value map (e.g. `VITE_API_URL`) written into it. This is resolved at container start, not at image build time, so the same image runs unmodified across environments.

## Operations

- Repo: [`labs64.io-customer-portal`](https://github.com/Labs64/labs64.io-customer-portal) — read its `AGENTS.md` first.
- Image: `labs64/customer-portal-ui`, served by an unprivileged nginx container (UID 101).

## Known gaps

- Frontend only; the backend is not implemented.
- No tagged release yet.
