---
title: Database per Service
parent: Databases & Persistence
grand_parent: Operate & Manage
nav_order: 1
---

# Database-per-Service Reference

## Service → Database Matrix

| Service | PostgreSQL DB | Redis | RabbitMQ | Notes |
|---------|:---:|:---:|:---:|-------|
| checkout | `checkout` | — | — | Transaction processing |
| payment-gateway | `payment_gateway` | yes | — | Billing + idempotency cache; audit events go to AuditFlow over HTTP |
| auditflow | — | yes | yes | Idempotency/dedup store |
| authgateway | — | — | — | Stateless |
| authz-pdp | — | — | — | Stateless (policies mounted via ConfigMap) |
| customer-portal | — | — | — | Stateless |
| api-docs | — | — | — | Stateless |

## Deployment Modes

### Local Development (shared infrastructure)

All services connect to shared instances in the `tools` namespace:

| Component | Service | Database names |
|-----------|---------|---------------|
| PostgreSQL | `postgresql.tools.svc.cluster.local:5432` | `checkout`, `payment_gateway` |
| Redis | `redis-primary.tools.svc.cluster.local:6379` | (key-value, no DB isolation needed) |
| RabbitMQ | `rabbitmq.tools.svc.cluster.local:5672` | (exchange/queue isolation at app level) |

Each service uses its own **logical database name** on the shared PostgreSQL
instance — this is the database-per-service pattern enforced at the
application level.

### AWS Staging / Prod Environment & Users' Own Infrastructure (BYO Infra)

Infrastructure is decoupled from application charts. Point `applicationYaml` at your own infrastructure (e.g. Terraform-provisioned AWS RDS/Elasticache for AWS Staging / Prod, or your custom databases for BYO Infra). Each service needs its own database credentials via `secrets.data`:

```yaml
secrets:
  data:
    SPRING_DATASOURCE_USERNAME: myuser
    SPRING_DATASOURCE_PASSWORD: mypassword
```

## Enforcement

### Application level

Each service's JDBC URL includes its own database name:

```yaml
# checkout
jdbc:postgresql://postgresql.tools.svc.cluster.local:5432/checkout

# payment-gateway
jdbc:postgresql://postgresql.tools.svc.cluster.local:5432/payment_gateway
```

### Network level (egress NetworkPolicies)

When `networkPolicy.enabled: true`, each service's egress rules restrict
outbound traffic to only its designated databases:

```yaml
# checkout egress: PostgreSQL only (plus Cerbos PDP and DNS)
networkPolicy:
  enabled: true
  egress:
    - to: [PostgreSQL in tools namespace]
```

The template (`chart-libs.networkpolicy`) renders these as Kubernetes
NetworkPolicy egress rules with DNS access included automatically. When
`observability.enabled: true`, egress to the OpenTelemetry Collector
(`monitoring` namespace, OTLP 4317/4318) is also added automatically so
locking down egress never silently breaks telemetry.

### What is NOT enforced

- **PostgreSQL logical database isolation** relies on the application using the
  correct database name in its JDBC URL. There is no network-level enforcement
  preventing one service from connecting to another service's database on the
  same PostgreSQL instance.
- **RabbitMQ queue isolation** relies on application-level exchange/queue naming.
- **Redis key isolation** relies on application-level key prefixing.

## Adding a New Service

1. Choose your databases from the matrix above.
2. Add egress rules to your chart's `values.yaml` under `networkPolicy.egress`.
3. Use a unique PostgreSQL database name (not shared with other services).
4. Document the dependency in this file.
