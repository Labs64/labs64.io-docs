---
title: Workspace and Source Repositories
parent: Community & Contributing
nav_order: 2
---

# Workspace and Source Repositories

Labs64.IO uses focused repositories so each service can evolve with the tooling and release cadence it needs. The [workspace](./contributing.md#set-up-the-workspace) clones them side by side for local development.

## Services

| Repository | Contents |
|---|---|
| [labs64.io-authproxy](https://github.com/Labs64/labs64.io-authproxy) | [Auth Gateway](../modules/auth-gateway/index.md): `traefik-authproxy` |
| [labs64.io-auditflow](https://github.com/Labs64/labs64.io-auditflow) | [AuditFlow](../modules/auditflow/index.md): backend, transformer and sink services, the `auditflow-api` contract |
| [labs64.io-payment-gateway](https://github.com/Labs64/labs64.io-payment-gateway) | [Payment Gateway](../modules/payment-gateway/index.md): backend, provider SPI and PSP modules, the `payment-gateway-api` contract |
| [labs64.io-checkout](https://github.com/Labs64/labs64.io-checkout) | [Checkout](../modules/checkout/index.md): backend and UI |
| [labs64.io-customer-portal](https://github.com/Labs64/labs64.io-customer-portal) | [Customer Portal](../modules/customer-portal/index.md) UI |

## Platform

| Repository | Contents |
|---|---|
| [labs64.io-workspace](https://github.com/Labs64/labs64.io-workspace) | Workspace `justfile`, DevContainer, reusable CI workflows and actions, tool versions, the shared Renovate preset |
| [labs64.io-commons](https://github.com/Labs64/labs64.io-commons) | [Shared libraries](./shared-libraries.md) and the build parent of every Java service |
| [labs64.io-helm-charts](https://github.com/Labs64/labs64.io-helm-charts) | [Helm charts](../operate-manage/kubernetes-helm-setup.md), the local Helmfile stack and the observability setup |
| [labs64.io-tests](https://github.com/Labs64/labs64.io-tests) | The black-box [regression suite](./testing.md) |
| [labs64.io-docs](https://github.com/Labs64/labs64.io-docs) | This documentation |

## Working across repositories

1. Start in the workspace when you need to run or change the ecosystem as a whole.
2. Work in the owning repository for a service-specific change.
3. Update the API contract, Helm chart and documentation together when behaviour changes.
4. Keep secrets and environment-specific values out of every repository.
