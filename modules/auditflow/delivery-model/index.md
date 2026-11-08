---
title: Delivery Model
parent: AuditFlow
grand_parent: Core Platform
nav_order: 6
---

# Delivery model: confirms, retries, backpressure and the DLQ

Two stages on the message broker (RabbitMQ or Amazon SQS, see [Message broker](https://github.com/Labs64/labs64.io-auditflow/blob/master/DEVELOPERS.md#message-broker-rabbitmq-or-amazon-sqs)), both in the backend:

1. **Ingest and route.** `POST /audit/publish` (or `/audit/publish/batch`) redacts the event and
   publishes it to the ingest queue, then waits until the broker **stored** it (RabbitMQ publisher
   confirm, SQS `SendMessage`): 200 means the broker has it; nothing within
   `auditflow.broker.confirm-timeout` (5 s) is a 503 the client retries with the same `eventId`. The
   router consumes the ingest queue and publishes **one delivery message per matching pipeline** to
   the delivery queue, again confirmed, before it acks the event. A message the router cannot handle
   is retried 3 times in place, then moved to the ingest DLQ (listed as `legacy` by the DLQ endpoint).
2. **Deliver.** The delivery worker consumes the delivery queue in batches and settles every
   message one way before acking it:

| Outcome | When | What happens |
|---|---|---|
| delivered | transformer and sink succeeded | the pipeline is marked done for the event (a duplicate is skipped) |
| deferred | pipeline rate limit, tenant in-flight cap, full bulkhead | parked in the 5 s tier, **no attempt spent** |
| retried | retryable failure (5xx, timeout, open circuit, missing secretRef) | parked in the next delay tier: 5 s, 30 s, 2 min, 10 min, 30 min, 1 h, then 3 h |
| dead-lettered | poison (4xx, malformed transformer output), `maxAttempts` used up, `maxAge` passed, pipeline removed | one entry in `labs64-audit-dlq.<tenant>` with reason, attempts and last error |
| quarantined | unparseable event, or the tenant was removed or disabled after ingest | kept in `labs64-audit-quarantine.quarantine` with an `x-quarantine-reason` header; never delivered to a sink, not replayed by the DLQ endpoint |

On RabbitMQ delays are queues with a fixed TTL that dead-letter back to the delivery exchange
(`labs64-audit-delay.<seconds>s`), so no broker plugin is needed and it works the same on Amazon MQ. On
SQS a delay is the message's own delivery delay. Per pipeline, in the tenant file:

```yaml
pipelines:
  - name: archive
    retry:
      maxAttempts: 20     # default auditflow.delivery.retry.max-attempts
      maxAge: 24h         # default auditflow.delivery.retry.max-age; also PT24H, 30m, 2d
    batch:
      enabled: true       # off by default
      maxSize: 100        # upper bound of events per sink call, 1-1000
```

**Sink batching.** With `batch.enabled` the worker groups the deliveries it received for a pipeline
of a tenant and calls the sink's `POST /sink/<id>/batch` once per group. The sink answers per event,
and each event is settled on its own (delivered, retried, deferred or dead-lettered), so a refused
event never fails the others.

- **`batch.enabled`** is the switch; `batch.maxSize` alone does nothing. `maxSize` is 1 to 1000
  (default 100); a value outside that range rejects the tenant file.
- **The size that is reached.** A group is cut from ONE batch a consumer received, so it never holds
  more than `auditflow.delivery.batch-size` (50) events, and fewer when that batch mixes pipelines or
  tenants. `GET /actuator/pipelines/<tenantId>` shows it as `batch.effectiveMaxSize`. For larger sink
  batches raise `AUDITFLOW_DELIVERY_BATCH_SIZE` together with `maxSize`.
- **When a batch closes.** When it is full, or after `auditflow.delivery.batch-receive-timeout` (1 s)
  without new messages, or, when `auditflow.delivery.batch-window` is set (off by default), once that
  long has passed since its first message (checked between messages, so up to one receive timeout later).
  Under light load batches are small and add up to 1 s of latency. The window trades latency for fewer,
  larger sink objects, for EVERY pipeline (they share one queue); the consumer also waits up to the
  receive timeout on shutdown, so keep that one short (seconds) and the window under a few minutes.
  Messages of a batch that is still gathering stay unacked, so a stopping pod hands them back to the
  broker; nothing is lost, and delivery marks keep a repeat from duplicating work.
- **Never across tenants.** Two tenants with a pipeline of the same name get separate calls.
- **One slot, one call.** A batch takes one slot of the tenant's in-flight cap and is one call for
  the bulkhead. The call has the same 10 s response timeout as a single event.
- **Retries.** Only the failed events of a batch are retried, each on its own schedule. They may come
  back grouped with other events, so a sink cannot count on seeing the same group twice.
- **Fallback sink.** The events that failed with a retryable error go to the fallback in one call.

What a sink does with a batch:

| Sink | One batch becomes | A repeat after a lost answer |
|---|---|---|
| `aws_s3_sink`, `gcs_sink`, `azure_blob_sink` | one JSON Lines object per partition folder | the same group overwrites its object; a different grouping can repeat an event in a second object |
| `clickhouse_sink` | one `INSERT ... FORMAT JSONEachRow` | merged away by the `ReplacingMergeTree` key of the example schema |
| `postgres_sink` | one multi-row `INSERT` in one transaction | skipped with a unique index on `eventId`, otherwise a second row |
| `snowflake_sink` | one connection and one multi-row `INSERT` | a second row |
| `opensearch_sink` | one `_bulk` request, an outcome per document | indexed again (ids are generated) |
| `aws_cloudwatch_sink` | one `PutLogEvents` call per 10,000 events or 1 MB; the group and stream are checked once | stored again |
| `datadog_sink` | one request per 1000 entries or 5 MB | stored again |
| `splunk_sink` | one HEC request | indexed again |
| `loki_sink` | one push, equal label sets merged and ordered by time | dropped by Loki when stream, time and line are equal |
| `logging_sink`, `webhook_sink`, `syslog_sink`, `netlicensing_sink` | the events through `process`, up to 8 at a time | as for single events |

For every destination that stores a repeat, readers de-duplicate by `eventId`. Batching pays off most
for ClickHouse and Snowflake (one insert instead of one per event), then for the object stores (one
object instead of thousands of small ones). For a sink in the last row it only saves calls between
the backend and the sink service; keep `maxSize` small there, so that the events fit into the 10 s
call (`maxSize` x the destination's latency / 8).

**Throughput.** An event mostly waits on the transformer and sink, so concurrency, not CPU, sets the
rate (CPU-based autoscaling does not react to a backlog).

| Setting | Default | Purpose |
|---|---|---|
| `AUDITFLOW_DELIVERY_CONCURRENCY` (env) / `auditflow.delivery.concurrency` | `4` | Delivery consumers per pod |
| `AUDITFLOW_DELIVERY_BATCH_SIZE` (env) / `auditflow.delivery.batch-size` | `50` | Messages a consumer takes at once (also its prefetch) |
| `auditflow.delivery.unit-concurrency` | `16` | Deliveries of one received batch run in parallel |
| `auditflow.circuitbreaker.bulkhead-max-concurrent-calls` | `128` | Concurrent calls per transformer/sink target; keep >= concurrency x unit-concurrency |
| `tenants.consumer.max-in-flight-per-tenant` | `32` | One tenant's deliveries at once per pod (fairness); over it, a delivery waits up to `max-wait-millis` (2 s), then is deferred |
| `AUDITFLOW_CONSUMER_CONCURRENCY` (env) | `8` | Router threads on the ingest queue (light work) |
| `AUDITFLOW_BROKER_QUEUE_TYPE` (env) / `auditflow.broker.queue-type` | `classic` | RabbitMQ: `quorum` for replicated queues on a multi-node broker |

A local run (one pod, single-process transformer and sink) delivered 3,000 events, half of them
through a batching pipeline, in about 6 s end to end. Fairness between tenants comes first from the
ingest quota (`rateLimitPerSec`/`burst`), then from the in-flight cap.

**Metrics:** `auditflow.delivery.outcomes{tenant,pipeline,outcome}` (delivered, deferred, retried,
duplicate), `auditflow.delivery.deadlettered{tenant,pipeline,reason}`, `auditflow.delivery.batch.size`,
`auditflow.pipeline.duration{pipeline,outcome,mode}`, `auditflow.delivery.latency{tenant,pipeline}` (enqueued to
delivered, retries included; histogram buckets 1 s … 3 h). Alert on `deadlettered` > 0 and on the depth of the
tenant DLQs; a delivery-freshness SLO reads the 5-minute bucket:
`auditflow_delivery_latency_seconds_bucket{le="300.0"}` over `auditflow_delivery_latency_seconds_count` is the
share delivered within 5 minutes. Every pipeline's `ENQUEUED` (`auditflow.pipeline.outcomes`) ends as delivered,
duplicate or dead-lettered: a gap between the two over a few hours is deliveries lost without an error.

