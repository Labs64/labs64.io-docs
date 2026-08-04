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
| [Commons](https://github.com/Labs64/labs64.io-commons) | Shared libraries and platform conventions |
| This documentation repository | Public onboarding, operating guidance, and reference documentation |

## Working across repositories

1. Start in the workspace when you need to run or change the ecosystem as a whole.
2. Work in the owning service repository for a service-specific change.
3. Update the API, event, Helm, and documentation contracts together when a behavior changes.
4. Keep secrets and environment-specific values out of public repositories.

For a first contribution, use the [Contributing Guide](./contributing.md).
