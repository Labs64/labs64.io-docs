---
title: Pipelines and tenants
parent: AuditFlow
nav_order: 1
---

# Pipelines and tenants

Every pipeline belongs to exactly one tenant, and an event is routed only through the pipelines of its own tenant. There is no global pipeline list and no fall-through to another tenant. Events without a tenant belong to the reserved `_platform` tenant.

## Tenant documents

A tenant is one YAML document. AuditFlow reads tenant documents from one of two sources (`tenants.source.mode`):

| Mode | Source | Used by |
|---|---|---|
| `local-dir` (default) | `<tenantId>.yaml` files in `tenants.source.local-dir.path`, polled every 5 s | Docker Compose |
| `gitops-configmap` | ConfigMaps labelled `auditflow.io/tenant`, watched live | The Helm chart |

AuditFlow picks up changes without a restart. Removing a tenant offboards it. AuditFlow rejects new events for that tenant and quarantines events already in flight (`TENANT_UNRESOLVED`) instead of delivering them.

```yaml
# tenants/acme.yaml
tenantId: acme
enabled: true
quota:                       # optional ingest rate limit; over budget → 429 + Retry-After
  rateLimitPerSec: 200
  burst: 400
pipelines:
  - name: security-alerts
    enabled: true
    condition:
      match: all             # all = AND, any = OR
      rules:
        - field: eventType
          operator: eq
          value: "security.alert"
        - field: extra.severity
          operator: in
          value: "HIGH,CRITICAL"
    transformer:
      name: audit_loki       # optional; omit to pass the event through unchanged
    sink:
      name: loki_sink
      properties:
        url: "http://loki:3100"
        api-key: "${secretRef:lokiApiKey}"
      fallback:              # optional; used when the primary sink fails with a retryable error
        name: webhook_sink
        properties:
          url: "https://hooks.example.com/auditflow"
    retry:
      maxAttempts: 10        # optional
      maxAge: 24h            # optional; default 24h
    batch:
      enabled: true          # optional; hand the sink up to maxSize events per call
      maxSize: 100
```

## Ingest checks

`POST /audit/publish` checks the tenant before anything is published:

| Result | When |
|---|---|
| `403 TENANT_NOT_PROVISIONED` | No document exists for the tenant. |
| `403 TENANT_DISABLED` | The document has `enabled: false`. |
| `429 TENANT_RATE_LIMITED` | The tenant exceeded `quota`; the response carries `Retry-After`. |

The rate limit is a token bucket. With one replica it can run in memory (`tenants.ratelimit.backend: in-memory`). With several replicas, set `redis` so all replicas share one budget. A per-tenant in-flight cap (`tenants.consumer.max-in-flight-per-tenant`, default 32) limits how many deliveries of one tenant run at once, so a busy tenant cannot hold up delivery for the others.

## Conditions

A pipeline without a `condition` matches every event of its tenant. A condition is a group of rules joined by `match: all` (AND) or `match: any` (OR). A rule with `match` and `rules` instead of `field` and `operator` is a nested group, up to 8 levels deep, so "A and (B or C)" is expressible.

Field paths use dot notation (`extra.userId`) and array indices (`items[0].name`).

| Operators | Meaning |
|---|---|
| `eq`, `neq`, `eqIgnoreCase` | Equality |
| `contains`, `startsWith`, `endsWith` | String matching |
| `in`, `notIn` | Membership in a comma-separated list |
| `exists`, `notExists` | Presence of the field |
| `regex` | Regular expression |
| `gt`, `gte`, `lt`, `lte` | Numeric comparison |
| `cidr`, `notCidr` | IP address in a CIDR range (literals only, no DNS) |
| `wildcard`, `notWildcard` | Glob matching (non-backtracking) |

To check a condition before deploying it, send sample events to `POST /actuator/pipelines/<tenantId>/dry-run`.

## Delivery settings

| Setting | Effect |
|---|---|
| `retry.maxAttempts`, `retry.maxAge` | When a failing delivery stops being retried and goes to the tenant's DLQ. |
| `batch.enabled`, `batch.maxSize` | Hand the sink up to `maxSize` events per call. Sinks with native batch support write them in one request. |
| `sink.fallback` | A second sink tried when the primary fails with a retryable error (network, timeout, 5xx), before the event is retried or dead-lettered. |
| `transformers` | A list of transformers applied in order, instead of the single `transformer`. |

Pipelines are independent. Each matching pipeline gets its own delivery, which AuditFlow retries and dead-letters separately.

## Sink credentials

Never put credentials in a tenant document. Reference them as `${secretRef:<key>}` in `sink.properties`. AuditFlow resolves the reference at delivery time from the tenant's own secret store (`secretRef.resolver`):

| Resolver | Where the value comes from |
|---|---|
| `env` (default) | Environment variable `AUDITFLOW_TENANT_<ID>_<KEY>` |
| `k8s-secret` | Kubernetes Secret `auditflow-tenant-<id>-creds` |

A missing key fails the delivery, and AuditFlow retries it. AuditFlow never replaces a missing value with an empty one or with another tenant's credential.

## Redaction

Redaction runs at ingest, before the event reaches the broker. A redacted value never appears in the broker, its logs or any sink. Rules are deployment-wide and apply to every tenant.

```yaml
auditflow:
  redaction:
    enabled: true
    rules:
      - field: extra.userId
        action: mask         # replace with ***
      - field: extra.email
        action: hash         # keyed hash, see below
      - field: extra.sessionId
        action: drop         # remove the field
```

A rule without `action` masks.

`hash` writes an HMAC-SHA256 of the value as 64 hex characters. Equal values still correlate, and without the key nobody can recover a value by hashing guesses. It needs a key:

```bash
openssl rand -base64 32
```

Supply it as `AUDITFLOW_REDACTION_HASH_KEY` from a secret (Helm: `secrets.data.AUDITFLOW_REDACTION_HASH_KEY` or the module's external secret), never in a values file.

- With a `hash` rule enabled and no key, or a key shorter than 32 characters, the backend refuses to start.
- All replicas need the same key, or the same value hashes differently.
- Changing the key makes old and new hashes incomparable.
- Whoever holds the key can test guesses against hashes. This is pseudonymisation, not anonymisation.

Do not redact a key you promote to a reporting column. The column then reads as empty, with no error.
