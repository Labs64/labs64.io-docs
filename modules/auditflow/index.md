---
title: AuditFlow
parent: Core Platform
nav_order: 2
---

# AuditFlow

## Overview
AuditFlow is a central router for audit events. It allows you to publish events once from any service and route them to multiple destinations (sinks) based on configurable, tenant-isolated pipelines. AuditFlow is stateless—it does not store events itself, but ensures they reach the configured persistent stores.

## Capabilities

| Capability | Description |
|------------|-------------|
| **Tenant Isolation** | Every pipeline belongs to exactly one tenant. Events route only through their respective tenant's pipelines. |
| **Pluggable Sinks** | Send events to the destinations configured for a tenant. |
| **Pluggable Transformers** | Modify or enrich event payloads in-flight before they reach a sink. |
| **Stateless Routing** | Relies entirely on external persistence; it operates purely as an event processor. |

## Architecture

AuditFlow consumes events from RabbitMQ (or via direct API), passes them through a tenant's pipeline (which may include transformers), and sends them to sinks.

```mermaid
flowchart LR
    subgraph Input
        API[HTTP POST]
        MQ[(RabbitMQ)]
    end
    
    subgraph AuditFlow Pipeline
        R[Router]
        T1[Transformer: Anonymize]
        T2[Transformer: Enrich]
    end
    
    subgraph Sinks
        S1[(OpenSearch)]
        S2[(S3 Bucket)]
    end
    
    API --> R
    MQ --> R
    
    R -->|"Match Tenant A"| T1
    T1 --> S1
    
    R -->|"Match Tenant B"| T2
    T2 --> S2
```

## Quick Start

Run AuditFlow independently using Docker Compose:

```bash
git clone https://github.com/Labs64/labs64.io-auditflow.git
cd labs64.io-auditflow
just up
```

Test it by publishing an event:
```bash
curl -sS -i -X POST http://localhost:8080/audit/publish \
  -H 'Content-Type: application/json' \
  -d '{"eventType":"demo.event","sourceSystem":"demo","extra":{"hello":"world"}}'
```

## Event fields

`AuditEvent` requires only `eventType` and `sourceSystem`. Everything your domain needs goes in
`extra`, an open map — no key in it is required, and none is guaranteed. Every deployment defines
its own field set, and keys AuditFlow does not recognise are delivered unchanged in the sink's
metadata map, so an event never loses data by using your own names.

A small convention sits on top: the generic audit-semantics keys `userId`, `actionName`,
`actionStatus`, `actionMessage`, `durationMs` and `responseStatus`, which the bundled
transformers **promote** out of the map into dedicated fields and columns. Promotion is what turns a
key into a queryable report dimension. All of them are optional, and an absent key produces an
omitted field, never a placeholder.

To promote your own keys, either build a transformer module on a bundled one:

```python
from audit_clickhouse import make_transform
transform = make_transform({"orderRef": "order_ref"}, module_id=__name__)
```

or configure it with no code at all, on the transformer container:

```yaml
AUDITFLOW_PROMOTED_KEYS: '{"orderRef": "order_ref"}'
```

Either way, a promoted key needs a matching column in the sink schema — for ClickHouse, an
`ALTER TABLE ... ADD COLUMN` — or the value is **silently dropped at insert**, because
`clickhouse_sink` inserts with `input_format_skip_unknown_fields=1`. The config-only path is not
schema-agnostic: it still requires the column to exist before the key is promoted. The full
vocabulary and both promotion paths are documented on the `Extra` schema in the AuditFlow OpenAPI
contract.

## Configuration

Configuration is provided via environment variables or Helm values.

| Variable | Description | Default |
|----------|-------------|---------|
| `SPRING_RABBITMQ_HOST` | RabbitMQ broker host. | `localhost` |
| `SPRING_RABBITMQ_USERNAME` | RabbitMQ user. | `guest` |
| `SPRING_RABBITMQ_PASSWORD` | RabbitMQ password. | `guest` |
| `AUDITFLOW_PIPELINE_PATH` | Path to the directory containing tenant pipelines. | `/etc/auditflow/tenants` |

### Pipeline Configuration Example

Tenants configure their pipelines via YAML files (e.g., `tenants/tenant1.yaml`):

```yaml
tenantId: "tenant1"
pipelines:
  - name: "Store in OpenSearch"
    condition: "eventType == 'demo.event'"
    sinks:
      - type: "opensearch"
        properties:
          index: "audit-logs"
```

### Transformers and sinks

Build every pipeline from a small set of explicit stages. The configured set depends on the deployment; validate a plugin's supported interface in the service repository before enabling it.

| Category | Purpose | Typical use |
|---|---|---|
| **Transformers: privacy** | Remove, mask, or pseudonymize fields | Keep personal data out of a downstream audit index |
| **Transformers: enrichment** | Add context derived from known event fields | Attach source or classification metadata |
| **Transformers: normalization** | Reshape event data into a common form | Make events easier to query consistently |
| **Sinks: search** | Write records for investigation and querying | OpenSearch |
| **Sinks: object storage** | Store durable archive copies | S3-compatible storage |
| **Sinks: observability / SIEM** | Send events to security or operations tooling | Splunk and equivalent configured adapters |
| **Sinks: analytics** | Store events for aggregation and dashboards | ClickHouse |
| **Sinks: relational database** | Keep events in a table next to application data | PostgreSQL, the event stored as JSON in one column |

Order matters: apply privacy transformations before a sink that should never receive the original field. Keep sink credentials in deployment secrets, not in pipeline files.

#### ClickHouse

The ClickHouse sink targets analytics workloads — aggregations by tenant, event type and time
window. Pair `clickhouse_sink` with the `audit_clickhouse` transformer: the transformer flattens
the canonical event into one row whose keys are the table's column names, and the sink is pure
transport. Pairing the sink with `zero` instead will fail every delivery.

Create the database and table before enabling the pipeline; the sink never runs DDL.

```sql
CREATE DATABASE IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS audit.audit_events
(
    timestamp        DateTime64(3, 'UTC'),
    event_time       DateTime64(3, 'UTC'),
    event_id         UUID,
    correlation_id   String,

    event_type       LowCardinality(String),
    source_system    LowCardinality(String),
    tenant_id        LowCardinality(String),

    action_name      LowCardinality(String),
    action_status    LowCardinality(String),
    action_message   String,
    user_id          String,
    duration_ms      Nullable(UInt32),
    response_status  Nullable(UInt16),

    geo_lat          Nullable(Float64),
    geo_lon          Nullable(Float64),
    geo_country_code LowCardinality(String),
    geo_country      LowCardinality(String),
    geo_region       LowCardinality(String),
    geo_city         LowCardinality(String),

    extra            Map(LowCardinality(String), String),

    INDEX idx_ingest_time timestamp TYPE minmax GRANULARITY 4
)
ENGINE = ReplacingMergeTree(timestamp)
PARTITION BY toYYYYMM(event_time)
ORDER BY (tenant_id, event_type, event_time, event_id)
TTL toDateTime(event_time) + INTERVAL 1095 DAY;
```

`timestamp` is server *receipt* time — AuditFlow assigns it, a client cannot override it.
`event_time` is the *business* time the action happened at the source (the transformer falls back
to `timestamp` when a publisher omits it), and it is the analytics axis: `PARTITION BY`, `ORDER BY`
and `TTL` all key on `event_time`, not `timestamp`. Partitioning or grouping on `timestamp` instead
silently breaks any backfill or replay, because a late-arriving event then lands in the wrong
partition and the wrong retention window relative to when it actually happened.

`ORDER BY` leads with `tenant_id` because every dashboard query is tenant-scoped first. Tune
`PARTITION BY` and `TTL` to your retention policy — the values above are illustrative.

The table is a `ReplacingMergeTree` keyed on `event_id`, not a plain `MergeTree`: AuditFlow is
at-least-once, so a DLQ replay after the ~24h idempotency window can re-deliver an event, and
`ReplacingMergeTree` collapses the two copies on merge (the later `timestamp` wins as the version
column). That collapse only happens at merge time, so a query issued between deliveries can still
see both rows — use `SELECT ... FINAL` (or an aggregating rollup) for any query where
double-counting would matter, such as revenue.

```yaml
pipelines:
  - name: analytics
    enabled: true
    transformer:
      name: audit_clickhouse
    sink:
      name: clickhouse_sink
      properties:
        service-url: http://clickhouse:8123
        database: audit
        table: audit_events
        username: auditflow
        password: ${secretRef:clickhouse-password}
```

**Insert batching.** AuditFlow delivers one event per request, and row-at-a-time inserts into
MergeTree create one part per row. The sink relies on ClickHouse's server-side `async_insert` to
batch them, with `wait_for_async_insert=1` so a successful delivery means the row is durably
written and the retry/DLQ chain stays meaningful. This costs up to `async-insert-busy-timeout-ms`
of latency per delivery. Never set `wait-for-async-insert: false` to buy that latency back — it
makes the sink acknowledge events it may still lose.

Because every delivery blocks until its own flush, **the rows a flush can collect are bounded by
how many deliveries are in flight at once, not by how long the window is.** Measured against
ClickHouse 25.3, the largest flush always equalled the delivery concurrency. So the lever for
fewer parts is more concurrent delivery (more sink replicas, more consumer concurrency) — a longer
window only makes each caller wait longer, which lowers throughput and starves the very buffer it
was meant to fill. At 32 concurrent deliveries a 1000 ms window measured worse on every axis than
the 200 ms default: 24.7 vs 31.5 rows per flush, 24 vs 18 new parts, and 1016 ms vs 198 ms p50
delivery latency.

| Property | Default | Notes |
|---|---|---|
| `async-insert-busy-timeout-ms` | `200` | ClickHouse aliases this to `async_insert_busy_timeout_max_ms` — it sets the **max** of the window, not the window. Keep `timeout` (default 10s) comfortably above it. |
| `async-insert-use-adaptive-busy-timeout` | `true` | Since ClickHouse 24.2 the window floats between the min and the max based on ingest rate. Leaving it on keeps latency low when events are sparse. Set `false` to pin the window at the max: worth ~5.1 → 7.9 rows per flush and 52 → 35 parts *if* deliveries are genuinely concurrent, but it costs ~3.4× p50 latency if they are not. |
| `async-insert-busy-timeout-min-ms` | ClickHouse's `50` | Lower bound of the adaptive window; has no effect once the adaptive timeout is off. |

`async_insert_max_data_size` and `async_insert_max_query_number` are not exposed: both are ceilings
that can only flush a batch *earlier*, and neither is the binding constraint here — an audit row is
~473 bytes against a 10 MiB default, and ClickHouse only honours the query-number limit when
`async_insert_deduplicate` is enabled.

**Duplicates.** DLQ replay can re-deliver an event. AuditFlow's `eventId` deduplication (~24h)
absorbs the common case, and the table schema above absorbs the rest: it is a `ReplacingMergeTree`
keyed on `event_id`, not a plain `MergeTree`, so a re-delivered row is collapsed on merge rather
than counted twice. Deduplication happens only within a partition and only after merge, so a query
run between deliveries can still see both rows — use `FINAL` for anything where a duplicate would
matter, such as revenue.

## REST APIs

AuditFlow primarily consumes events from RabbitMQ, but also provides an API to publish directly or manage configurations.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/audit/publish` | `POST` | Publish a single event synchronously. |
| `/actuator/health`| `GET` | Health check endpoint. |

## Events

AuditFlow listens to the shared RabbitMQ exchange for all ecosystem events.

| Event Property | Required | Description |
|----------------|----------|-------------|
| `eventId` | Yes | Unique UUID for the event. |
| `eventType` | Yes | Dot-separated action name (e.g., `user.login`). |
| `tenantId` | No | Target tenant. If omitted, routes to `_platform`. |

## Examples

### Custom Transformer Plugin

Create a transformer to mask sensitive data (`transformers/mask.py`):

```python
def transform(input_data: dict) -> dict:
    if "email" in input_data.get("payload", {}):
        input_data["payload"]["email"] = "***@***.com"
    return input_data
```

## Operations

AuditFlow is designed to be horizontally scaled. Increase the `replicaCount` in your Helm chart to process more events concurrently. The underlying RabbitMQ queues will automatically distribute messages across the replicas.

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Events not reaching sink | Pipeline condition mismatch | Verify the `eventType` and `tenantId` match the pipeline definition. |
| Python plugin crash | Syntax error in plugin | Check the AuditFlow logs for Python tracebacks. Ensure the plugin implements the correct method signature. |
| RabbitMQ connection error | Bad credentials or network | Verify `SPRING_RABBITMQ_*` environment variables. |
