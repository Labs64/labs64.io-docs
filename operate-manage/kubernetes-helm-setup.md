---
title: Kubernetes & Helm Setup
parent: Operate & Manage
nav_order: 2
---

# Kubernetes & Helm Setup

Use Helm charts to declare each selected service and its runtime dependencies. Keep chart values in version control, while sourcing secrets from your approved secret-management system.

## Environment shape

| Layer | Responsibility |
|---|---|
| Cluster | Schedules workloads, provides network isolation, and runs ingress/gateway components |
| Namespace | Separates platform services and environment concerns |
| Helm release | Declares one service's image, replicas, configuration, and references to secrets |
| Managed dependency | Provides PostgreSQL, RabbitMQ, object storage, or other external state |
| Observability backend | Receives metrics, logs, and traces |

## Install pattern

1. Create namespaces, image access, and network policies.
2. Provision dependency endpoints and create secret references.
3. Install the gateway and policy components.
4. Install selected services with environment-specific values.
5. Validate health checks, routing, telemetry, and backup jobs.

See [Helm Charts Reference](../reference/helm-values.md) for shared value conventions and [Deploy to your Kubernetes cluster](../getting-started/deploy-to-kubernetes.md) for the first-install checklist.
