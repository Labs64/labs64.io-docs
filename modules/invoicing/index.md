---
title: Invoicing
parent: Commerce & Billing
nav_order: 4
---

# Invoicing

> **Planned service**
>
> Invoicing is documented in advance to support architecture and operational planning. It is not available as a deployable service or API contract yet.

Invoicing will create and manage billing documents from finalized commerce activity. It is intended to keep document generation separate from checkout execution and payment-provider mechanics.

| Capability | Intended behavior |
|---|---|
| Invoice generation | Build invoice documents from completed orders and billing data |
| Tax and currency context | Preserve the pricing, currency, and tax information used for the transaction |
| Lifecycle records | Track draft, issued, voided, and settled document states |
| Delivery integration | Hand documents to the Notifications service or your delivery channel |
| Retention | Support a durable, auditable document history |

## Integration boundary

Commerce services will provide a completed-order or billing event; Invoicing will own the resulting document lifecycle. Product services should not write directly to its data store.
