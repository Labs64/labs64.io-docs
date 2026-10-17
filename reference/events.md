---
title: Event Catalogue
parent: Reference
nav_order: 2
---

# Event Catalogue

Modules deliver audit events to [AuditFlow](../modules/auditflow/index.md) over its HTTP API, authenticated as a service principal (`service:<module>`). AuditFlow buffers them on its own RabbitMQ broker and routes them per tenant. Only AuditFlow depends on a message broker.

## Standard Event Envelope

All events are AuditFlow audit events with a common envelope:

```json
{
  "eventId": "uuid-string",
  "eventTime": "ISO-8601-string",
  "timestamp": "ISO-8601-string",
  "eventType": "domain.entity.action",
  "sourceSystem": "string",
  "tenantId": "string",
  "correlationId": "string-or-null",
  "extra": { ... }
}
```

`eventTime` is **when the action happened**; the publisher sets it, and AuditFlow uses the receipt time when it is omitted. `timestamp` is **when AuditFlow received the event**; AuditFlow sets it and ignores a client value. Reports group on `eventTime`; `timestamp` orders arrival and versions duplicates. Details and limits: [Time fields](../modules/auditflow/index.md#time-fields-event-time-and-receipt-time).

## Known Event Types

| Event Type | Producer | Description |
|------------|----------|-------------|
| `payment.created` | Payment Gateway | A payment was created. |
| `payment.finalized` | Payment Gateway | A payment transaction reached a final result. |
| `payment.closed` | Payment Gateway | A payment was closed. |

Payment events carry the payment (and, for `payment.finalized` and `payment.closed`, the transaction) in `extra`, together with an `eventVersion`. Refer to the producing module's documentation for the exact `extra` schema. Delivery is best effort: a failed delivery is logged by the producer and does not fail the payment request.

## Consumer expectations

Consumers should treat the event envelope as an integration contract: validate the fields they need, tolerate additive fields, and ensure processing is safe to retry. Do not use an event to reach into another service's data store; use its documented API when the current state is required.
