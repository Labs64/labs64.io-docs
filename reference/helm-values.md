---
title: Helm Charts Reference
parent: Reference
nav_order: 5
---

# Helm Charts Reference

All module charts are built on the shared `chart-libs` library, so they share these values. Run `helm show values labs64io/<chart>` for the complete, documented list of a chart.

| Value | Purpose |
|---|---|
| `enabled` | Turn the module on or off (used by the umbrella chart) |
| `replicaCount`, `autoscaling` | Fixed replicas, or a HorizontalPodAutoscaler |
| `image.repository`, `image.tag`, `image.digest` | The image; `digest` (`sha256:…`) wins over any tag |
| `applicationYaml` | Spring application configuration of a Java service |
| `env`, `envFrom` | Extra environment variables |
| `secrets.data` | Secret values rendered into a Kubernetes `Secret` (when `externalSecrets.enabled` is `false`) |
| `externalSecrets.enabled`, `externalSecrets.secretKey` | Resolve the secret through External Secrets Operator instead |
| `gateway.enabled`, `gateway.routes`, `gateway.parentRefs` | Gateway API routes of the module and the `Gateway` they attach to |
| `networkPolicy` | The module's NetworkPolicy; `extraEgress` adds destinations |
| `observability.enabled` | Inject runtime instrumentation and the OTLP endpoint |
| `resources`, probes, `podDisruptionBudget` | Standard Kubernetes workload settings |

Charts with a database also have `migrationJob` (schema migrations before the service starts); AuditFlow has `tenants` (tenant documents as ConfigMaps); Checkout and the Customer Portal have `ui`.

See [Kubernetes & Helm setup](../operate-manage/kubernetes-helm-setup.md) for installation.
