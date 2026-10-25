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
        service-url: "http://loki:3100"
        username: "acme"
        password: "${secretRef:lokiPassword}"  # resolved from THIS tenant's secret store at delivery
      fallback:              # optional — used when primary sink fails with a retryable error
        name: webhook_sink
        properties:
          webhook-url: "https://hooks.example.com/auditflow"
```

A tenant id matches `^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$`; only the reserved `_platform` is exempt. A tenant document without `quota` gets 200 events per second with a burst of 400. A pipeline without a `condition` matches every event of its tenant, and a pipeline without a transformer delivers the event unchanged.

## Where tenant documents come from

The backend reads tenant documents from one of two sources, set by `tenants.source.mode`:

| Mode | Source | Used by |
|---|---|---|
| `local-dir` (default) | `<tenantId>.yaml` files in `tenants.source.local-dir.path` (default `/config/tenants`), polled every 5 seconds | Docker Compose, bare metal |
| `gitops-configmap` | ConfigMaps labelled `auditflow.io/tenant` in the release namespace, watched through the Kubernetes API | The Helm chart |

With the Helm chart, `tenants.platform` holds the `_platform` tenant's quota and pipelines, and every entry of `tenants.additional` (a full tenant document) becomes its own labelled ConfigMap. You can also apply such a ConfigMap at any time without a Helm release.

AuditFlow picks up a new, changed or removed document without a restart. Removing a document offboards the tenant. Ingest rejects its new events, and the router quarantines events that are already in flight (`TENANT_UNRESOLVED`) instead of delivering them.

The legacy global `auditflow.pipelines` list must stay empty. A deployment that still sets it fails at startup; move those pipelines into `_platform`.

## Ingest checks and quotas

`POST /audit/publish` checks the tenant before it publishes anything:

| Answer | When |
|---|---|
| `403 TENANT_NOT_PROVISIONED` | No document exists for the tenant. |
| `403 TENANT_DISABLED` | The document has `enabled: false`. |
| `429 TENANT_RATE_LIMITED` | The tenant used up its `quota`. The answer carries `Retry-After`. |

The quota is a token bucket. `tenants.ratelimit.backend` decides where the buckets live:

| Backend | Use it for |
|---|---|
| `in-memory` (application default) | One replica. Each replica would enforce its own quota. |
| `redis` (Helm chart default) | Several replicas sharing one quota per tenant. If Redis does not answer within `tenants.ratelimit.redis.timeout` (0.5 s), each pod falls back to a local bucket and tries Redis again after `fallback-cooldown` (5 s). |

A second limit applies at delivery. `tenants.consumer.max-in-flight-per-tenant` (default 32) caps how many deliveries of one tenant a pod runs at once. A delivery over the cap waits up to 2 seconds and is then deferred without spending a retry attempt, so a busy tenant cannot hold up the others.

## Conditions

A condition is a group of rules joined by `match: all` (AND, the default) or `match: any` (OR). A rule with `match` and `rules` instead of `field` and `operator` is a nested group, up to 8 levels deep, so you can write "A and (B or C)":

```yaml
condition:
  match: all                 # eventType = api.call AND (status >= 400 OR actionStatus = FAILURE)
  rules:
    - {field: eventType, operator: eq, value: api.call}
    - match: any
      rules:
        - {field: extra.responseStatus, operator: gte, value: "400"}
        - {field: extra.actionStatus, operator: eq, value: FAILURE}
```

| Operators | Meaning |
|---|---|
| `eq`, `neq`, `eqIgnoreCase` | Equal, not equal, equal ignoring case |
| `contains`, `startsWith`, `endsWith` | String matching |
| `in`, `notIn` | Value in a comma-separated list |
| `exists`, `notExists` | The field is present or absent |
| `regex` | Regular expression |
| `gt`, `gte`, `lt`, `lte` | Numeric comparison |
| `cidr`, `notCidr` | IP address in one of the comma-separated networks, IPv4 or IPv6. Only literal addresses count; AuditFlow never resolves a host name, and an address it cannot parse matches neither operator. |
| `wildcard`, `notWildcard` | Glob with `*` and `?` and comma-separated alternatives, case-sensitive and evaluated in linear time |

An unknown operator never matches, and the dry run reports it as a warning.


Field paths support dot notation (`extra.userId`) and array indices (`items[0].name`).

## Delivery settings

Each matching pipeline gets its own delivery, which AuditFlow retries and dead-letters separately. These keys of a pipeline control it:

```yaml
pipelines:
  - name: archive
    transformers:            # optional: applied in order, instead of the single `transformer`
      - name: audit_opensearch
    sink:
      name: opensearch_sink
    retry:
      maxAttempts: 20        # default 20
      maxAge: 24h            # default 24h; also PT24H, 30m, 2d
    batch:
      enabled: true          # off by default
      maxSize: 100           # 1 to 1000, default 100
```

| Setting | Effect |
|---|---|
| `retry.maxAttempts`, `retry.maxAge` | A failed delivery comes back after 5 s, 30 s, 2 min, 10 min, 30 min, 1 h, then every 3 h. It goes to the tenant's DLQ once it has failed `maxAttempts` times or `maxAge` has passed since routing. Throttling defers a delivery without spending an attempt. |
| `batch.enabled`, `batch.maxSize` | The worker hands the sink several events of this pipeline in one call. A batch closes when it is full or after 1 second without new messages. It never holds more than `AUDITFLOW_DELIVERY_BATCH_SIZE` (50) events; `GET /actuator/pipelines/<tenantId>` shows the size reached as `batch.effectiveMaxSize`. Each event still gets its own outcome. |
| `sink.fallback` | A second sink that gets the event in the same attempt when the primary fails with a retryable error. If the fallback fails too, the delivery is retried. |
| `transformers` | Several transformers applied in order, each to the previous one's output. It takes precedence over `transformer`. |

A poison delivery skips the retries and goes to the DLQ at once. Poison means a 4xx answer from the transformer or sink service (an unknown module name included), a response larger than `auditflow.http.max-response-size`, or transformer output that is not valid JSON.

## Sink credentials

Never put a credential in a tenant document. Write it as `${secretRef:<key>}` in `sink.properties`, where the key consists of letters, digits and underscores. AuditFlow resolves it at delivery time from the tenant's own secret store, chosen by `secretRef.resolver`:

| Resolver | Where the value comes from |
|---|---|
| `env` (application default) | The environment variable `AUDITFLOW_TENANT_<TENANTID>_<KEY>`, key in upper case |
| `k8s-secret` (Helm chart default) | The key in the Kubernetes Secret `auditflow-tenant-<tenantId>-creds` |

A missing key fails the delivery as retryable, so it ends in the DLQ if nobody adds the key in time. AuditFlow never sends a blank value or another tenant's credential instead.

## Dry run and fixtures

The backend can show which of a tenant's pipelines an event would reach, without publishing anything. The endpoints are on the internal `/actuator` interface; on Kubernetes, reach them with `kubectl port-forward`.

```bash
# deployed pipelines, effective retry and batch settings, configuration warnings
curl -s localhost:8080/actuator/pipelines/<tenantId>

# sample events: per pipeline, matched or not and why; "transform": true also returns the transformer output
curl -s -X POST localhost:8080/actuator/pipelines/<tenantId>/dry-run -H 'Content-Type: application/json' \
     -d '{"events": [{"eventType": "api.call", "extra": {"responseStatus": 500}}], "transform": true}'
```

Fixtures pin a tenant's routing. Each case is an event and the exact set of pipelines it must reach. Send them as `"cases"` instead of `"events"`, optionally with `"tenant": {...}` to test a tenant document that is not deployed yet. The answer is `status: failed`, with a reason per failing case, when any case does not match.

```yaml
# tenants/fixtures/<tenantId>.yaml
cases:
  - name: a failed call is archived and logged
    event: {eventType: api.call, extra: {responseStatus: 500}}
    expect: [archive, failed-calls]
```

Keep fixtures next to your tenant files and run them before each change goes live.

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

The rules are deployment-wide and apply to every tenant's events. `auditflow.redaction.mask` sets the replacement text of `mask` (default `***`). Do not redact a key that a transformer promotes to a reporting column. The column then reads as empty, with no error.

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
