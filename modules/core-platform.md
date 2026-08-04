---
title: Core Platform
parent: Services & Modules
nav_order: 1
has_children: true
---

# Core Platform

Core Platform services establish the common trust, traceability, and integration boundaries used by the rest of Labs64.IO.

| Service | Role | Availability |
|---|---|---|
| [Auth Gateway](./auth-gateway/index.md) | Authenticates requests and enforces policy at the edge | Available |
| [AuditFlow](./auditflow/index.md) | Routes tenant-aware audit events to configured sinks | Available |
| [MCP Gateway](./mcp-gateway/index.md) | Governs access between AI clients and Model Context Protocol tools | Planned |

Start with Auth Gateway when you need a consistent security edge; add AuditFlow when you need a durable audit trail across services.
