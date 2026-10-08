---
title: Kubernetes & Helm setup
parent: Operate & Manage
nav_order: 2
---

# Kubernetes & Helm setup

Every Labs64.IO service ships as a Helm chart in the `labs64io` chart repository. Install one service on its own, or all of them with the `labs64io-ecosystem` umbrella chart. No chart bundles PostgreSQL, RabbitMQ or Redis as a dependency. Point each service at infrastructure you provide, or use the umbrella chart's optional bundled instances for evaluation.

```bash
helm repo add labs64io https://labs64.github.io/labs64.io-helm-charts
helm repo update
helm search repo labs64io
helm show values labs64io/<chart>
```

The local development stack and the umbrella chart lay out a typical cluster like this:

![Cluster layout: Traefik, External Secrets Operator, PostgreSQL, Redis and RabbitMQ in namespace tools; the api-gateway, authz-pdp and the module charts in namespace labs64io; the OpenTelemetry Collector, Tempo, Loki, Prometheus and Grafana in namespace monitoring](./diagrams/cluster.svg)

Traefik routes requests to the modules after the ForwardAuth check of the api-gateway. The modules use the data stores in `tools`. With observability enabled, they send telemetry to the collector in `monitoring`. You can change the namespaces.

## Charts

| Chart | Purpose | Needs | Gateway routes |
|---|---|---|---|
| `auditflow` | [AuditFlow](../modules/auditflow/index.md) | RabbitMQ (AMQP 0-9-1); Redis for more than one replica | `/auditflow/api` (protected) |
| `payment-gateway` | [Payment Gateway](../modules/payment-gateway/index.md) | PostgreSQL (database `payment_gateway`), Redis | `/payment-gateway/api` (protected) |
| `checkout` | [Checkout](../modules/checkout/index.md) API and UI (`ui.enabled`) | PostgreSQL (database `checkout`) | `/checkout/api` (protected), `/checkout` UI (public) |
| `customer-portal` | [Customer Portal](../modules/customer-portal/index.md) UI | None | `/customer-portal` (public) |
| `api-gateway` | [Auth Gateway](../modules/auth-gateway/index.md) and the shared Traefik middlewares (auth, rate limit, buffering, compression) | An OIDC provider with the client-credentials grant | None |
| `authz-pdp` | Cerbos policy decision point | None | None |
| `api-docs` | Aggregated Swagger UI | None | `/swagger-ui` (public) |
| `preflight` | Checks your infrastructure before installing | None | None |
| `labs64io-ecosystem` | Umbrella chart: every module, optionally with bundled PostgreSQL, RabbitMQ and Redis | None | None |

Each module also serves its OpenAPI document publicly at `/<module>/v3/api-docs`. On first install, the database login of a module needs `CREATE DATABASE`.

## Deployment modes

| Mode | How | Configuration |
|---|---|---|
| Evaluation | `labs64io-ecosystem` with `values.demo.yaml` | Every module plus bundled infrastructure and a mock identity provider. Do not use it in production. |
| Local development | `just up` in the workspace, with a k3d cluster, Helmfile and locally built images | See [Run the full ecosystem locally](../getting-started/run-the-full-ecosystem-locally.md). |
| Your own cluster | Helm, Argo CD, Flux or similar, with your PostgreSQL, broker, Redis and identity provider | Start from `overrides/<module>/values.prod-example.yaml` in the [helm-charts repository](https://github.com/Labs64/labs64.io-helm-charts). The published chart does not include this file. |

```bash
helm pull labs64io/labs64io-ecosystem --untar
helm install labs64io labs64io/labs64io-ecosystem -f labs64io-ecosystem/values.demo.yaml
```

Turn modules off in the umbrella chart with `--set <module>.enabled=false`, and the bundled infrastructure with `postgresql.enabled`, `rabbitmq.enabled` and `redis.enabled`.

## Verify your infrastructure first

The `preflight` chart runs one check per dependency and succeeds only if all of them pass. It checks the broker over TCP, the PostgreSQL login, Redis with `PING` and the OIDC token grant:

```bash
helm install preflight labs64io/preflight -n labs64io --create-namespace -f my-endpoints.yaml
kubectl wait --for=condition=complete job/preflight -n labs64io --timeout=120s \
  || kubectl logs job/preflight -n labs64io --all-containers
```

## Gateway API

Protected routes need the Kubernetes Gateway API with Traefik v3 and the `api-gateway` chart. This is the only path that strips inbound `X-Auth-*` headers and enforces authentication and authorization. Charts do not create the `Gateway` itself. By default, every module's `gateway.parentRefs` points at `labs64io-gateway` in namespace `tools`. Until the Gateway API CRDs and that `Gateway` exist, the charts render the routes but the gateway does not accept them.

These minimal Traefik chart values provide it:

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

On a cluster without Gateway API CRDs, charts fall back to a plain `Ingress` for public routes only. A protected route has no Ingress equivalent, so the chart fails to render instead of exposing it unprotected.

## Secrets

Every chart with secrets supports two modes through `externalSecrets.enabled`:

| Value | Result |
|---|---|
| `false` (default) | The chart renders a plain Kubernetes `Secret` from `secrets.data`. Inject the values from your CI or secret tooling, never from a committed values file. |
| `true` | The chart renders an `ExternalSecret` with API version `external-secrets.io/v1`. External Secrets Operator resolves it through your `ClusterSecretStore`, for example Vault, AWS Secrets Manager or GCP Secret Manager. |

Charts never put credentials in a ConfigMap.

## Network policies

Each module chart ships a NetworkPolicy that admits traffic from the ingress controller and named caller modules only, and restricts egress to its own dependencies. If your cluster differs from the defaults, set `networkPolicy.ingressControllerLabels` for a non-Traefik ingress controller and `networkPolicy.observabilityNamespace`, which defaults to `monitoring`. Use `networkPolicy.extraEgress` to add destinations a module needs beyond that, such as an AuditFlow sink on a non-443 port.

## Image pinning

Images default to the chart's `appVersion` tag. Neither Docker Hub nor GHCR can stop someone from moving a tag. In shared environments, pin `image.digest` (`sha256:…`) for each module. The digest takes precedence over any tag.

## Observability

Set `observability.enabled` to inject runtime instrumentation and send traces, logs and metrics to an OpenTelemetry Collector. The image is the same either way. See [Monitoring and observability](./monitoring-observability.md).

See [Helm Charts Reference](../reference/helm-values.md) for shared value conventions and [Security & Compliance](./security-compliance.md) before going live.
