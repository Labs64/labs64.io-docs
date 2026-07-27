---
title: Events
parent: Reference
nav_order: 2
---

# Events

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
