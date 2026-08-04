---
title: Run One Module Locally
parent: Get Started
nav_order: 2
---

# Run One Module Locally

Use this path to evaluate a focused capability without operating the entire ecosystem. AuditFlow is a useful first example because it accepts an event and routes it through a compact local environment.

## 1. Start the service

```bash
git clone https://github.com/Labs64/labs64.io-auditflow.git
cd labs64.io-auditflow
just up
```

The first start may build images and resolve dependencies. Follow the service repository's output until it reports healthy containers.

## 2. Verify a real request

```bash
curl -sS -i -X POST http://localhost:8080/audit/publish \
  -H 'Content-Type: application/json' \
  -d '{"eventType":"demo.event","sourceSystem":"demo","extra":{"hello":"world"}}'
```

You should receive a successful HTTP response and an audit event identifier. See [AuditFlow](../modules/auditflow/index.md) for its pipeline and sink model.

## 3. Decide what to do next

| If you want to… | Go to |
|---|---|
| Change the event destination or transformer | [AuditFlow](../modules/auditflow/index.md) |
| Test gateway and cross-service interactions | [Run the full ecosystem locally](./run-the-full-ecosystem-locally.md) |
| Prepare a shared environment | [Deploy to Kubernetes](./deploy-to-kubernetes.md) |

> **Local-use reminder:** local credentials and endpoints are for evaluation. Replace them with managed secrets and production networking before a shared deployment.
