---
title: AuditFlow
parent: Core Platform
nav_order: 2
has_children: true
---

# AuditFlow

## Overview
AuditFlow is a central router for audit events. Your services publish an event once with a single REST call; AuditFlow buffers it on a message broker, redacts sensitive fields, evaluates the tenant's pipelines and delivers the result to one or more destinations (sinks). Routing is configuration, not code.

AuditFlow is a **router, not a system of record**. It has no database of its own: the sinks (OpenSearch, S3, ClickHouse, Splunk, …) own retention, immutability and query. Durability comes from confirmed broker buffering, per-pipeline retries over hours, a per-tenant dead-letter queue and the destination sink.

A publishing service needs no SDK and no broker client, and it holds no code for any destination.

AuditFlow complements OpenTelemetry rather than replacing it. OpenTelemetry answers "is my system healthy?" with sampled, disposable telemetry; AuditFlow answers "who did what, when, and with what outcome?" and treats every event as one that must not be lost.

| | OpenTelemetry and observability | AuditFlow |
|---|---|---|
| Question it answers | Is my system healthy? Latency, errors, throughput. | Who did what, when, with what outcome? Intentional actions by users and services. |
| Main reader | SREs and platform engineers | Compliance, security, legal and auditors |
| Data | High volume, sampled, short retention | Every event counts, no loss, long retention |
| When an item is lost | A gap in a graph | A gap in the audit trail |

A production system needs both. Because every audit event counts, AuditFlow has idempotent processing, retries, a dead-letter queue and redaction at ingest.

AuditFlow fits when several services must each record who did what, when and from where, and each does it differently today. It also fits when the same events must reach more than one destination with its own format, when personal or confidential data must be removed before anything stores it, when a destination outage must delay delivery and not lose events, and when business units or customers need their own routing and credentials. [Usage scenarios](./usage-scenarios/index.md) walks through each of these.

AuditFlow is the wrong tool if you only need traces, metrics or infrastructure logs, if you want to capture raw HTTP traffic at a proxy (your services decide what to publish), or if you want AuditFlow itself to be the queryable store.

## Capabilities

| Capability | Description |
|------------|-------------|
| **Tenant isolation** | Every pipeline belongs to exactly one tenant. Events route only through their own tenant's pipelines; there is no cross-tenant fall-through. |
| **Pipeline-as-configuration** | Destinations and conditions are YAML. Adding or rerouting one needs no rebuild and no restart. |
| **Redaction at ingest** | Fields are masked, hashed or dropped before the event reaches the broker. |
| **Pluggable sinks and transformers** | Python modules loaded at runtime; a catalogue ships in the box. |
| **Resilient delivery** | Idempotent processing, retry tiers, backpressure, circuit breaking and a replayable per-tenant DLQ. |
| **Observable** | OpenTelemetry traces, metrics and logs with a pre-provisioned Grafana dashboard. |

The full list is in [Features](./features/index.md). To see which usage fits yours, read [Usage scenarios](./usage-scenarios/index.md).

## Architecture

![AuditFlow components: your service publishes to the backend, which validates, redacts and checks the tenant, stores the event on RabbitMQ or Amazon SQS, routes it to one delivery per matching pipeline, and the delivery worker calls the transformer and sink services, which write to the destinations, while exhausted deliveries go to the tenant DLQ](./diagrams/auditflow.svg)

Three services:

| Service | Stack | Port | Role |
|---------|-------|------|------|
| `auditflow-be` | Java 25, Spring Boot 4 | 8080 | REST API, broker, pipeline orchestration |
| `auditflow-transformer` | Python 3.14, FastAPI | 8081 | Dynamically loaded transform modules |
| `auditflow-sink` | Python 3.14, FastAPI | 8082 | Dynamically loaded sink modules |

The Helm chart runs the transformer and the sink as sidecar containers in the backend's pod. The backend calls them over `localhost`. With the chart's NetworkPolicy enabled, only the backend's port 8080 accepts traffic from other pods.

An event passes through two stages, both inside the backend:

1. The ingest stage validates the event, assigns `timestamp` and checks the tenant (provisioned, enabled, within quota). It then applies redaction, publishes the event to the broker's ingest queue and answers only after the broker confirms that it stored the event.
2. The router reads the ingest queue, evaluates every enabled pipeline of the event's tenant and publishes one delivery message per matching pipeline. The delivery worker runs each delivery through its transformers and its sink, retries failures with growing delays and moves exhausted or poison deliveries to the tenant's DLQ.

Key design decisions:

- **No database of its own.** Redis (Valkey) is used for deduplication keys with a TTL, never as storage. If you need a queryable record, point a pipeline at a durable sink.
- **The backend is both producer and consumer** of its own broker queues, which gives decoupling and buffering without a separate ingestion service.
- **Pipelines are independent.** Each gets its own delivery message, retries and DLQ entry, so a failing destination never delays or repeats delivery to the others.
- **Python services are stateless plugins.** They hold no broker connection or pipeline state; they receive a request, run a module function and return a result.
- **RabbitMQ or Amazon SQS.** The broker is configuration (`auditflow.broker.type`): RabbitMQ with standard AMQP features only (publisher confirms, durable queues, per-queue TTL with dead-letter exchanges, no plugin), or Amazon SQS with no broker to run. Both give the same guarantees; the differences (event size, retention) are in [Choose a message broker](./deployment/index.md#choose-a-message-broker). Kafka is not supported.

## Quick Start

Run AuditFlow on its own with Docker Compose. Two ways, with the same stack:

**From the published images** (needs only Docker and Git, nothing to build):

```bash
git clone https://github.com/Labs64/labs64.io-auditflow.git
cd labs64.io-auditflow
docker compose -f docker-compose.yml -f docker-compose.images.yml up -d
```

Set `AUDITFLOW_VERSION` to a release tag to pin that release; the default is `latest`. The central authorization decision point (Cerbos) is not started in this mode, because the local stack runs with authorization disabled.

**From source** (needs Docker with Compose v2, JDK 25 and Maven 3.6.3+; also starts Cerbos):

```bash
mvn -B clean package -DskipTests -pl auditflow-be -am
docker compose up --build -d
```

The repository's [`AGENTS.md`](https://github.com/Labs64/labs64.io-auditflow/blob/master/AGENTS.md) lists its layout, commands and tests, and [`DEVELOPERS.md`](https://github.com/Labs64/labs64.io-auditflow/blob/master/DEVELOPERS.md) is the full developer guide. The [Contributing guide](../../development/contributing.md) covers the workflow for a change.

Either way the stack is the backend, transformer and sink services plus RabbitMQ, Valkey and ClickHouse. The backend needs about half a minute after start to become healthy.

Publish an event for the `demo` tenant that ships with the repository, then watch it arrive:

```bash
curl -sS -i -X POST http://localhost:8080/audit/publish \
  -H 'Content-Type: application/json' \
  -d '{"eventType":"user.login","sourceSystem":"keycloak","tenantId":"demo","extra":{"userId":"alice"}}'

docker compose exec clickhouse clickhouse-client --user auditflow --password auditflow \
  --query "SELECT event_type, source_system, tenant_id, user_id FROM audit.audit_events ORDER BY event_time DESC LIMIT 5"
```

The publish call answers `200` with the event id in the `X-Audit-Event-Id` header. If the connection is refused, the backend is still starting, so retry.

The row shows `user_id` as `***`: the demo configuration masks `extra.userId` at ingest, before the event reaches the broker or any destination.

The backend answered only after RabbitMQ confirmed that it stored the event. The `demo` tenant in [`tenants/demo.yaml`](https://github.com/Labs64/labs64.io-auditflow/blob/master/tenants/demo.yaml) has two pipelines, so the event went to ClickHouse and to the sink service's log (`docker compose logs sink`). Edit that file to change a destination. The backend reads the tenant directory again within about 5 seconds, with no restart.

Tear down with `docker compose down -v`.

To also start OpenTelemetry Collector, Tempo, Loki, Prometheus and Grafana, add the observability overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose-observability.yml up --build -d
```

| URL | Purpose |
|-----|---------|
| `http://localhost:8080/swagger-ui.html` | Interactive REST API |
| `http://localhost:8081/docs` | Transformer registry and API docs |
| `http://localhost:8082/docs` | Sink registry and API docs |
| `http://localhost:15673` | RabbitMQ management UI (`guest` / `guest`) |
| `http://localhost:8123/play` | ClickHouse query console (`auditflow` / `auditflow`) |
| `http://localhost:3000` | Grafana, observability overlay only (`admin` / `admin`) |

[Run one module locally](../../getting-started/run-one-module-locally.md) walks through this in detail. To call AuditFlow through the gateway, with authentication, take the [Quickstart](../../getting-started/quickstart.md).

### Query the stored events

The default stack ships ClickHouse as a working analytics sink, so events are not only delivered but queryable. The `demo` tenant and the reserved `_platform` tenant both route to ClickHouse:

```bash
docker compose exec clickhouse clickhouse-client --user auditflow --password auditflow \
  --query "SELECT event_time, event_type, source_system FROM audit.audit_events ORDER BY event_time DESC LIMIT 20"
```

`tenant_id` leads the table's `ORDER BY` key and a tenantless event stores an empty string there, so publish with `"tenantId": "demo"` for a representative round trip. The table and its design are described under [ClickHouse](./sinks-and-transformers/index.md#clickhouse).

## Event fields

`AuditEvent` requires only `eventType` and `sourceSystem`. `eventId` is optional: if you omit it the server assigns one and returns it in the `X-Audit-Event-Id` response header, and supplying a stable value makes retries idempotent. The server also assigns `timestamp` (the receipt time); a client value is ignored. `eventTime` (when the action happened) is optional: see [Time fields](#time-fields-event-time-and-receipt-time).

Everything your domain needs goes in `extra`, an open map. No key in it is required, and none is guaranteed. Every deployment defines its own field set, and keys AuditFlow does not recognise are delivered unchanged in the sink's metadata map, so an event never loses data by using your own names.

A small convention sits on top: the generic audit-semantics keys `userId`, `actionName`, `actionStatus`, `actionMessage`, `durationMs` and `responseStatus`, which the bundled transformers **promote** out of the map into dedicated fields and columns. Promotion is what turns a key into a queryable report dimension. All of them are optional, and an absent key produces an omitted field, never a placeholder.

Four rules every bundled transformer and sink follows:

| Rule | Meaning |
|---|---|
| **Open** | No `extra` key is required. |
| **Absent is absent** | A missing key yields an omitted field, never `"unknown"` or `"N/A"`. |
| **Nothing is dropped** | Non-promoted keys always reach the sink. |
| **Uniform extension** | Every bundled transformer takes the same `make_transform` call and environment mapping. |

A domain-specific module may require its own keys, provided it documents them and gates on `eventType` first.

### Time fields: event time and receipt time

An event has exactly two times, and they mean different things:

| | Event time | Receipt time |
|---|---|---|
| Field | `eventTime` | `timestamp` |
| Means | when the audited action **happened** at the source | when AuditFlow **received** the event |
| Set by | you; AuditFlow uses the receipt time when you omit it | AuditFlow only; a client value is ignored |
| Use it for | reports, trends, "when did it happen" | arrival order, deduplication, an archive's date folders |

The two are equal when you publish as the action happens, and differ for a backfill, a retried publish or a publisher whose clock is off. **Group reports on `eventTime`**: grouping on `timestamp` puts a backfill of two years of history into today's bucket. In ClickHouse, OpenSearch and Athena the same two times are `event_time` and `timestamp` (`eventtime` in Athena).

Send `eventTime` when you publish later than the action (a queue, a batch import, an offline client). Leave it out when you publish at once: AuditFlow then sets it to the receipt time, so it is always present downstream. It is kept exactly as you send it, and it must be plausible: not more than 5 minutes after the receipt time (clock skew) and not older than 1095 days. Otherwise the event is rejected with `400 VALIDATION_ERROR` (in a batch, that event only), and the message names the limit. Operators change the limits with `auditflow.event-time.max-future` and `auditflow.event-time.max-age`.

No other time belongs to an event. Delivery to a sink happens later, possibly hours later with retries, and is not recorded in it. [Which time each sink uses](./sinks-and-transformers/index.md#which-time-each-sink-uses).

To promote your own keys, either build a transformer module on a bundled one:

```python
from audit_clickhouse import make_transform
transform = make_transform({"orderRef": "order_ref"}, module_id=__name__)
```

or configure it with no code at all, on the transformer container:

```yaml
AUDITFLOW_PROMOTED_KEYS: '{"orderRef": "order_ref"}'
```

Code declares the domain and the operator overrides the code, so precedence runs: built-in vocabulary, then the `make_transform()` argument, then `AUDITFLOW_PROMOTED_KEYS`, then `AUDITFLOW_PROMOTED_KEYS_<MODULE_ID>`. A malformed mapping fails that module's import and shows up in `GET /registry` rather than silently dropping a column.

A promoted key needs a matching column in the sink schema (for ClickHouse, an `ALTER TABLE ... ADD COLUMN`), or the value is **silently dropped at insert**, because `clickhouse_sink` inserts with `input_format_skip_unknown_fields=1`. The configuration-only path is not schema-agnostic: the column must exist before the key is promoted. The full vocabulary is documented on the `Extra` schema in the AuditFlow OpenAPI contract.

## Configuration

Configuration is provided through environment variables or Helm values.

| Variable | Description | Default |
|----------|-------------|---------|
| `AUDITFLOW_BROKER_TYPE` | Message broker: `rabbitmq` or `sqs` (`auditflow.broker.type`). | `rabbitmq` |
| `RABBITMQ_USERNAME` | RabbitMQ user. Required with `rabbitmq`, no default. | none |
| `RABBITMQ_PASSWORD` | RabbitMQ password. Required with `rabbitmq`, no default. | none |
| `AUDITFLOW_BROKER_SQS_REGION` | AWS region of the SQS queues; empty uses the AWS SDK default. | empty |
| `AUDITFLOW_BROKER_SQS_QUEUE_PREFIX` | Name prefix of the SQS queues. | `labs64-audit-` |
| `AUDITFLOW_REDACTION_HASH_KEY` | Secret key for `hash` redaction rules, at least 32 characters. | none |
| `AUDITFLOW_BROKER_QUEUE_TYPE` | RabbitMQ queue type: `classic`, or `quorum` for replicated queues on a multi-node broker. | `classic` |
| `AUDITFLOW_DELIVERY_CONCURRENCY` | Delivery consumers per pod. | `4` |
| `AUDITFLOW_DELIVERY_BATCH_SIZE` | Messages one delivery consumer takes at once; also caps a sink batch. | `50` |
| `AUDITFLOW_PROMOTED_KEYS` | JSON object mapping `extra` keys to columns for the transformer. With the Helm chart, set `transformer.promotedKeys` instead. | none |

On SQS, credentials come from the AWS SDK default chain (an IAM role on EKS), never from configuration; see [Amazon SQS](./deployment/index.md#amazon-sqs) for the queues and the IAM policy.

Tenant pipelines are read from the directory set by the `tenants.source.local-dir.path` property (`/config/tenants` by default; the compose stack mounts `./tenants`) or, on Kubernetes, from ConfigMaps labelled `auditflow.io/tenant`. Changes are picked up live, with no restart. See [Configuring pipelines](./configuring-pipelines/index.md) for the tenant file format, conditions and redaction, and [Deployment](./deployment/index.md) for Kubernetes and managed infrastructure.

Sink and transformer modules, and their properties, are covered in [Sinks and transformers](./sinks-and-transformers/index.md).

## REST APIs

The contract is OpenAPI-first and frozen within v1: changes are additive-only, and CI rejects a pull request that removes or narrows anything.

Through the gateway, the publish paths carry the prefix `/auditflow/api/v1`, for example `POST /auditflow/api/v1/audit/publish`. Both publish operations need the scope `audit-event:write`, and the gateway takes the tenant from the caller's token, not from the event body.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/audit/publish` | `POST` | Publish one event. Answers `200` only after the broker has stored it. |
| `/audit/publish/batch` | `POST` | Publish up to 100 events; the answer carries a result per event. |
| `/actuator/pipelines/<tenantId>` | `GET` | Deployed pipelines, effective retry and batch settings, warnings. |
| `/actuator/pipelines/<tenantId>/dry-run` | `POST` | Show which pipelines a sample event would reach and why. |
| `/actuator/dlq/<tenantId>` | `GET` / `POST` / `DELETE` | Inspect, replay or purge (irreversible) the tenant's dead-letter queue. `GET` takes `limit` (up to 100 entries) and `pipeline`; `POST` and `DELETE` take an optional `pipeline`. |
| `/actuator/health` | `GET` | Health check. |
| `/swagger-ui.html` | `GET` | Interactive API documentation. |

The gateway routes only the publish paths and `/v3/api-docs`. The `/actuator` endpoints are an internal admin interface: reach them from inside the cluster, for example with `kubectl port-forward`. Use `_platform` as the tenant id for tenantless events.

Publish errors an integration should handle: `400` invalid event, `403 TENANT_NOT_PROVISIONED` or `TENANT_DISABLED`, `413` an event larger than the gateway or the broker accepts (about 1 MiB on Amazon SQS; not retryable, in a batch a `VALIDATION_ERROR` for that event), `429 TENANT_RATE_LIMITED` with `Retry-After`, and `503` when the broker did not store the event (retry with the same `eventId`).

The backend serves the OpenAPI document at `/v3/api-docs`. Its source is [`openapi-audit-v1.yaml`](https://github.com/Labs64/labs64.io-auditflow/blob/master/auditflow-api/src/main/resources/openapi/openapi-audit-v1.yaml). Because v1 changes are additive-only, a client or tool definition generated from it keeps working across upgrades.

### AI agents

An AI agent records its actions with the same publish call as any other service, one HTTP request per action and no SDK. Set `eventType` to the action (for example `agent.tool.called`), `sourceSystem` to the agent's name, and put the details in `extra`. Your redaction rules apply to these events as to all others. The agent can act on the error codes above, for example by waiting for `Retry-After` on a `429` and retrying with the same `eventId` on a `503`. Before it relies on a route, the pipeline dry run shows which pipelines a sample event reaches and why.

## Examples

### Custom transformer plugin

Create a transformer that masks a field (`transformers/mask.py`):

```python
def transform(input_data: dict) -> dict:
    extra = input_data.get("extra", {})
    if "email" in extra:
        extra["email"] = "***@***.com"
    return input_data
```

Reference it from a pipeline with `transformer.name: mask`. For redaction that must happen before the broker, use [ingest-time redaction](./configuring-pipelines/index.md#pii-redaction) instead; a transformer runs after the event is buffered.

More: [Sinks and transformers](./sinks-and-transformers/index.md#adding-your-own-sink-or-transformer).

## Operations

AuditFlow scales horizontally. Increase `replicaCount` in your Helm values to process more events concurrently; the broker distributes deliveries across the replicas. Running more than one replica requires Redis, so that rate limits and deduplication are shared. See [Running without Redis](./deployment/index.md#running-without-redis).

## Before you go live

- [ ] Every tenant that publishes has a tenant document. AuditFlow rejects an unknown tenant with `403 TENANT_NOT_PROVISIONED`.
- [ ] The `/actuator` endpoints, DLQ replay and purge included, need no authentication. Keep them off any public route, and keep `networkPolicy.ingressFrom` limited to the services that publish events directly.
- [ ] Redaction rules cover every field that must not reach a sink. A `hash` rule needs `AUDITFLOW_REDACTION_HASH_KEY` from a secret.
- [ ] Sink credentials are `${secretRef:<key>}` references, never literals in tenant files.
- [ ] More than one backend replica runs with Redis, for shared deduplication and rate limits.
- [ ] Someone owns each tenant's DLQ and alerts on new entries. A purge cannot be undone, and on Amazon SQS an entry expires after 14 days.
- [ ] On Kubernetes with NetworkPolicy enabled, every sink on a port other than 443 has a matching `networkPolicy.extraEgress` rule.

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Events not reaching a sink | Pipeline condition mismatch | Use the pipeline dry run to see which pipelines the event reaches and why. |
| `403 TENANT_NOT_PROVISIONED` | No tenant file for the event's `tenantId` | Add `tenants/<tenantId>.yaml`; it is picked up live. |
| Deliveries in the DLQ | Retries exhausted, or a poison event (4xx, malformed transformer output) | Inspect `GET /actuator/dlq/<tenantId>`, fix the cause, then replay with `POST`. |
| A sink never receives data on Kubernetes | NetworkPolicy allows only HTTPS egress | Add a matching `networkPolicy.extraEgress` rule for the sink's port. |
| Python plugin fails | Syntax error, or wrong function signature | Check the sink or transformer service logs; `GET /registry` lists modules that failed to import. |
| RabbitMQ connection error | Bad credentials or network | Verify `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD` and the broker host. |
| SQS `AccessDenied` or `QueueDoesNotExist` | IAM role or queue prefix | The pod's role needs the [SQS policy](./deployment/index.md#amazon-sqs) on `<queue-prefix>*`; with `create-queues: false` every queue must exist. `/actuator/health` reports the `sqs` component. |
| `413` from `/audit/publish` on SQS | Event above about 1 MiB | Send less (for example trim `extra`); SQS cannot carry larger messages. |

## Next steps

| I want to | Read |
|---|---|
| Route events to my own destinations | [Configuring pipelines](./configuring-pipelines/index.md) and [Sinks and transformers](./sinks-and-transformers/index.md) |
| Mask, hash or drop sensitive fields | [PII redaction](./configuring-pipelines/index.md#pii-redaction) |
| Find the setup that fits my situation | [Usage scenarios](./usage-scenarios/index.md) |
| Run AuditFlow on my cluster | [Deployment](./deployment/index.md) |
| Compare the ways to run Labs64.IO | [Choose a deployment path](../../getting-started/choose-a-deployment-path.md) |
| Fix a first run that does not work | [Troubleshooting your first run](../../getting-started/troubleshooting.md) |

If your question is not answered, [open an issue](https://github.com/Labs64/labs64.io-auditflow/issues).
