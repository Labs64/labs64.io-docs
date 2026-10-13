---
title: Configuring pipelines
parent: AuditFlow
grand_parent: Core Platform
nav_order: 2
---

# Configuring pipelines

A pipeline says which events go where: a condition, an optional transformer and a sink. Pipelines are configuration, not code.

Pipelines are owned per tenant. Each tenant is one YAML document — a `tenants/<tenantId>.yaml`
file (local/compose, hot-reloaded) or a labelled ConfigMap (Kubernetes) — and events route only
through their own tenant's pipelines. Tenantless events use the reserved `_platform` tenant
(see `tenants/_platform.yaml`).

```yaml
# tenants/acme.yaml
tenantId: acme
enabled: true
quota:                       # optional per-tenant ingest rate limit (429 + Retry-After over budget)
  rateLimitPerSec: 200
  burst: 400
pipelines:
  - name: security-alerts
    enabled: true
    condition:
      match: all             # "all" (AND) or "any" (OR)
      rules:
        - field: eventType
          operator: eq
          value: "security.alert"
        - field: extra.severity
          operator: in
          value: "HIGH,CRITICAL"
    transformer:
      name: audit_loki       # optional — omit to pass through unchanged
    sink:
      name: loki_sink
      properties:
        url: "http://loki:3100"
        api-key: "${secretRef:lokiApiKey}"  # resolved from THIS tenant's secret store at delivery
      fallback:              # optional — used when primary sink fails with a retryable error
        name: webhook_sink
        properties:
          url: "https://hooks.example.com/auditflow"
```

**Available condition operators:** `eq`, `neq`, `eqIgnoreCase`, `contains`, `startsWith`, `endsWith`, `in`, `notIn`, `exists`, `notExists`, `regex`, `gt`, `gte`, `lt`, `lte`, `cidr`, `notCidr`, `wildcard`, `notWildcard`. A rule with `match` + `rules` instead of `field`/`operator` is a nested group.

Field paths support dot notation (`extra.userId`) and array indices (`items[0].name`).

## PII Redaction

```yaml
auditflow:
  redaction:
    enabled: true
    rules:
      - field: extra.userId
        action: mask         # replace with ***
      - field: extra.email
        action: hash         # replace with a keyed hash (needs the key below)
      - field: extra.sessionId
        action: drop         # remove the field entirely
```

Redaction runs at ingest, before the event is published to the broker — sensitive values never reach it or any downstream sink.

The key of a rule is `action` (`mask`, `hash` or `drop`); a rule without it masks.

**`hash` needs a secret key.** The hash is an HMAC-SHA256 of the value, written as 64 hex characters. A plain, unkeyed hash of an e-mail address, an IP address or a user id can be reversed by hashing candidates; with a key that only AuditFlow holds it cannot.

```bash
openssl rand -base64 32      # generate a key (at least 32 characters)
```

Supply it as the environment variable `AUDITFLOW_REDACTION_HASH_KEY`, from a secret and never in a values file: with the Helm chart as `secrets.data.AUDITFLOW_REDACTION_HASH_KEY`, or as a key of the module's external secret.

- If an enabled rule uses `hash` and the key is missing or shorter than 32 characters, the backend does not start. It never falls back to an unkeyed hash.
- Every replica must have the same key, or the same value gets different hashes.
- Changing the key changes every hash from then on: values hashed before and after cannot be matched. Keep the key for as long as the hashes must stay comparable.
- Whoever holds the key can test a guess against a hash. Treat it like a credential; it gives pseudonymisation, not anonymisation.
- The key is one per deployment and the same for every tenant, like the redaction rules themselves.
