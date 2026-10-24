---
title: Helm Charts Reference
parent: Reference
nav_order: 5
---

# Helm Charts Reference

All Labs64.IO modules are deployed using Helm. Every module chart builds on the shared `chart-libs` library, so the charts share a standard set of root keys. Run `helm show values labs64io/<chart>` for the complete, documented list of one chart.

## Standard Chart Structure

| Value Key | Description | Default Type |
|-----------|-------------|--------------|
| `enabled` | Turns the module on or off in the umbrella chart. | boolean |
| `replicaCount` | Number of pods. | integer |
| `autoscaling.enabled`, `autoscaling.minReplicas`, `autoscaling.maxReplicas` | A HorizontalPodAutoscaler instead of a fixed replica count. | boolean, integer |
| `image.repository` | Docker image name. | string |
| `image.tag` | Docker image tag. Empty uses the chart's `appVersion`. | string |
| `image.digest` | Image digest (`sha256:` and 64 hex characters). Takes precedence over `image.tag`; the published charts set it. | string |
| `applicationYaml` | Spring application configuration of a Java service, mounted into the pod. | map |
| `env` | Extra environment variables of the container. | list |
| `envFrom` | Secrets or ConfigMaps to load as environment variables. | list |
| `secrets.data` | Secret values that the chart renders into a Kubernetes `Secret` when `externalSecrets.enabled` is `false`. | map |
| `externalSecrets.enabled`, `externalSecrets.storeName`, `externalSecrets.secretKey` | Read the secret through External Secrets Operator from a `ClusterSecretStore` instead. | boolean, string |
| `gateway.enabled` | Publish the module's routes on the shared Gateway. Off by default. | boolean |
| `gateway.prefix`, `gateway.routes`, `gateway.parentRefs` | Path prefix (`/<chart>` by default), routes, and the `Gateway` they attach to (`labs64io-gateway` in `tools`). | string, list |
| `gateway.ingressClassName`, `gateway.annotations` | The fallback `Ingress` on clusters without the Gateway API, for public routes only. | string, map |
| `networkPolicy.enabled` | Render the module's NetworkPolicy. Off by default. | boolean |
| `networkPolicy.extraEgress`, `networkPolicy.extraIngress` | Additional raw egress and ingress rules. | list |
| `observability.enabled`, `observability.otlpEndpoint` | Inject runtime instrumentation and the OTLP endpoint. | boolean, string |
| `resources`, `livenessProbe`, `readinessProbe`, `startupProbe`, `podDisruptionBudget` | Standard Kubernetes workload settings. | map |
| `global.domain` | Routes are served at `gateway.<global.domain>`. | string |
| `global.gateway.anyHost` | Match routes on any `Host` header, for clients that reach the gateway by IP address or by a load balancer's DNS name. | boolean |
| `global.postgresql.host`, `global.postgresql.port` | PostgreSQL address. A module chart on its own defaults to `postgresql.tools.svc.cluster.local:5432`. The umbrella chart points it at its bundled store. | string, integer |
| `global.rabbitmq.host`, `global.rabbitmq.port` | RabbitMQ address for AuditFlow. A module chart on its own defaults to `rabbitmq.tools.svc.cluster.local:5672`. The umbrella chart points it at its bundled store. | string, integer |
| `global.redis.host`, `global.redis.port` | Redis-compatible store address. A module chart on its own defaults to `redis.tools.svc.cluster.local:6379`. The umbrella chart points it at its bundled store. | string, integer |

The Payment Gateway and Checkout charts have `migrationJob`, a pre-install job that creates the database and runs the schema migrations, and `slo`, which adds SLO recording rules and alerts. AuditFlow has `tenants`, which publishes tenant documents as ConfigMaps, and `slo`. Checkout and the Customer Portal have `ui` for the UI image and its routes.

See [Kubernetes & Helm Setup](../operate-manage/kubernetes-helm-setup.md) for how the charts fit together, and each module's **Configuration** section for module-specific settings (e.g., [Checkout Configuration](../modules/checkout/index.md#configuration)).
