---
title: Notifications
parent: Extensions
nav_order: 1
---

# Notifications

> **Planned service**
>
> Notifications is an advance design guide, not a currently available deployment or API.

Notifications will centralize delivery of transactional and operational messages. It is intended to receive meaningful domain events, apply tenant and recipient preferences, and deliver through configured channels.

| Capability | Intended behavior |
|---|---|
| Channels | Email, webhooks, and additional delivery adapters |
| Templates | Tenant-aware, reusable message templates |
| Preferences | Recipient and tenant controls for eligible notifications |
| Delivery status | Record accepted, delivered, and failed attempts |
| Event-driven use | React to commerce, entitlement, and operational events |

Design integrations around business events such as a completed payment or issued invoice. Do not make product services depend on a delivery provider directly when the service becomes available.
