---
title: Kubernetes & Helm Setup
parent: Operate & Manage
nav_order: 2
---

# Kubernetes & Helm Setup

Every Labs64.IO service ships as a Helm chart in the `labs64io` chart repository. Install one service on its own, or all of them with the `labs64io-ecosystem` umbrella chart. No chart bundles PostgreSQL, RabbitMQ or Redis as a dependency: you point each service at infrastructure you provide, or use the umbrella chart's optional bundled instances for evaluation.

```bash
helm repo add labs64io https://labs64.github.io/labs64.io-helm-charts
helm repo update
helm search repo labs64io
helm show values labs64io/<chart>
```

A typical cluster, as the local development stack and the umbrella chart lay it out:

![Cluster layout: Traefik, External Secrets Operator, PostgreSQL, Redis and RabbitMQ in namespace tools; the api-gateway, authz-pdp and the module charts in namespace labs64io; the OpenTelemetry Collector, Tempo, Loki, Prometheus and Grafana in namespace monitoring](./diagrams/cluster.svg)

Traefik routes requests to the modules after the api-gateway's ForwardAuth check; the modules use the data stores in `tools` and, with observability enabled, send telemetry to the collector in `monitoring`. Namespaces are configurable.

## Charts

| Chart | Purpose | Needs | Gateway routes |
|---|---|---|---|
| `auditflow` | [AuditFlow](../modules/auditflow/index.md) | RabbitMQ (AMQP 0-9-1); Redis for more than one replica | `/auditflow/api` (protected) |
| `payment-gateway` | [Payment Gateway](../modules/payment-gateway/index.md) | PostgreSQL (database `payment_gateway`), Redis | `/payment-gateway/api` (protected) |
| `checkout` | [Checkout](../modules/checkout/index.md) API and UI (`ui.enabled`) | PostgreSQL (database `checkout`) | `/checkout/api` (protected), `/checkout` UI (public) |
| `customer-portal` | [Customer Portal](../modules/customer-portal/index.md) UI | — | `/customer-portal` (public) |
| `api-gateway` | [Auth Gateway](../modules/auth-gateway/index.md) and the shared Traefik middlewares (auth, rate limit, buffering, compression) | An OIDC provider with the client-credentials grant | — |
| `authz-pdp` | Cerbos policy decision point | — | — |
| `api-docs` | Aggregated Swagger UI | — | `/swagger-ui` (public) |
| `preflight` | Checks your infrastructure before installing | — | — |
| `labs64io-ecosystem` | Umbrella chart: every module, optionally with bundled PostgreSQL, RabbitMQ and Redis | — | — |

Each module also serves its OpenAPI document publicly at `/<module>/v3/api-docs`. On first install a module's database login needs `CREATE DATABASE`.

## Deployment modes

| Mode | How | Configuration |
|---|---|---|
| **Evaluation** | `labs64io-ecosystem` with `values.demo.yaml` | Every module plus bundled infrastructure and a mock identity provider. Never for production. |
| **Local development** | `just up` in the workspace: a k3d cluster, Helmfile, locally built images | See [Run the full ecosystem locally](../getting-started/run-the-full-ecosystem-locally.md). |
| **Your own cluster** | Helm, Argo CD, Flux… with your PostgreSQL, broker, Redis and identity provider | Start from `overrides/<module>/values.prod-example.yaml` in the [helm-charts repository](https://github.com/Labs64/labs64.io-helm-charts) (not part of the published chart). |

```bash
helm pull labs64io/labs64io-ecosystem --untar
helm install labs64io labs64io/labs64io-ecosystem -f labs64io-ecosystem/values.demo.yaml
```

Turn modules off in the umbrella chart with `--set <module>.enabled=false`, and the bundled infrastructure with `postgresql.enabled`, `rabbitmq.enabled` and `redis.enabled`.

## Verify your infrastructure first

The `preflight` chart runs one check per dependency (broker TCP, PostgreSQL login, Redis `PING`, OIDC token grant) and succeeds only if all pass:

```bash
helm install preflight labs64io/preflight -n labs64io --create-namespace -f my-endpoints.yaml
kubectl wait --for=condition=complete job/preflight -n labs64io --timeout=120s \
  || kubectl logs job/preflight -n labs64io --all-containers
```

## Gateway API

Protected routes need the Kubernetes Gateway API with Traefik v3 and the `api-gateway` chart: it is the only path that strips inbound `X-Auth-*` headers and enforces authentication and authorization. Charts do not create the `Gateway` itself; every module's `gateway.parentRefs` points at `labs64io-gateway` in namespace `tools` by default. Until the Gateway API CRDs and that `Gateway` exist, routes render but are not accepted.

Minimal Traefik chart values that provide it:

```yaml
providers:
  kubernetesGateway:
    enabled: true
gatewayClass:
  enabled: true
gateway:
  enabled: true
  name: labs64io-gateway
  namespace: tools
  listeners:
    web:
      port: 8000
      protocol: HTTP
      namespacePolicy:
        from: All
```

```bash
helm install traefik traefik/traefik -n tools --create-namespace -f traefik-values.yaml
```

On a cluster without Gateway API CRDs, charts fall back to a plain `Ingress` for **public** routes only. A protected route has no Ingress equivalent, so the chart fails to render rather than expose it unprotected.

## Secrets

Every chart with secrets supports two modes through `externalSecrets.enabled`:

| Value | Result |
|---|---|
| `false` (default) | A plain Kubernetes `Secret` rendered from `secrets.data`; inject the values from your CI or secret tooling, never from a committed values file. |
| `true` | An `ExternalSecret` (`external-secrets.io/v1`) resolved by External Secrets Operator through your `ClusterSecretStore`: Vault, AWS Secrets Manager, GCP Secret Manager… |

Charts never put credentials in a ConfigMap.

## Network policies

Each module chart ships a NetworkPolicy that admits traffic from the ingress controller and named caller modules only, and restricts egress to its own dependencies. When your cluster differs from the defaults, set `networkPolicy.ingressControllerLabels` (for a non-Traefik ingress controller) and `networkPolicy.observabilityNamespace` (default `monitoring`). Add destinations a module needs beyond that, such as an AuditFlow sink on a non-443 port, with `networkPolicy.extraEgress`.

## Image pinning

Images default to the chart's `appVersion` tag. Neither Docker Hub nor GHCR can stop a tag from being moved, so in shared environments pin `image.digest` (`sha256:…`) for each module: the digest takes precedence over any tag.

## Observability

Set `observability.enabled` to inject runtime instrumentation and send traces, logs and metrics to an OpenTelemetry Collector; the image is the same either way. See [Monitoring and observability](./monitoring-observability.md).

See [Helm Charts Reference](../reference/helm-values.md) for shared value conventions and [Security & Compliance](./security-compliance.md) before going live.
