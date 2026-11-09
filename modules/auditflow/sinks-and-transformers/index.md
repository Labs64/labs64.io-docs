---
title: Sinks and transformers
parent: AuditFlow
grand_parent: Core Platform
nav_order: 4
---

# Sinks and transformers

Sinks deliver events to destinations; transformers reshape or enrich an event before delivery. Both are Python modules discovered at runtime.

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

### Table, column and database names

`postgres_sink`, `clickhouse_sink` and `snowflake_sink` put these names into the SQL text, where a
bound parameter is not possible. They come from the tenant file, never from an event, and are checked
before anything is sent: only a plain identifier is accepted (a letter or underscore, then letters,
digits and underscores). A name that needs quoting (a space, a dash, a quote, a keyword in quotes)
is refused with `Invalid table name '...'`; rename it or point the sink at a view.

| Sink | Property | Accepted |
|---|---|---|
| `postgres_sink` | `table` | `table` or `schema.table`, at most 63 characters per part |
| `clickhouse_sink` | `database`, `table` | one identifier each |
| `snowflake_sink` | `table` | `TABLE`, `SCHEMA.TABLE` or `DATABASE.SCHEMA.TABLE`; `$` allowed after the first character |
| `snowflake_sink` | `column` | one identifier; `$` allowed after the first character |

A refused name fails the delivery as retryable, like a missing property: the events wait in the retry
queues and go through once the tenant file is fixed. A sink of your own can use the same check,
`auditflow_sdk.sql_identifier`.

### `clickhouse_sink`

Inserts over the ClickHouse HTTP interface. It expects a row whose keys are column names, so pair it
with the `audit_clickhouse` transformer; with `zero` every delivery fails. Turn on `batch.enabled` for
this sink: a batch is ONE `INSERT ... FORMAT JSONEachRow`, which is what MergeTree wants. Without it
every event is its own insert and the sink relies on server-side `async_insert` to merge them.
Properties, schema and tuning are in [ClickHouse (analytics sink)](https://github.com/Labs64/labs64.io-auditflow/blob/master/DEVELOPERS.md#clickhouse-analytics-sink).

### `postgres_sink`

Inserts the event as JSON into the `event_data` column of a table you create:

```sql
CREATE TABLE audit_events (id BIGSERIAL PRIMARY KEY, inserted_at TIMESTAMPTZ NOT NULL DEFAULT now(), event_data JSONB NOT NULL);
-- inserted_at is the delivery time. Report on the event's own times: event_data->>'eventTime' (when it happened)
-- and event_data->>'timestamp' (when AuditFlow received it).
-- optional: a redelivered event becomes a no-op instead of a second row
CREATE UNIQUE INDEX audit_events_event_id ON audit_events ((event_data->>'eventId'));
```

```yaml
batch: {enabled: true, maxSize: 100}      # one multi-row INSERT per batch
sink:
  name: postgres_sink
  properties:
    host: postgres.example.internal
    port: "5432"                          # default 5432
    database: audit
    user: auditflow
    password: "${secretRef:postgresPassword}"
    table: audit_events                   # or schema.table
    connect-timeout: "10"                 # seconds, default 10
```

- **Table name.** A plain identifier, optionally `schema.table`
  (see [Table, column and database names](#table-column-and-database-names)). Anything else is refused
  before a connection is opened. The event is always a bound parameter, never part of the SQL text.
- **Connections are reused.** Up to 4 idle connections are kept per host, port, database, user and
  password in each sink process. A connection the server closed while it was idle is replaced and the
  insert repeated once.
- **Batch.** One `INSERT` with a row per event, in one transaction. If the database refuses one event's
  data (for example a `\u0000` in a string, which `jsonb` cannot store), the events are inserted one
  by one: the others are stored and the refused one is dead-lettered as poison. A constraint violation
  is handled the same way, but that event stays retryable.
- **Repeats.** The insert uses `ON CONFLICT DO NOTHING`. With the unique index above a redelivered
  event is skipped; without it a repeat adds a row.

Only `event_data` is written; the other columns must have defaults. The table is the system of record
here, AuditFlow itself still stores nothing.

On Kubernetes with the chart's NetworkPolicy enabled, both need a `networkPolicy.extraEgress` rule for
the destination port (ClickHouse 8123 or 8443, PostgreSQL 5432); only 443 is open by default.

### `aws_s3_sink` object keys

One object per event: `<prefix>[tenant=<tenantId>/]<partition-format>/<yyyymmdd-HHMMSS>-<eventId>.json[.gz]`.
`partition-format` is a `strftime` pattern (default `year=%Y/month=%m/day=%d/`) and may also contain
`{field}` placeholders, a dotted path into the event, so event fields can become folders:

```yaml
prefix: tenants/
partition-format: "vendor_number={extra.vendorNumber}/year=%Y/month=%m/day=%d/eventType={eventType}/actionName={extra.actionName}/"
# -> tenants/tenant=acme/vendor_number=V1/year=2026/month=10/day=02/eventType=api.call/actionName=product_create/<ts>-<id>.json
```

Values are sanitized to `[A-Za-z0-9._-]` (every other character, such as `/` in `product/create`, becomes
`_`) and cut at 128 characters; a missing or null value becomes `unknown`. An `extra.<key>` placeholder
falls back to the top-level key, where a promoting transformer moves well-known keys. The format is applied
only when `partition-by-date` is `true`, and a mistyped placeholder is left in the key as literal text.

A placeholder can take a default and a list of allowed values, for a folder that something else relies on, such
as an S3 lifecycle rule per retention class:

```yaml
partition-format: "retention={extra.payloadRetentionDays|default=30|allowed=7,14,30,90,365}/year=%Y/month=%m/day=%d/"
# extra.payloadRetentionDays 14 -> retention=14/   missing or 45 -> retention=30/
```

`default` replaces a missing value; with `allowed`, also a value outside the list. Each time it is used the sink
logs a warning naming the field (never the value) and adds the span event `auditflow.partition.defaulted`.
`allowed` needs a `default` that is one of the allowed values; a wrong option fails the write, so it shows in the
DLQ instead of producing an unexpected key.

The sink returns `context: {bucket, key}` for every event, single or batched: the object that holds it. A
pipeline with [steps](../configuring-pipelines/index.md#pipeline-steps-and-the-step-context) hands that to its next step, for example to store
where the event is archived.

## Transformers

| Transformer | What it does |
|-------------|-------------|
| `zero` | Pass-through (no change) |
| `audit_loki` | Reshape event for Loki label conventions |
| `audit_opensearch` | Reshape event for OpenSearch indexing |
| `audit_clickhouse` | Flatten event into one ClickHouse row; extensible per use case via `make_transform()` |

`zero` never reaches the transformer service: the backend applies it itself (its output is its input),
which saves an HTTP round trip per event and pipeline. A module mounted under the name `zero` is
therefore never called; give a custom transformer its own name.

A domain layer on top of `audit_clickhouse` is a mounted example, not shipped in the image: see
[Modelling your own domain](#modelling-your-own-domain).

## Adding your own sink or transformer

Drop a `.py` file into `sinks/` or `transformers/`. It's discovered at runtime — no backend changes, no image rebuild for local development.

```python
# sinks/my_sink.py
def process(event_data: dict, properties: dict) -> dict:
    # event_data: the audit event JSON
    # properties: pipeline-specific config from sink.properties
    return {"sent": True}
```

Then reference it by filename (without `.py`) in a pipeline:

```yaml
sink:
  name: my_sink
  properties:
    api-key: "${MY_API_KEY}"
```

See [DEVELOPERS.md](https://github.com/Labs64/labs64.io-auditflow/blob/master/DEVELOPERS.md) for full details on the plugin API, transformer chaining, and testing.

## Writing a batch in one call (optional)

A pipeline with `batch.enabled` sends its sink several events per call. A sink that only has `process`
gets them through it, up to 8 at a time. A sink whose destination takes many records per request
should also define `process_batch`:

```python
from auditflow_sdk import RejectedEvent, deliver_each

def process_batch(events: list, properties: dict) -> list:
    """Return ONE outcome per event, in input order: a result dict, or an Exception."""
    try:
        send_all(events, properties)               # one request to the destination
    except DestinationRefusedTheData:              # one event is bad: deliver the others
        return deliver_each(events, properties, process)
    except Exception as e:                         # nothing was stored
        return [e] * len(events)
    return [{"sent": True}] * len(events)
```

| Outcome of an event | What the backend does |
|---|---|
| a dict (or `None`) | delivered |
| an `Exception` that is a `ValueError` (`RejectedEvent` is one) | dead-lettered at once as poison: the destination refused this event's data |
| any other `Exception` | retried with the usual delays |
| `process_batch` itself raises | every event of the call is retried; use it for a missing property, which an operator can fix while the events wait |

Delivery is at-least-once. A batch whose answer is lost is sent again, and its events may then be
grouped with others. Make a repeat harmless where the destination allows it (a deterministic object
name, a key the destination de-duplicates on); otherwise readers de-duplicate by `eventId`.
`auditflow_sdk` has the helpers the shipped sinks use: `deliver_each`, `chunk_indexes` (split by count
and bytes), `batch_object_name` and `jsonl_body`. `GET /registry` shows `batch: true` for a sink with
`process_batch`.

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
