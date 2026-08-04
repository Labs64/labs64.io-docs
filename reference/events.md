---
title: Event Catalogue
parent: Reference
nav_order: 2
---

# Event Catalogue

Labs64.IO uses RabbitMQ for asynchronous event propagation. Modules publish domain events, and other modules (primarily AuditFlow) consume them.

## Standard Event Envelope

All events adhere to a standard JSON envelope format:

```json
{
  "eventId": "uuid-string",
  "timestamp": "ISO-8601-string",
  "eventType": "domain.entity.action",
  "tenantId": "string-or-null",
  "sourceSystem": "string",
  "payload": { ... }
}
```

## Known Event Types

| Event Type | Producer | Description |
|------------|----------|-------------|
| `checkout.order.created` | Checkout | Fired when a new purchase order is initiated. |
| `payment.transaction.succeeded` | Payment Gateway | Fired when a PSP confirms a successful charge. |
| `payment.transaction.failed` | Payment Gateway | Fired when a PSP rejects a charge. |
| `payment.refund.processed` | Payment Gateway | Fired when a refund is completed. |

*Note: For the exact schema of the `payload` object, refer to the producing module's specific documentation.*

## Consumer expectations

Consumers should treat the event envelope as an integration contract: validate the fields they need, tolerate additive fields, and ensure processing is safe to retry. Do not use an event to reach into another service's data store; use its documented API when the current state is required.
