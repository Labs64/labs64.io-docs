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

All `just` recipes run from `labs64.io-workspace/`. The other repositories are mounted as modules, so `just helm-charts <recipe>` and `just tests <recipe>` run in those repositories without a `cd`. The workspace's [`docs/reference.md`](https://github.com/Labs64/labs64.io-workspace/blob/master/docs/reference.md) lists every command (versions, releases, dependency updates) and [`docs/justfiles.md`](https://github.com/Labs64/labs64.io-workspace/blob/master/docs/justfiles.md) explains how every justfile is organised.

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

## Working across repositories

1. Start in the workspace when you need to run or change the ecosystem as a whole.
2. Work in the owning service repository for a service-specific change.
3. Update the API, event, Helm, and documentation contracts together when a behavior changes.
4. Keep secrets and environment-specific values out of public repositories.

For a first contribution, use the [Contributing Guide](./contributing.md).
