---
title: Workspace and Source Repositories
parent: Community & Contributing
nav_order: 2
---

# Workspace and Source Repositories

Labs64.IO uses focused repositories so each service can evolve with the tooling and release cadence it needs. The workspace brings those repositories together for local development and ecosystem-level operations.

| Repository area | Purpose |
|---|---|
| [Workspace](https://github.com/Labs64/labs64.io-workspace) | Local orchestration, repository coordination, and shared developer workflow |
| Service repositories | Source for deployable modules such as AuditFlow, Checkout, and Payment Gateway |
| [Helm charts](https://github.com/Labs64/labs64.io-helm-charts) | Kubernetes packaging and deployment configuration |
| [Tests](https://github.com/Labs64/labs64.io-tests) | Cross-module regression suite ([guide](./regression-tests.md)) |
| [Commons](https://github.com/Labs64/labs64.io-commons) | Shared libraries and platform conventions ([guide](./shared-libraries.md)) |
| This documentation repository | Public onboarding, operating guidance, and reference documentation |

## Layout

After `just clone`, every repository sits next to the workspace. Open them all at once with **File ▸ Open Workspace from File…** and choose `labs64.io-workspace/labs64.io.code-workspace`: a multi-root workspace with one Source Control view per repository.

```text
<ecosystem-root>/
├── labs64.io-workspace/     # justfile, dev container, scripts
├── labs64.io-auditflow/
├── labs64.io-checkout/
├── labs64.io-helm-charts/
└── ...                      # the remaining ecosystem repositories
```

All `just` recipes run from `labs64.io-workspace/`. The other repositories are mounted as modules, so `just helm-charts <recipe>` and `just tests <recipe>` run in those repositories without a `cd`. The DevContainer mounts `<ecosystem-root>` at `/workspaces`, so the whole ecosystem is visible inside the container. Versions, releases and dependency updates are described [below](#-versions-releases--dependency-updates). [`docs/justfiles.md`](https://github.com/Labs64/labs64.io-workspace/blob/master/docs/justfiles.md) explains how every justfile is organised.

## 🛠️ Included Repositories

The workspace clones 10 repositories as siblings of itself — the runtime services plus the shared libraries, infrastructure, and docs that support them.

**Services**

| Repository | Description |
|------------|-------------|
| [**labs64.io-authproxy**](https://github.com/Labs64/labs64.io-authproxy) | The Auth Gateway: the authenticated edge for the ecosystem. It verifies OIDC/JWT tokens, matches the route and asks Cerbos before a request reaches a module. |
| [**labs64.io-auditflow**](https://github.com/Labs64/labs64.io-auditflow) | Multi-tenant Audit-as-a-Service platform for secure compliance logging. |
| [**labs64.io-payment-gateway**](https://github.com/Labs64/labs64.io-payment-gateway) | Subscription billing engine and Payment Service Provider (PSP) integrations. |
| [**labs64.io-checkout**](https://github.com/Labs64/labs64.io-checkout) | Core transaction processing and commerce workflow engine. |
| [**labs64.io-reporting**](https://github.com/Labs64/labs64.io-reporting) | Read-only reports over the events AuditFlow stored, per customer. |
| [**labs64.io-customer-portal**](https://github.com/Labs64/labs64.io-customer-portal) | Self-service SaaS management portal for end-users. |

**Shared libraries, infrastructure & docs**

| Repository | Description |
|------------|-------------|
| [**labs64.io-commons**](https://github.com/Labs64/labs64.io-commons) | Shared Java libraries (auth SDK, business telemetry, common utilities) consumed by the backend services. |
| [**labs64.io-helm-charts**](https://github.com/Labs64/labs64.io-helm-charts) | Kubernetes Helm charts (module charts + the `labs64io-ecosystem` umbrella), the local Helmfile stack, and the centralized observability stack. |
| [**labs64.io-tests**](https://github.com/Labs64/labs64.io-tests) | Black-box, contract-first API regression & integration test suite (Robot Framework). |
| [**labs64.io-docs**](https://github.com/Labs64/labs64.io-docs) | Public-facing product documentation and developer integration guides. |
| [**labs64.io**](https://github.com/Labs64/labs64.io) | Public marketing website (labs64.io). |

## How the workspace fits together

```
  ┌──────────────────────────────────────────────────────────────────┐
  │ labs64.io-workspace      justfile · dev container · scripts      │
  └───────┬──────────────────────────────────────────────────────────┘
          │ just clone                          │ just up
  ┌───────▼─────────────────────────────┐ ┌─────▼────────────────────────────┐
  │ ../ every ecosystem repository      │ │ builder container                │
  │ auditflow · checkout · helm-charts  │ │ builds first-party images        │
  │ payment-gateway · authproxy · …     │ └─────┬────────────────────────────┘
  └─────────────────────────────────────┘       │ push
                                          ┌─────▼────────────┐   ┌────────────┐
                                          │ k3d + registry   │──►│ platform   │
                                          │ (Docker)         │   │ gateway.   │
                                          └──────────────────┘   │ localhost  │
                                                                 └────────────┘
```

## 🔖 Versions, releases & dependency updates

Every version has exactly one owner; nothing below is restated anywhere else.

| What | Single source |
|------|---------------|
| CLI toolchain (helm, helmfile, k3d, terraform, …) for the dev container **and** CI | [`tool-versions.env`](https://github.com/Labs64/labs64.io-workspace/blob/master/tool-versions.env) — `just doctor` reports drift |
| Spring Boot line, BOM overrides, shared Java dependency/plugin versions, commons libraries | `io.labs64:labs64io-parent` in `labs64.io-commons` |
| Third-party Helm chart versions and repositories | `labs64.io-helm-charts/helmfile.yaml.gotmpl` |
| CRD sets applied outside Helm (Gateway API, Traefik CRDs) | `labs64.io-helm-charts/justfile.versions` |
| Dependency updates in all repositories | Renovate, shared preset [`default.json`](https://github.com/Labs64/labs64.io-workspace/blob/master/default.json) |

**Releasing** is the same gesture in every repository: publish a GitHub Release whose tag is the
version (`X.Y.Z`). No pom carries a version — the tag becomes the jar, the image tag and label,
and the chart `appVersion`; the module chart and the umbrella are bumped by an automated PR. The
published umbrella chart version is the ecosystem release; whoever operates an environment pins it. Release order when commons changed:
`commons` → modules pin the new `labs64io-parent` → module releases. See
[`.github/workflows/README.md`](https://github.com/Labs64/labs64.io-workspace/blob/master/.github/workflows/README.md) for the pipeline in detail.

## Working across repositories

1. Start in the workspace when you need to run or change the ecosystem as a whole.
2. Work in the owning service repository for a service-specific change.
3. Update the API, event, Helm, and documentation contracts together when a behavior changes.
4. Keep secrets and environment-specific values out of public repositories.

For a first contribution, use the [Contributing Guide](./contributing.md).
