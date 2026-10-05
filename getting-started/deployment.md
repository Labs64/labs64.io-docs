---
title: Deployment Notes
nav_exclude: true
---

# Deployment

Labs64.IO is built for Kubernetes and ships with official Helm charts for every deployable module. This page outlines the deployment modes and considerations for taking the ecosystem to production.

## Deployment Modes

### 1. Local Development (k3d)
Used by developers and evaluators. The entire ecosystem is deployed to a lightweight local cluster.
- **Tooling:** `k3d`, `helmfile`, `just`
- **Use Case:** Validating API contracts, debugging module interactions.

### 2. Managed cloud services
Run the ecosystem on a managed Kubernetes service with managed data stores, for example EKS with RDS (PostgreSQL), ElastiCache (Valkey) and Amazon MQ (RabbitMQ), installed with the `labs64io-ecosystem` umbrella Helm chart.
- **Use Case:** High availability, secure, and scalable deployments.

### 3. Bring Your Own Infrastructure (BYO)
Labs64.IO is agnostic to the underlying cloud provider. As long as you provide a Kubernetes cluster, PostgreSQL, Redis (or Valkey), a RabbitMQ broker and an OIDC provider, the Helm charts work unchanged; see [Kubernetes & Helm setup](../operate-manage/kubernetes-helm-setup.md).

## Helm Chart Repository

All modules are published to the official Labs64.IO Helm repository.

```bash
helm repo add labs64io https://labs64.github.io/labs64.io-helm-charts
helm repo update
helm search repo labs64io
```

## Infrastructure Ownership

Modules in Labs64.IO follow a strict **database-per-service** pattern. 
- You must provision separate logical databases (or entirely separate instances) for modules that require persistence (e.g., Checkout, Payment Gateway).
- AuditFlow is a router and does not own a persistent store; it relies entirely on external sinks (e.g., OpenSearch, S3).

```mermaid
flowchart LR
    subgraph K8s Cluster
        CO[Checkout Pod]
        PG[Payment Gateway Pod]
    end
    
    subgraph Managed Services
        DB_CO[(Checkout DB)]
        DB_PG[(Payment Gateway DB)]
    end
    
    CO -->|Owned Connection| DB_CO
    PG -->|Owned Connection| DB_PG
    
    %% Invisible link to prevent crossover
    CO -.-x DB_PG
```

*Note: Services never cross-connect to another service's database.*
