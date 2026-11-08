---
title: Troubleshooting
parent: AuditFlow
grand_parent: Core Platform
nav_order: 7
---

# Troubleshooting

## Backend won't start

**Symptom:** `APPLICATION FAILED TO START` in logs.

1. **Check the broker is reachable** (on SQS: `/actuator/health` shows the `sqs` component, and the backend log names an `AccessDenied` or a missing queue). RabbitMQ:
   ```bash
   docker logs auditflow-rabbitmq | tail -5
   curl -s http://localhost:15673/api/overview | head
   ```

2. **Check credentials:** `RABBITMQ_USERNAME` and `RABBITMQ_PASSWORD` must be set (no defaults by design).

3. **Check port conflicts:**
   ```bash
   lsof -i :8080 -i :8081 -i :8082 -i :5673 -i :15673
   ```

## Sink returns 422 Unprocessable Content

**Symptom:** Backend logs show `422 Unprocessable Content from POST http://sink:8082/sink/{name}`.

This usually means the request body format doesn't match what the sink expects. The backend sends:
```json
{"event_data": {...}, "properties": {...}}
```
The sink's `/sink/{name}` endpoint must accept this structure as a single JSON body.

## Sink returns 500 Internal Server Error

**Symptom:** Sink logs show `An unexpected error occurred in sink endpoint`.

Check the full traceback in sink logs:
```bash
just log sink
```

Common causes:
- Missing Python package in `requirements.txt`
- Sink module has a bug in its `process()` function
- External service (e.g., S3, Loki) is unreachable

## Transformer returns 500

Same approach — check `just log transformer` for the full traceback.

## Events not being consumed

**Symptom:** Events published but sink logs show nothing.

1. Check the consumer is subscribed:
   ```bash
   just log backend | grep "subscriber"
   ```

2. Check RabbitMQ queue depth:
   - Open http://localhost:15673
   - Go to Queues → `labs64-audit-topic.labs64.io-auditflow`
   - If Ready count keeps growing, the consumer is failing

3. Check for circuit breaker open state:
   ```bash
   curl -s http://localhost:8080/actuator/metrics | grep circuitbreaker
   ```

## Dead Letter Queue filling up

A delivery lands in its tenant's DLQ (`labs64-audit-dlq.<tenant>`) when it is poison, used up its
pipeline's `retry.maxAttempts`, passed `retry.maxAge`, or its pipeline was removed. Each entry is one
pipeline of one event, with `x-auditflow-dlq-reason` and `x-auditflow-last-error` headers. Entries
from before per-pipeline delivery, and events whose routing failed, sit in the legacy shared queue
`labs64-audit-topic.labs64.io-auditflow.dlq`; the same endpoint covers both. Every operation requires
a `{tenantId}` selector (use `_platform` for tenantless events); there is no un-scoped
`/actuator/dlq` path. Check the DLQ for a tenant (`byReason` tells poison from outages):

```bash
curl -s http://localhost:8080/actuator/dlq/<tenantId> | python3 -m json.tool
```

Once the cause is fixed, replay that tenant's entries (or one pipeline's):
```bash
curl -X POST http://localhost:8080/actuator/dlq/<tenantId> | python3 -m json.tool
curl -X POST http://localhost:8080/actuator/dlq/<tenantId> -H 'Content-Type: application/json' \
     -d '{"pipeline":"archive"}' | python3 -m json.tool
```

Purge (discard, don't replay) that tenant's entries, or one pipeline's — **irreversible**; every
discarded entry is logged with its event id:
```bash
curl -X DELETE http://localhost:8080/actuator/dlq/<tenantId> | python3 -m json.tool
curl -X DELETE "http://localhost:8080/actuator/dlq/<tenantId>?pipeline=archive" | python3 -m json.tool
```

## Container healthcheck failing

The healthchecks use `wget` to hit `/health` on each service. If a container shows unhealthy:

1. Check if the process is running:
   ```bash
   docker exec auditflow-transformer ps aux
   ```

2. Test the health endpoint from inside the container:
   ```bash
   docker exec auditflow-transformer wget -qO- http://127.0.0.1:8081/health
   ```

3. Check for import errors (e.g., missing `health.py` in the image):
   ```bash
   docker exec auditflow-transformer ls /home/l64user/health.py
   ```

## Idempotency: events being dropped unexpectedly

The idempotency guard uses `eventId` as the dedup key. If you're sending events without an `eventId`, they won't be deduplicated — but they also won't be protected against redelivery duplicates.

Check the current claim TTL (default 5 minutes):
```bash
curl -s http://localhost:8080/actuator/metrics | grep deduplicated
```

## Publish returns 400 "eventTime ... is in the future" / "too old"

`eventTime` is when the action happened, and ingest only accepts a plausible one: not later than the receipt
time plus `auditflow.event-time.max-future` (5 minutes of clock skew) and not older than `max-age` (1095 days).
A future value means the publisher's clock is ahead (or it sent a deadline, which belongs in `extra`); a too-old
one is a backfill beyond what the sinks keep. Fix the clock, or omit `eventTime` to use the receipt time. A
backfill that is legitimate and older than three years needs `max-age` raised **and** a sink retention that
keeps it (ClickHouse expires rows 1095 days after `event_time`). See [Time fields](https://github.com/Labs64/labs64.io-auditflow/blob/master/DEVELOPERS.md#time-fields-event-time-and-receipt-time).
