---
title: Kubernetes & Helm Setup
parent: Operate & Manage
nav_order: 2
---

# Kubernetes & Helm Setup

Every Labs64.IO service ships as a Helm chart in the `labs64io` chart repository (`https://labs64.github.io/labs64.io-helm-charts`). You install one service on its own, or all of them with the `labs64io-ecosystem` umbrella chart. No module chart bundles PostgreSQL, RabbitMQ or Redis. You point each service at infrastructure you provide, or you let the umbrella chart run bundled instances for evaluation. Keep chart values in version control and source the secrets from your secret-management system.

This page describes how the charts fit together. For the install steps, see the [Quickstart](../getting-started/quickstart.md) and [Deploy to your Kubernetes cluster](../getting-started/deploy-to-kubernetes.md).

## Environment shape

| Layer | Responsibility |
|---|---|
| Cluster | Schedules workloads, enforces network policies, and provides the Kubernetes Gateway API resource definitions |
| Namespace | `tools` holds the gateway and shared infrastructure, `labs64io` holds the Labs64.IO services, `monitoring` holds the observability stack. You can choose other names |
| Helm release | Declares one service's image, replicas, configuration and secret references |
| Data stores | PostgreSQL, a Redis-compatible store and the AuditFlow message broker, managed by you or bundled for evaluation |
| Observability backend | Receives traces, logs and metrics from the OpenTelemetry Collector |

The local development stack and the umbrella chart lay out a cluster like this:

![Cluster layout: Traefik, the identity provider, External Secrets Operator, PostgreSQL, Valkey and RabbitMQ in namespace tools; the api-gateway, authz-pdp, api-docs and module charts in namespace labs64io; the OpenTelemetry Collector, Tempo, Loki, Prometheus and Grafana in namespace monitoring](./diagrams/cluster.svg)

Traefik routes each request to a service after the `api-gateway` ForwardAuth check, and the [Auth Gateway](../modules/auth-gateway/index.md) asks the `authz-pdp` policy engine for the decision. The services use the data stores in `tools`. With observability enabled, they send telemetry to the collector in `monitoring`.

## Charts

| Chart | Purpose | Needs | Gateway routes |
|---|---|---|---|
| `auditflow` | [AuditFlow](../modules/auditflow/index.md) backend, transformer and sink | RabbitMQ (AMQP 0-9-1) or Amazon SQS; Redis for more than one replica | `/auditflow/api/v1` (protected), `/auditflow/v3/api-docs` (public) |
| `payment-gateway` | [Payment Gateway](../modules/payment-gateway/index.md) | PostgreSQL (database `payment_gateway`), Redis | `/payment-gateway/api/v1` (protected), `/payment-gateway/v3/api-docs` (public) |
| `checkout` | [Checkout](../modules/checkout/index.md) API, and the UI with `ui.enabled` | PostgreSQL (database `checkout`) | `/checkout/api/v1` (protected), `/checkout/v3/api-docs` (public), `/checkout` UI (public) |
| `customer-portal` | [Customer Portal](../modules/customer-portal/index.md) UI | None | `/customer-portal` (public) |
| `api-gateway` | [Auth Gateway](../modules/auth-gateway/index.md) and the shared Traefik middlewares for authentication, rate limiting, request buffering and compression | An OIDC provider that supports the client-credentials grant | None |
| `authz-pdp` | Cerbos policy decision point, with the policies generated from each service's OpenAPI contract | None | None |
| `api-docs` | Aggregated Swagger UI | None | `/swagger-ui` (public) |
| `preflight` | One-shot job that checks your infrastructure before you install | None | None |
| `mock-oidc` | Demo identity provider. It issues a token to anyone, so never install it in production | None | None |
| `labs64io-ecosystem` | Umbrella chart: the charts above, plus optional bundled PostgreSQL, RabbitMQ, Valkey, Traefik and the demo identity provider | None | None |

A protected route passes the ForwardAuth check. Public operations inside a protected route, such as the Payment Gateway's provider webhooks, are declared public in the OpenAPI contract, and the Auth Gateway lets them through without a token. Module charts publish their routes only with `gateway.enabled: true`. `chart-libs` is the shared library chart that every chart above depends on; you do not install it yourself.

`helm show values labs64io/<chart>` prints the documented values of a chart. The [Helm charts reference](../reference/helm-values.md) lists the values all module charts share.

## Deployment modes

| Mode | How | Configuration |
|---|---|---|
| Evaluation | `install.sh`, or the umbrella chart with `values.demo.yaml` | Bundled data stores, Traefik and the demo identity provider. See the [Quickstart](../getting-started/quickstart.md) |
| Local development | `just up` with a k3d cluster, Helmfile and locally built images | See [Run the full ecosystem locally](../getting-started/run-the-full-ecosystem-locally.md) |
| AWS | The umbrella chart with `values.aws.yaml` and a second values file with your environment's coordinates | EKS with RDS, ElastiCache, Amazon SQS or Amazon MQ, and AWS Secrets Manager. See [Deploy to your Kubernetes cluster](../getting-started/deploy-to-kubernetes.md#aws-azure-google-cloud-and-on-premises) |
| Your own cluster | Helm, Argo CD, Flux or a similar tool, with your PostgreSQL, broker, Redis and identity provider | Start from `overrides/<module>/values.prod-example.yaml` in the [helm-charts repository](https://github.com/Labs64/labs64.io-helm-charts). The published charts do not contain these files |

`values.demo.yaml` and `values.aws.yaml` ship inside the umbrella chart package (`helm pull labs64io/labs64io-ecosystem --untar`). The `auditflow`, `payment-gateway` and `checkout` charts also ship a `values.standalone.yaml` example. In the umbrella chart, `<module>.enabled` turns a service on or off, and `postgresql.enabled`, `rabbitmq.enabled` and `redis.enabled` turn the bundled data stores on or off. `checkout` and `customer-portal` are off by default.

The umbrella chart refuses to render while a bundled data-store password still has its shipped default. Only `demoMode: true`, which `values.demo.yaml` sets, lifts that check and allows the `mock-oidc` chart.

To install the evaluation profile with Helm alone, apply the [Gateway API resource definitions](https://gateway-api.sigs.k8s.io/guides/#installing-gateway-api) first. The installer does that for you. The profile also expects the `tools` namespace and the release name `labs64io`:

```bash
helm pull labs64io/labs64io-ecosystem --untar
kubectl create namespace tools
helm install labs64io labs64io/labs64io-ecosystem -n labs64io --create-namespace \
  -f labs64io-ecosystem/values.demo.yaml
```

To get a demo token on this profile, send the token request with the header `Host: mock-oidc:8080`. The demo identity provider names itself after the host it is called on, and the Auth Gateway accepts only tokens issued under the name in its discovery URL. A token issued under any other name fails with `401` "Invalid token: Invalid issuer".

## Install pattern

1. Install the Gateway API resource definitions and a `Gateway` (see [Gateway API](#gateway-api)).
2. Provision your data stores and create the secrets, or plan to use External Secrets Operator.
3. Check every dependency from inside the cluster with the [preflight chart](../getting-started/deploy-to-kubernetes.md#2-check-your-infrastructure-before-you-install).
4. Install the `api-gateway` and `authz-pdp` charts, then the services you need, or the umbrella chart with all of them.
5. Run `helm test <release>`, then check routing, telemetry and backups.

## Gateway API

Protected routes need the Kubernetes Gateway API, Traefik v3 and the `api-gateway` chart. Only this path removes inbound `X-Auth-*` headers and enforces authentication and authorization. The module charts do not create the `Gateway` itself. Each module's `gateway.parentRefs` points at the `Gateway` named `labs64io-gateway` in namespace `tools` by default. Until the Gateway API resource definitions and that `Gateway` exist, the charts render their `HTTPRoute`, and the route stays at `Accepted: False`.

The umbrella chart installs Traefik and the shared `Gateway` with `traefik.enabled: true`. To provide your own, these minimal values for the Traefik chart create the `Gateway` that the module defaults expect:

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

Routes are served on the host `gateway.<global.domain>`, `gateway.localhost` by default. Set `global.gateway.anyHost: true` when clients reach the gateway by IP address or by a load balancer's DNS name.

Every route applies, in order: removal of inbound `X-Auth-User`, `X-Auth-Scopes` and `X-Auth-Tenant`, the ForwardAuth check and the rate limit on protected routes, request buffering, security response headers, compression, and the path rewrite.

The security response headers are the same on every route, UI routes included:

| Header | Value |
|---|---|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Content-Security-Policy` | `default-src 'self'; script-src 'self'; object-src 'none'` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |

On a cluster without the Gateway API resource definitions, the charts fall back to a plain `Ingress` for public routes only (configure it with `gateway.ingressClassName` and `gateway.annotations`). A protected route has no `Ingress` equivalent, so the chart fails to render instead of exposing it unprotected.

## Secrets

Every chart with secrets supports two modes through `externalSecrets.enabled`:

| Value | Result |
|---|---|
| `false` (default) | The chart renders a plain Kubernetes `Secret` from `secrets.data`. Inject the values from your pipeline or secret tooling, never from a committed values file |
| `true` | The chart renders an `ExternalSecret` (`external-secrets.io/v1`) that reads `externalSecrets.secretKey` through the `ClusterSecretStore` named in `externalSecrets.storeName`. External Secrets Operator resolves it from your backend, for example Vault, AWS Secrets Manager, Azure Key Vault or Google Secret Manager |

Every key of the secret becomes an environment variable of the service. Charts never put credentials in a ConfigMap.

## Network policies

Each long-running chart can render a NetworkPolicy. It is off by default, so turn it on with `networkPolicy.enabled: true`. The policy admits traffic only from the ingress controller, the chart's own pods and named caller services (`networkPolicy.ingressFrom`). It restricts egress to the service's own dependencies, such as the policy engine and its entries in `networkPolicy.toolsEgress`. If your cluster differs from the defaults, set these values:

| Value | Use it for |
|---|---|
| `networkPolicy.gatewayNamespace` | The namespace of the ingress controller, `tools` by default |
| `networkPolicy.ingressControllerLabels` | The pod labels of a non-Traefik ingress controller |
| `networkPolicy.observabilityNamespace` | The namespace of Prometheus and the OpenTelemetry Collector, `monitoring` by default |
| `networkPolicy.extraEgress` | Destinations outside the cluster, such as a managed database's address range or an AuditFlow sink |

The services trust the `X-Auth-*` headers they receive. Without these policies, any workload in the cluster that reaches a service directly can forge an identity.

## Image pinning

The published charts pin each Labs64.IO image by digest in `image.digest`, so a deployment cannot follow a tag that someone moved. The digest takes precedence over `image.tag`, and the chart rejects a value that is not `sha256:` followed by 64 hex characters. To run another build, set its digest, or clear `image.digest` and set `image.tag`. The [Docker images](../reference/docker-images.md) page lists the images and their tags.

## Observability

Set `observability.enabled: true` to send traces, logs and metrics to an OpenTelemetry Collector. The image is the same either way. The chart activates the OpenTelemetry Java agent through `JAVA_TOOL_OPTIONS` for Java services, and `opentelemetry-instrument` for Python services, and sets `OTEL_EXPORTER_OTLP_ENDPOINT` to `observability.otlpEndpoint`. That defaults to `http://$(NODE_IP):4318`, the collector running as a DaemonSet on each node. Java services keep serving Prometheus metrics at `/actuator/prometheus`. With `slo.enabled`, the Payment Gateway, Checkout and AuditFlow charts add SLO recording rules and alerts when the `PrometheusRule` resource definition exists. See [Monitoring & Observability](./monitoring-observability.md).

See the [Helm charts reference](../reference/helm-values.md) for shared value conventions and [Security & Compliance](./security-compliance.md) before you go live.
