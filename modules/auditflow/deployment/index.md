---
title: Deployment
parent: AuditFlow
grand_parent: Core Platform
nav_order: 3
---

# Deployment

AuditFlow runs the same way locally, on Kubernetes and on managed cloud infrastructure; only the discovery mode and the backing services change.

## Docker Compose

Two Compose profiles cover local iteration and observability:

| Command | Stack | When to use |
|---------|-------|-------------|
| `docker compose up --build -d` | 3 services + RabbitMQ + Valkey + Cerbos + ClickHouse | Same stack as Kubernetes minus the gateway; Redis-backed dedup, queryable sink |
| `docker compose -f docker-compose.yml -f docker-compose-observability.yml up --build -d` | Stack + OTel Collector + Tempo + Loki + Prometheus + Grafana | Full telemetry, fast iteration |

Build the backend jar first with `mvn -B clean package -DskipTests -pl auditflow-be -am`.

```bash
cp .env.example .env   # optional: only needed for custom RabbitMQ credentials
docker compose -f docker-compose.yml -f docker-compose-observability.yml up --build -d
```

Observability overlay URLs:

| URL | Credentials | Purpose |
|-----|-------------|---------|
| http://localhost:3000 | admin / admin | Grafana — pre-provisioned AuditFlow Overview dashboard |
| http://localhost:9090 | — | Prometheus query UI |
| http://localhost:3100 | — | Loki API (use Grafana for UI) |
| http://localhost:3200 | — | Tempo API (use Grafana for UI) |

## Kubernetes

AuditFlow supports Kubernetes-native service discovery. Set `discovery.mode: kubernetes` and the backend resolves transformer and sink service IPs via the fabric8 `KubernetesClient` at runtime — no hardcoded URLs in Deployment specs.

```yaml
# application.yml or JAVA_OPTS in your Deployment
transformer:
  discovery:
    mode: kubernetes
    namespace: auditflow
    service-name: auditflow-transformer

sink:
  discovery:
    mode: kubernetes
    namespace: auditflow
    service-name: auditflow-sink
```

Health probes are ready to use out of the box:

```yaml
livenessProbe:
  httpGet:
    path: /live       # Python services; use /actuator/health for the Java backend
    port: 8081
readinessProbe:
  httpGet:
    path: /ready
    port: 8081
```

Custom sinks and transformers can be injected at runtime via a ConfigMap or volume — no image rebuild required:

```yaml
volumeMounts:
  - name: custom-sinks
    mountPath: /home/l64user/sinks_bootstrap
volumes:
  - name: custom-sinks
    configMap:
      name: my-sink-plugins
```

> Helm charts are published from [`labs64.io-helm-charts`](https://github.com/Labs64/labs64.io-helm-charts): `helm repo add labs64io https://labs64.github.io/labs64.io-helm-charts`, then `labs64io/auditflow` for AuditFlow alone or `labs64io/labs64io-ecosystem` for the platform. Its `install.sh` puts the whole stack on a cluster and verifies it; see [Deploy to your Kubernetes cluster](https://labs64.io/docs/getting-started/deploy-to-kubernetes/).

## Cloud-managed infrastructure

Swap any self-hosted component for a managed cloud service — pipeline behaviour is unchanged:

| Component | Cloud alternatives |
|-----------|--------------------|
| Message broker (RabbitMQ) | Amazon MQ for RabbitMQ, CloudAMQP |
| Redis (idempotency) | ElastiCache, Azure Cache for Redis, Memorystore |
| Log storage | Amazon OpenSearch Service, Grafana Cloud Loki |
| Archive storage | Amazon S3, Google Cloud Storage, Azure Blob Storage |
| Metrics / traces | Grafana Cloud, Datadog, Honeycomb |

The cloud sinks (`aws_s3_sink`, `aws_cloudwatch_sink`, `gcs_sink`, `azure_blob_sink`) read connection details from `sink.properties`, resolved from environment variables — no credentials in configuration files.

## Running without Redis

Redis is used only for idempotency and deduplication, and for multi-replica rate limiting. A single-replica
deployment that needs neither can skip running Redis. (The bundled
`docker-compose.yml` stack does run Valkey, so that local behaviour matches Kubernetes.) To run
without it via the Helm chart, set:

```yaml
applicationYaml:
  auditflow:
    idempotency:
      store: memory
  tenants:
    ratelimit:
      backend: in-memory
  spring:
    autoconfigure:
      exclude:
        - org.springframework.boot.data.redis.autoconfigure.DataRedisAutoConfiguration
        - org.springframework.boot.data.redis.autoconfigure.DataRedisReactiveAutoConfiguration
        - org.springframework.boot.data.redis.autoconfigure.health.DataRedisHealthContributorAutoConfiguration
        - org.springframework.boot.data.redis.autoconfigure.health.DataRedisReactiveHealthContributorAutoConfiguration
```

All four exclude entries are required together — Spring Boot still instantiates a Redis
connection factory (and its health indicator, which will report `DOWN` against an unreachable
Redis) if only `idempotency.store`/`ratelimit.backend` are switched without also excluding the
auto-configuration classes.

Running more than one replica without Redis is not supported: rate-limiting falls back to
per-process in-memory counters, so each replica enforces its own independent quota instead of a
shared one.
