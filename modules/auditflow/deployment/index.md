---
title: Deployment
parent: AuditFlow
grand_parent: Core Platform
nav_order: 3
---

# Deployment

AuditFlow runs the same way locally, on Kubernetes and on managed cloud infrastructure; only the discovery mode and the backing services change, the message broker included: [RabbitMQ or Amazon SQS](#choose-a-message-broker).

## Docker Compose

Compose profiles cover local iteration, observability and the Amazon SQS broker:

| Command | Stack | When to use |
|---------|-------|-------------|
| `docker compose up --build -d` | 3 services + RabbitMQ + Valkey + Cerbos + ClickHouse | Same stack as Kubernetes minus the gateway; Redis-backed dedup, queryable sink |
| `docker compose -f docker-compose.yml -f docker-compose-observability.yml up --build -d` | Stack + OTel Collector + Tempo + Loki + Prometheus + Grafana | Full telemetry, fast iteration |
| `docker compose -f docker-compose.yml -f docker-compose-sqs.yml up --build -d` (`just up sqs`) | Stack with the backend on Amazon SQS, served locally by [ElasticMQ](https://github.com/softwaremill/elasticmq) on port 9324 | Try or develop against the SQS broker without an AWS account |

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

## Choose a message broker

AuditFlow buffers every accepted event on a message broker until each matching pipeline has delivered
it. Two brokers are supported; `auditflow.broker.type` picks one. Pipelines, tenants, retries, the
per-tenant DLQ and the `/actuator/dlq/<tenantId>` endpoint behave the same on both.

| | RabbitMQ (`rabbitmq`, default) | Amazon SQS (`sqs`) |
|---|---|---|
| Runs as | Your broker: the chart's in-cluster RabbitMQ, Amazon MQ for RabbitMQ, CloudAMQP, … (RabbitMQ 4.x, AMQP 0-9-1, no plugins) | AWS-managed queues; nothing to run, size or patch |
| Credentials | `SPRING_RABBITMQ_USERNAME` / `SPRING_RABBITMQ_PASSWORD` (a Kubernetes Secret) | None: the AWS SDK default chain, on EKS the pod's IAM role (IRSA or EKS Pod Identity) |
| Largest event | Limited by the gateway (2.5 MB request body) | About 1 MiB (SQS's message limit, minus room for AuditFlow's headers); larger events are rejected with `413` |
| Retention | Until delivered, replayed or purged, DLQ entries included | 14 days at most (SQS's limit), DLQ entries included: replay or purge them within that time |
| Retries 5 s … 3 h | Delay queues with a message TTL | Per-message delivery delays; delays over SQS's 15 minutes are re-parked in 15-minute steps |
| Cost | The broker's instance, always on | Per request: long-polling consumers plus a few requests per event |

### RabbitMQ

The default. Point `spring.rabbitmq` at your broker and give AuditFlow its user:

```yaml
applicationYaml:
  spring:
    rabbitmq:
      host: rabbitmq.internal.example.com
      port: "5671"
      ssl:
        enabled: true     # Amazon MQ accepts AMQPS on 5671 only
secrets:
  data:
    SPRING_RABBITMQ_USERNAME: auditflow
    SPRING_RABBITMQ_PASSWORD: <password>
```

AuditFlow declares its exchanges and queues itself on startup (`labs64-audit-topic`,
`labs64-audit-delivery`, `labs64-audit-delay.<seconds>s`, `labs64-audit-dlq.<tenant>`,
`labs64-audit-quarantine`). Its user needs configure, write and read rights on them. Set
`auditflow.broker.queue-type: quorum` for replicated queues on a multi-node broker.

### Amazon SQS

```yaml
applicationYaml:
  auditflow:
    broker:
      type: sqs
      sqs:
        region: eu-west-1               # empty: the SDK default (AWS_REGION, set by IRSA / Pod Identity)
        queue-prefix: auditflow-prod-   # at most 40 characters of [A-Za-z0-9_-]
        create-queues: true
serviceAccount:
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::<account>:role/<auditflow-role>
networkPolicy:
  extraEgress:                          # the SQS endpoint on 443 (or your SQS VPC endpoint)
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
      ports:
        - protocol: TCP
          port: 443
```

The queues, all standard queues named after the prefix:

| Queue | Holds |
|---|---|
| `<prefix>ingest` | Accepted events, consumed by the router |
| `<prefix>ingest-dlq` | Events the router could not handle after three attempts |
| `<prefix>delivery` | One message per event and pipeline; retries wait here as delayed messages |
| `<prefix>quarantine` | Events AuditFlow could not evaluate (unparseable, tenant not routable); nothing consumes it |
| `<prefix>dlq-<tenant>` | One per tenant: deliveries that failed for good, with reason and last error |

With `create-queues: true` (default) AuditFlow creates any of them that is missing, with SQS-managed
encryption and 14 days' retention; a queue that exists is used as it is, so you can create the fixed
four yourself (for example in Terraform, with your own encryption key and alarms). Tenant DLQs are
always created on a tenant's first dead-letter: with `create-queues: false` create each tenant's DLQ
beforehand. A tenant id that SQS cannot carry in a name (a `.`, or too long for SQS's 80 characters)
gets a sanitized name with an 8-character hash suffix.

The IAM policy of AuditFlow's role:

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility",
      "sqs:GetQueueUrl", "sqs:GetQueueAttributes", "sqs:CreateQueue"
    ],
    "Resource": "arn:aws:sqs:<region>:<account>:<queue-prefix>*"
  }]
}
```

`sqs:CreateQueue` is needed for the tenant DLQs, unless you create them yourself. A queue with a
customer-managed KMS key also needs `kms:GenerateDataKey` and `kms:Decrypt` on that key.

Further `auditflow.broker.sqs` settings, rarely changed:

| Property | Default | Purpose |
|---|---|---|
| `endpoint` | empty | An SQS-compatible endpoint instead of AWS (ElasticMQ, LocalStack) |
| `wait-time` | `PT10S` | Long-poll wait of one receive (1–20 s): longer means fewer empty receives, a slower shutdown |
| `delivery-visibility-timeout` | `PT10M` | How long a received delivery batch stays invisible to other pods; must cover the batch's sink calls |
| `ingest-visibility-timeout` | `PT1M` | The same for the ingest queue |
| `scan-visibility-timeout` | `PT5M` | How long a DLQ inspect, replay or purge holds the entries it looked at |
| `message-retention` | `P14D` | Retention of the queues AuditFlow creates |
| `max-connections` | `100` | HTTP connections to SQS per pod |

**Before you go live on SQS:**

- Alarm on every DLQ queue (`ApproximateNumberOfMessagesVisible` > 0) **and** on its age
  (`ApproximateAgeOfOldestMessage`, e.g. above 7 days): SQS deletes an entry nobody replayed or purged
  after 14 days, and with it the only copy of that delivery.
- Alarm on `<prefix>quarantine` and on a backlog in `<prefix>ingest` and `<prefix>delivery`.
- Tell publishers that an event above about 1 MiB is rejected with `413` and must not be retried.

### Switching brokers

The broker holds every event that is accepted but not yet delivered, including retries that are due
up to 3 hours later. Before you point a running AuditFlow at the other broker, replay or purge the DLQ
entries (`/actuator/dlq/<tenantId>` only reads the active broker); after the switch, keep the old broker
until its delivery and delay queues are empty, since nothing consumes them any more.

## Cloud-managed infrastructure

Swap any self-hosted component for a managed cloud service — pipeline behaviour is unchanged:

| Component | Cloud alternatives |
|-----------|--------------------|
| Message broker | Amazon SQS ([`type: sqs`](#amazon-sqs)), Amazon MQ for RabbitMQ, CloudAMQP |
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
