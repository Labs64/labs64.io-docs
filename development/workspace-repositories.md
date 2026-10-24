---
title: Workspace and Source Repositories
parent: Community & Contributing
nav_order: 2
---

# Workspace and Source Repositories

Labs64.IO uses focused repositories so each service can evolve with the tooling and release cadence it needs. The workspace brings those repositories together for local development and ecosystem-level operations.

| Repository area | Purpose |
|---|---|
| [Workspace](https://github.com/Labs64/labs64.io-workspace) | Local orchestration, repository coordination, and shared developer workflow: the workspace `justfile`, the dev container, the reusable CI workflows and actions, the CLI tool versions and the shared Renovate preset |
| Service repositories | Source for deployable modules such as AuditFlow, Checkout, and Payment Gateway (see the table below) |
| [Helm charts](https://github.com/Labs64/labs64.io-helm-charts) | Kubernetes packaging and deployment configuration: the [Helm charts](../operate-manage/kubernetes-helm-setup.md), `install.sh`, the local Helmfile stack and the observability setup |
| [Tests](https://github.com/Labs64/labs64.io-tests) | Cross-module regression suite ([guide](./regression-tests.md)): its shared parts and its CI |
| [Commons](https://github.com/Labs64/labs64.io-commons) | Shared libraries and platform conventions ([guide](./shared-libraries.md)), and the build parent of every Java service |
| This documentation repository | Public onboarding, operating guidance, and reference documentation ([labs64.io-docs](https://github.com/Labs64/labs64.io-docs)) |
| [Website](https://github.com/Labs64/labs64.io) | The [labs64.io](https://labs64.io) website |

The service repositories:

| Repository | Contents |
|---|---|
| [labs64.io-authproxy](https://github.com/Labs64/labs64.io-authproxy) | The [Auth Gateway](../modules/auth-gateway/index.md) service `traefik-authproxy` |
| [labs64.io-auditflow](https://github.com/Labs64/labs64.io-auditflow) | [AuditFlow](../modules/auditflow/index.md): the backend, transformer and sink services, and the `auditflow-api` contract and Java client |
| [labs64.io-payment-gateway](https://github.com/Labs64/labs64.io-payment-gateway) | [Payment Gateway](../modules/payment-gateway/index.md): the backend, the provider SPI and one module per payment provider, and the `payment-gateway-api` contract |
| [labs64.io-checkout](https://github.com/Labs64/labs64.io-checkout) | [Checkout](../modules/checkout/index.md): the backend and the UI |
| [labs64.io-customer-portal](https://github.com/Labs64/labs64.io-customer-portal) | The [Customer Portal](../modules/customer-portal/index.md) UI |

[Releases and versions](./releases.md) lists what each repository publishes.

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

## Commands across repositories

Every workspace recipe finds the other repositories through `../`. Run these from `labs64.io-workspace`. `just --list` shows all of them with a description.

| Command | What it does |
|---|---|
| `just clone` | Clones every repository above that is not there yet |
| `just pull` | Pulls the current branch of every clone, with rebase and autostash. It skips a branch that has no upstream. |
| `just show-repos` | Shows `git status` for every clone |
| `just list-prs` | Lists the open pull requests of every clone, with the GitHub CLI |
| `just check-deps` | Checks that every Java module resolves its dependencies offline. It first installs `labs64.io-commons` and `auditflow-api` from your checkouts into the local Maven repository. |
| `just check` | Runs the cross-repository gates. They check that every released image reaches its chart, that a version pin written in two places has the same value in both, that every event that makes a Renovate update due starts the Renovate runner, and that every justfile follows the shared convention. |
| `just ci` | Runs what the workspace's CI runs: the tests of the gate scripts, the workflow lint and the cross-repository checks. It needs no cluster. |

[Run the full ecosystem locally](../getting-started/run-the-full-ecosystem-locally.md) lists the commands that build, deploy and test the local cluster.

## Working across repositories

1. Start in the workspace when you need to run or change the ecosystem as a whole.
2. Work in the owning service repository for a service-specific change.
3. Update the API, event, Helm, and documentation contracts together when a behavior changes.
4. Keep secrets and environment-specific values out of public repositories.

For a first contribution, use the [Contributing Guide](./contributing.md).
