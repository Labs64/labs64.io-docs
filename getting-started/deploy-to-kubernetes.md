---
title: Deploy to Your Kubernetes Cluster
parent: Get Started
nav_order: 4
---

# Deploy to Your Kubernetes Cluster

Labs64.IO services are packaged as Helm charts so platform teams can manage them with their preferred Kubernetes and GitOps practices.

## Deployment sequence

```mermaid
flowchart LR
  A["Prepare cluster and namespaces"] --> B["Provide databases, broker, and secrets"]
  B --> C["Install gateway and policy services"]
  C --> D["Install selected Labs64.IO services"]
  D --> E["Configure routes, observability, and alerts"]
  E --> F["Run go-live checks"]
```

## Before you install

| Area | Required decision |
|---|---|
| Ingress | A Kubernetes Gateway/Ingress strategy and DNS names |
| Persistence | A database or schema per stateful service, with backups |
| Messaging | A reachable RabbitMQ broker for services that exchange events |
| Secrets | A secret-management approach for credentials, PSP keys, and identity configuration |
| Observability | Metrics, logs, and traces routed to your supported backend |
| Policy | A reviewed identity issuer, JWKS access, and authorization policy |

## Helm workflow

```bash
helm repo add labs64io https://labs64.github.io/labs64.io-helm-charts
helm repo update
helm search repo labs64io
```

Use environment-specific values files under source control, and pass credentials through secret references rather than committing them to a values file.

> **Before you go live:** validate TLS, backup and restore procedures, restrictive network policies, production identity issuers, webhook authenticity, and alert ownership. See [Security & Compliance](../operate-manage/security-compliance.md) and [Monitoring & Observability](../operate-manage/monitoring-observability.md).
