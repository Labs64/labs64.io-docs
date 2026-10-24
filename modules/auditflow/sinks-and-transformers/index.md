---
title: Sinks and transformers
parent: AuditFlow
grand_parent: Core Platform
nav_order: 4
---

# Sinks and transformers

Sinks deliver events to destinations; transformers reshape or enrich an event before delivery. Both are Python modules discovered at runtime.

The shipped catalogue below covers common formats and destinations. For a proprietary format, an internal system or a destination only your organisation runs, you write a small module and own it (see [Adding your own sink or transformer](#adding-your-own-sink-or-transformer)). The backend still applies tenant isolation, redaction, idempotency, retries and the dead-letter queue to its deliveries. If you are unsure which side a need falls on, or neither fits, [open an issue](https://github.com/Labs64/labs64.io-auditflow/issues) and describe it.

A pipeline passes an event through its transformers, if it has any, and then into one sink. `GET /registry` on the transformer service (port 8081) and on the sink service (port 8082) lists the modules of a deployment with their version and documented properties, and the modules that failed to import.

![AuditFlow components: the backend stores each event on RabbitMQ or Amazon SQS and routes it to one delivery per matching pipeline, and its delivery worker calls the transformer service and then the sink service, which writes to the destinations](../diagrams/auditflow.svg)

## Sinks

| Sink | Destination | A batch is written as |
|------|-------------|-----------------------|
| `logging_sink` | Log output (dev/testing) | one event at a time |
| `webhook_sink` | HTTP POST to any URL | one event at a time |
| `syslog_sink` | RFC 5424 syslog | one event at a time |
| `loki_sink` | Grafana Loki | one push, equal label sets merged |
| `opensearch_sink` | OpenSearch / Elasticsearch | one `_bulk` request |
| `aws_s3_sink` | Amazon S3 | one JSON Lines object per partition folder (the receipt day) |
| `aws_cloudwatch_sink` | Amazon CloudWatch Logs | one `PutLogEvents` call |
| `gcs_sink` | Google Cloud Storage | one JSON Lines object per partition folder (the receipt day) |
| `azure_blob_sink` | Azure Blob Storage | one JSON Lines blob per partition folder (the receipt day) |
| `datadog_sink` | Datadog Logs API | one request, up to 1000 entries |
| `splunk_sink` | Splunk HTTP Event Collector | one request |
| `snowflake_sink` | Snowflake (via the Python connector, not bundled) | one connection and one multi-row insert |
| `clickhouse_sink` | ClickHouse table over the HTTP interface; pair it with the `audit_clickhouse` transformer | one multi-row insert |
| `postgres_sink` | PostgreSQL table; the event is stored as JSON in an `event_data` column | one multi-row insert in one transaction |
| `netlicensing_sink` | Licensing-platform integration: turns completed checkout transactions into licensee and license records; requires `extra.transaction` | one event at a time |

The last column applies to pipelines with `batch.enabled: true`. `GET /registry` on the sink service reports the same per sink as `batch: true|false`.

Sink properties (URLs, buckets, table names) are set per pipeline under `sink.properties`. Write every credential as a `${secretRef:<key>}` reference; see [Sink credentials](../configuring-pipelines/index.md#sink-credentials). `aws_s3_sink`, `aws_cloudwatch_sink` and `gcs_sink` fall back to the cloud SDK's default credentials, such as the pod's IAM role, when you set no keys. `snowflake_sink` needs the `snowflake-connector-python` package, which the sink image does not contain.

### Tamper-evident archive (S3)

`aws_s3_sink` sends an S3-verified SHA-256 checksum with every object (`checksum: none` turns it off for S3-compatible stores without checksum support). With `digest: "true"` it also writes a signed, hash-chained digest record per object under `<prefix>tenant=<id>/_digests/`. Each record holds the object key, its SHA-256, the event ids, the previous record's hash and an Ed25519 signature.

```bash
python3 auditflow-sink/scripts/verify_s3_digests.py --generate-key     # once: seed and public key
```

Store the seed in the tenant's secret store and reference it, never as a literal:

```yaml
sink:
  name: aws_s3_sink
  properties: {bucket: my-audit-archive, prefix: tenants/, digest: "true", digest-signing-key: "${secretRef:digestSigningKey}"}
```

An auditor with the public key, `s3:ListBucket` and `s3:GetObject` checks every signature, sequence and link, and every attested object's SHA-256, with [`verify_s3_digests.py`](https://github.com/Labs64/labs64.io-auditflow/blob/master/auditflow-sink/scripts/verify_s3_digests.py) (`--unattested` also fails on objects no record covers). The chain alone cannot detect removal of a chain's newest records; enable S3 Object Lock on the bucket for that. A digest record per object doubles the writes of a pipeline that stores one object per event, so combine digests with `batch.enabled`.

### Which time each sink uses

An event has an **event time** (`eventTime`, when the action happened) and a **receipt time** (`timestamp`, when AuditFlow received it); see [Time fields](../index.md#time-fields-event-time-and-receipt-time). Every bundled sink and transformer uses them the same way, and none uses the moment of delivery.

| Destination | Time used |
|---|---|
| ClickHouse, OpenSearch | both, as `event_time` and `timestamp`; reports group on `event_time` |
| Loki, Splunk, syslog | the entry sits at the **event time** |
| CloudWatch Logs | the entry sits at the **receipt time**: CloudWatch refuses entries older than 14 days, so an old `eventTime` stays inside the message |
| S3, Google Cloud Storage, Azure Blob | folders and object names use the **receipt day** (UTC), so a publisher cannot choose where its data lands and a backfill lands in today's folder; `eventTime` is inside each object |
| PostgreSQL | both inside `event_data`; the `inserted_at` column of the example table is the write time and is never a reporting axis |
| Datadog, webhook, logging, Snowflake | the event as it is, with both times inside; the destination applies its own date handling (point Datadog's Log Date remapper at `eventTime` to date logs by event time) |

To read an archive by the day things happened, filter on `eventTime` inside the objects: the date folders are the receipt day, and a late arrival sits in a later folder.

On Kubernetes with the chart's NetworkPolicy enabled, the pod may only reach HTTPS (port 443) outside the platform services. A sink whose destination listens on another port (ClickHouse 8123 or 8443, PostgreSQL 5432, syslog, Splunk HEC 8088, Loki 3100, OpenSearch 9200) needs a matching `networkPolicy.extraEgress` rule in the chart values.

## Transformers

| Transformer | What it does |
|-------------|-------------|
| `zero` | Pass-through (no change). The backend applies it itself without calling the transformer service, so a custom module named `zero` is never called. |
| `audit_loki` | Reshape event for Loki label conventions |
| `audit_opensearch` | Reshape event for OpenSearch indexing |
| `audit_clickhouse` | Flatten event into one ClickHouse row; extensible per use case via `make_transform()` |

A domain layer on top of `audit_clickhouse` is a mounted example, not shipped in the image: see
[Modelling your own domain](#modelling-your-own-domain).

## Adding your own sink or transformer

A module is one Python file, referenced from a pipeline by its file name without `.py`. The shipped modules live in `sinks/` and `transformers/` inside the images. Put your own into `sinks_bootstrap/` or `transformers_bootstrap/` next to them (`/home/l64user/` in the images), mounted at runtime as a volume or ConfigMap, so you rebuild no image and change no backend code. A mounted module with the same name as a shipped one replaces it.

Each service builds its list of allowed modules at startup. After mounting a new module, restart the service or call `POST /registry/reload` on it. A module name must match `^[a-zA-Z0-9_]+$`.

```python
# sinks/my_sink.py
def process(event_data: dict, properties: dict) -> dict:
    # event_data: the audit event JSON
    # properties: pipeline-specific config from sink.properties
    return {"sent": True}
```

A transformer has one function, which returns the reshaped event:

```python
# transformers_bootstrap/my_transformer.py
def transform(input_data: dict) -> dict:
    return input_data
```

Then reference it by filename (without `.py`) in a pipeline:

```yaml
sink:
  name: my_sink
  properties:
    api-key: "${secretRef:myApiKey}"
```

- An exception in `process` fails the delivery as retryable.
- For pipelines with `batch.enabled`, a sink can also define `process_batch(events: list, properties: dict) -> list`. It returns one outcome per event, in input order: a result dict, or an exception. A `ValueError` marks that event as poison and sends it to the DLQ; any other exception is retried. Without `process_batch`, the sink service calls `process` for the events, up to 8 at a time.
- A sink that puts a table, column or database name into SQL text checks it with `auditflow_sdk.sql_identifier`, and passes event data only as bound parameters.

See [DEVELOPERS.md](https://github.com/Labs64/labs64.io-auditflow/blob/master/DEVELOPERS.md) for full details on the plugin API, transformer chaining, and testing.

## ClickHouse

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
`event_time` is the *business* time the action happened at the source (AuditFlow sets it to the receipt
time when a publisher omits it, so it is never empty), and it is the analytics axis: `PARTITION BY`, `ORDER BY`
and `TTL` all key on `event_time`, not `timestamp`. Partitioning or grouping on `timestamp` instead
silently breaks any backfill or replay, because a late-arriving event then lands in the wrong
partition and the wrong retention window relative to when it actually happened.

`ORDER BY` leads with `tenant_id` because every dashboard query is tenant-scoped first. Tune
`PARTITION BY` and `TTL` to your retention policy — the values above are illustrative.

The table is a `ReplacingMergeTree` keyed on `event_id`, not a plain `MergeTree`: AuditFlow is
at-least-once, so a DLQ replay after the idempotency window (`auditflow.idempotency.done-ttl`, 48 hours) can re-deliver an event, and
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
        password: ${secretRef:clickhousePassword}
```

**Insert batching.** Turn on `batch.enabled` for the pipeline: the sink then writes each batch
with one `INSERT`. Without it, AuditFlow delivers one event per request, and row-at-a-time inserts into
MergeTree create one part per row. In both modes the sink relies on ClickHouse's server-side `async_insert` to
merge inserts, with `wait_for_async_insert=1` so a successful delivery means the row is durably
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

**Duplicates.** DLQ replay can re-deliver an event. AuditFlow's `eventId` deduplication (48 hours)
absorbs the common case, and the table schema above absorbs the rest: it is a `ReplacingMergeTree`
keyed on `event_id`, not a plain `MergeTree`, so a re-delivered row is collapsed on merge rather
than counted twice. Deduplication happens only within a partition and only after merge, so a query
run between deliveries can still see both rows — use `FINAL` for anything where a duplicate would
matter, such as revenue.

In the local Docker Compose stack, `just ch-seed` publishes a synthetic event stream, `just ch-events` shows the latest events and `just ch "<SQL>"` runs your own query.

## Modelling your own domain

The ClickHouse transformer and schema are **generic**: they promote the well-known audit-semantics keys into columns and leave everything else in a `Map(String, String)`. A use case that wants its own fields as queryable dimensions adds a layer instead of changing the core: a key map on top of the shipped transformer, an `ALTER TABLE` script and a documented vocabulary.

| Layer | Generic (shipped) | Use-case layer (the repository's worked example) |
|---|---|---|
| Columns | [`schema.sql`](https://github.com/Labs64/labs64.io-auditflow/blob/master/examples/clickhouse/schema.sql) | an `ALTER TABLE ... ADD COLUMN` script, for example [`schema-netlicensing.sql`](https://github.com/Labs64/labs64.io-auditflow/blob/master/examples/clickhouse/schema-netlicensing.sql) |
| Promotion | `audit_clickhouse` | a module of about 40 lines of data: `make_transform({...})`, for example [`audit_clickhouse_netlicensing.py`](https://github.com/Labs64/labs64.io-auditflow/blob/master/examples/netlicensing/audit_clickhouse_netlicensing.py) |
| Vocabulary | `Extra` in the API contract | a field and event reference, for example [`NETLICENSING_EVENTS.md`](https://github.com/Labs64/labs64.io-auditflow/blob/master/examples/clickhouse/NETLICENSING_EVENTS.md) |
| Pipeline | `tenants/_platform.yaml` | a tenant file that selects the layered transformer |

The example layer is mounted into the transformer's bootstrap directory rather than baked into the image, which is the same extension point you use for your own. Both pipelines write to the same table, so the compose stack shows the two side by side. The worked example models a licensing business (entity lifecycle and validation events plus a payment lifecycle) with the `extra` keys each event emits and the ClickHouse queries built on them. It is deliberately not a full analytics model: no recurring-revenue, retention or cohort machinery. It shows what ClickHouse gives you over a log line, and leaves the reporting model to the deployment.

Rules to preserve when you build a layer:

- **Never add a domain key to the generic transformer or a domain column to the generic schema.** Extend with `make_transform()` and an `ALTER TABLE` script. A transformer takes no pipeline properties, so the module id selects a vocabulary: one module per domain.
- **Every promoted key needs a column and every column a promoted key**, or the pairing silently half-works.
- **`event_time` is the analytics axis**, `timestamp` is receipt time.
- **Never redact a key that is promoted to a reporting dimension**: a redacted column reads as empty, not as an error.
