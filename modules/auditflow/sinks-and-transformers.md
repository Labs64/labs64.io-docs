---
title: Sinks and Transformers
parent: AuditFlow
nav_order: 2
---

# Sinks and Transformers

A pipeline delivers an event through an optional chain of **transformers**, which reshape it, into one **sink**, which writes it to a destination. Both are Python modules that AuditFlow loads by name at runtime. `GET /registry` on the transformer service (`:8081`) and the sink service (`:8082`) lists the modules available in a deployment, with their properties.

## Built-in sinks

| Sink | Destination | With `batch.enabled`, a batch is written as |
|---|---|---|
| `logging_sink` | Container log (development) | one event at a time |
| `webhook_sink` | HTTP POST to any URL | one event at a time |
| `syslog_sink` | RFC 5424 syslog | one event at a time |
| `loki_sink` | Grafana Loki | one push, equal label sets merged |
| `opensearch_sink` | OpenSearch / Elasticsearch | one `_bulk` request |
| `aws_s3_sink` | Amazon S3 | one JSON Lines object per partition folder |
| `aws_cloudwatch_sink` | Amazon CloudWatch Logs | one `PutLogEvents` call |
| `gcs_sink` | Google Cloud Storage | one JSON Lines object per partition folder |
| `azure_blob_sink` | Azure Blob Storage | one JSON Lines blob per partition folder |
| `datadog_sink` | Datadog Logs API | one request, up to 1000 entries |
| `splunk_sink` | Splunk HTTP Event Collector | one request |
| `snowflake_sink` | Snowflake (Python connector not bundled) | one multi-row insert |
| `clickhouse_sink` | ClickHouse over HTTP; pair with `audit_clickhouse` | one multi-row insert |
| `postgres_sink` | PostgreSQL table, event as JSON in `event_data` | one multi-row insert in one transaction |
| `netlicensing_sink` | Labs64 NetLicensing | one event at a time |

Sink properties (URLs, buckets, credentials) are set per pipeline under `sink.properties`. Credentials are `${secretRef:<key>}` references; see [Pipelines and tenants](./pipelines.md#sink-credentials).

On Kubernetes with the chart's NetworkPolicy enabled, AuditFlow may only reach port 443 outside the platform services. A sink on another port (ClickHouse 8123/8443, PostgreSQL 5432, syslog, Splunk HEC 8088, Loki 3100, OpenSearch 9200) needs a matching `networkPolicy.extraEgress` rule.

### Tamper-evident archive (S3)

The S3 sink stores an S3-verified SHA-256 with every object. With `digest: "true"` and an Ed25519 `digest-signing-key` (as a `${secretRef:…}`), it also writes a signed, hash-chained digest record per object under `<prefix>tenant=<id>/_digests/`. An auditor with the public key can prove that no archived object was altered and none was removed, using `auditflow-sink/scripts/verify_s3_digests.py`. Combine it with S3 Object Lock for a write-once archive.

## Built-in transformers

| Transformer | What it does |
|---|---|
| `zero` | Pass-through |
| `audit_loki` | Shapes the event for Loki labels |
| `audit_opensearch` | Shapes the event for OpenSearch indexing |
| `audit_clickhouse` | Flattens the event into one ClickHouse row |

Omit the transformer to deliver the event unchanged, or list several under `transformers` to apply them in order.

## Promote your own `extra` keys

The bundled transformers promote the convention keys of `extra` (`userId`, `actionName`, `actionStatus`, `actionMessage`, `sessionId`, `durationMs`, `responseStatus`) into dedicated fields and columns. Promotion is what turns a key into a queryable report dimension; all other keys still reach the sink, in its metadata map.

To promote your own keys, use either path:

```python
# A transformer module built on a bundled one: per pipeline, one module per domain.
from audit_clickhouse import make_transform
transform = make_transform({"orderRef": "order_ref", "carrier": "carrier"}, module_id=__name__)
```

```yaml
# Configuration only, on the transformer container: deployment-wide, no code.
AUDITFLOW_PROMOTED_KEYS: '{"orderRef": "order_ref", "carrier": "carrier"}'
```

Precedence runs from the built-in vocabulary, to the `make_transform()` argument, to `AUDITFLOW_PROMOTED_KEYS`, to `AUDITFLOW_PROMOTED_KEYS_<MODULE_ID>`. A malformed mapping makes the module fail to load, so it shows up as missing in `GET /registry` instead of silently dropping a column.

A promoted key needs a matching column in the destination. For ClickHouse that is an `ALTER TABLE … ADD COLUMN`; without it the value is **silently dropped at insert**.

The AuditFlow repository ships a worked example of such a layer for NetLicensing API and Payment Gateway events (`examples/clickhouse/` and `examples/netlicensing/`): an extra-columns script, a promoting transformer and the event vocabulary with queries.

## Write your own

Drop a Python file into the plugin directory and reference it by file name (without `.py`) in a pipeline. Built-in modules live in `sinks/` and `transformers/`; your own go into `sinks_bootstrap/` and `transformers_bootstrap/`, mounted at runtime (a volume or ConfigMap on Kubernetes), so no image rebuild is needed.

```python
# sinks_bootstrap/my_sink.py
def process(event_data: dict, properties: dict) -> dict:
    # event_data: the (transformed) audit event
    # properties: sink.properties of the pipeline, secretRefs resolved
    return {"sent": True}
```

```python
# transformers_bootstrap/my_transformer.py
def transform(input_data: dict) -> dict:
    return input_data
```

```yaml
sink:
  name: my_sink
  properties:
    api-key: "${secretRef:myApiKey}"
```

- Raising `ValueError` marks the event as poison: it is dead-lettered without retries. Any other exception is retried.
- For pipelines with `batch.enabled`, a sink may also provide `process_batch(events: list, properties: dict) -> list`, returning one result (a dict, or an exception) per event in input order. Without it, AuditFlow calls `process` for each event.
- A sink that builds SQL from table, column or database names validates them with `auditflow_sdk.sql_identifier`; event data is always a bound parameter.
- Module names must match `^[a-zA-Z0-9_]+$`.

## ClickHouse

The default Docker Compose stack runs ClickHouse as a queryable sink: `just ch-seed` publishes a synthetic event stream, `just ch-events` shows the latest events and `just ch "<SQL>"` runs your own query.


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
    session_id       String,
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
