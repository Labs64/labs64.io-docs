---
title: Run One Module Locally
parent: Get Started
nav_order: 2
---

# Run One Module Locally

Use this path when you care about one service and do not want Kubernetes in the way. AuditFlow is the best first example: it runs on Docker Compose, takes an event over one REST call, and stores it where you can query it.

There is no gateway on this path, so requests need no token. To see authentication and policy at work, take the [Quickstart](./quickstart.md) instead.

## What you need

| Tool | Version | Why |
|---|---|---|
| Docker with Compose | Engine 24+, Compose v2 | Runs the stack |
| [`just`](https://github.com/casey/just) | any | The task runner every Labs64.IO repository uses |
| JDK (Temurin) | 25 | `just up` builds the backend on your machine before it starts the containers |
| Maven | 3.6.3+ | Same build |

No JDK on your machine and no wish for one? The [Quickstart](./quickstart.md) runs published images and needs only `kubectl` and Helm.

## 1. Start AuditFlow

```bash
git clone https://github.com/Labs64/labs64.io-auditflow.git
cd labs64.io-auditflow
just up
```

The first run compiles the backend and builds three images, which takes a few minutes. After that, a start takes about a minute. When it finishes, `just up` prints the local URLs.

You now have the three AuditFlow services plus RabbitMQ, Valkey, Cerbos and ClickHouse.

## 2. Publish an event

```bash
curl -s -X POST http://localhost:8080/audit/publish \
  -H 'Content-Type: application/json' \
  -d '{"eventType":"user.login","sourceSystem":"quickstart","tenantId":"demo"}'
```

`eventType` and `sourceSystem` are required. `tenantId` selects whose pipelines the event runs through; `demo` is a tenant that ships with the repository in `tenants/demo.yaml`.

## 3. Watch it arrive

```bash
just log sink
```

Look for `Audit Event Logged`, then press Ctrl+C. To read the stored events back from ClickHouse:

```bash
just ch-events
```

## 4. Look around

| URL | What it is |
|---|---|
| <http://localhost:8080/swagger-ui.html> | The REST API, interactive |
| <http://localhost:8081/docs> | Transformers available to pipelines |
| <http://localhost:8082/docs> | Sinks available to pipelines |
| <http://localhost:15673> | RabbitMQ management (`guest` / `guest`) |
| <http://localhost:8123/play> | ClickHouse query console (`auditflow` / `auditflow`) |

Want traces, logs and dashboards as well? `just up obs` adds the observability stack and Grafana at <http://localhost:3000> (`admin` / `admin`).

## 5. Change where events go

Pipelines are configuration, not code. Open `tenants/demo.yaml`, change or add a pipeline, and save: AuditFlow picks the change up within seconds, without a restart. The [AuditFlow](../modules/auditflow/index.md) page explains pipelines, conditions, sinks and redaction.

## 6. Stop

```bash
just down     # stop the containers, keep the data
just clean    # stop and delete the data volumes too
```

## Other modules

Every backend repository carries its own local setup, driven by `just`. Run `just --list` in a repository to see what it offers.

| Module | Start here |
|---|---|
| [Payment Gateway](../modules/payment-gateway/index.md) | [`labs64.io-payment-gateway`](https://github.com/Labs64/labs64.io-payment-gateway): `just dev-up` in `payment-gateway-be/`, and the runnable examples in `examples/` |
| [Checkout](../modules/checkout/index.md) | [`labs64.io-checkout`](https://github.com/Labs64/labs64.io-checkout): `just dev-up` in `checkout-be/`, `npm run dev` in `checkout-fe/` |
| [Customer Portal](../modules/customer-portal/index.md) | [`labs64.io-customer-portal`](https://github.com/Labs64/labs64.io-customer-portal): `npm run dev` in `customer-portal-fe/` |

These services expect the gateway to have authenticated the caller, so they are easier to explore behind it. The [Quickstart](./quickstart.md) and the [full local ecosystem](./run-the-full-ecosystem-locally.md) both put the gateway in front.

## Next steps

| You want to… | Go to |
|---|---|
| Route events to OpenSearch, S3, Splunk or your own sink | [AuditFlow](../modules/auditflow/index.md) |
| See the gateway, identity and several services together | [Quickstart](./quickstart.md) |
| Prepare an environment for a team | [Deploy to your Kubernetes cluster](./deploy-to-kubernetes.md) |

> **Local credentials are for local use.** The passwords above are defaults for a machine nobody else can reach. Replace them with managed secrets before anything is shared.
