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

Tenant configs come from a pluggable source (`tenants.source.mode`):

| Mode | When | How |
|------|------|-----|
| `local-dir` (default) | Local/compose/bare-metal | `<tenantId>.yaml` files in `tenants.source.local-dir.path` (default `/config/tenants`; compose mounts `./tenants`), polled every 5s — drop a file to onboard live |
| `gitops-configmap` | Kubernetes (set by the Helm chart) | ConfigMaps labelled `auditflow.io/tenant`, watched via the Kubernetes API |

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

## Tenant file structure

```yaml
# tenants/<tenantId>.yaml — one file per tenant
tenantId: acme                    # required; ^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$
enabled: true                     # false = tenant disabled, ingest returns 403 TENANT_DISABLED
quota:                            # optional — per-tenant ingest rate limit (token bucket)
  rateLimitPerSec: 200            # over budget = 429 TENANT_RATE_LIMITED + Retry-After
  burst: 400
pipelines:
  - name: my-pipeline             # required, unique within the tenant
    enabled: true                 # enable/disable at runtime
    condition:                    # optional — omit to match every event
      match: all                  # "all" (AND) or "any" (OR)
      rules:
        - field: eventType        # dot notation supported: extra.userId
          operator: eq            # eq, neq, contains, startsWith, endsWith, in, notIn, exists,
                                  # notExists, regex, gt, gte, lt, lte, eqIgnoreCase, cidr,
                                  # notCidr, wildcard, notWildcard (see "Condition operators")
          value: "api.call"
    transformer:
      name: zero                  # optional — omit (or zero) to pass through unchanged, without a call
    sink:
      name: logging_sink          # required
      properties:                 # optional, passed to the sink's process() function
        log-level: INFO
        api-key: "${secretRef:apiKey}"  # resolved from THIS tenant's secret store at delivery
      fallback:                   # optional — used when primary sink fails with retryable error
        name: webhook_sink
        properties:
          url: "https://hooks.example.com"
```

Sink credentials use `${secretRef:<key>}` indirection (`secretRef.resolver`): `env` (default) reads
`AUDITFLOW_TENANT_<TENANTID>_<KEY>`; `k8s-secret` (Helm) reads the tenant's own Secret
`auditflow-tenant-<tenantId>-creds`. A missing key fails that delivery as retryable (→ DLQ) —
never a blank, never another tenant's credential.

## Condition operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq`, `neq` | Equals / not equals | `field: eventType, value: api.call` |
| `eqIgnoreCase` | Case-insensitive equals | `field: eventType, value: API.CALL` |
| `contains` | String contains | `field: extra.message, value: error` |
| `startsWith`, `endsWith` | Prefix / suffix match | `field: sourceSystem, value: auth` |
| `in`, `notIn` | Value in comma-separated list | `value: security.alert,auth.failed` |
| `exists`, `notExists` | Field exists / doesn't exist | `field: extra.userId` |
| `regex` | Regular expression | `field: extra.email, value: .*@.*` |
| `gt`, `gte`, `lt`, `lte` | Numeric comparisons | `field: extra.statusCode, value: 400` |
| `cidr`, `notCidr` | IP address in one of the comma-separated networks (IPv4 and IPv6; a bare address is one host). Literals only, never resolved; an unparseable address matches neither | `field: extra.ip, value: "10.0.0.0/8, 2001:db8::/32"` |
| `wildcard`, `notWildcard` | Glob, `*` any run, `?` one character, comma-separated alternatives; case-sensitive, linear time | `field: extra.actionName, value: "admin/*, licensee/delete"` |

A rule with `match` and `rules` instead of `field`/`operator` is a **nested group**, combined with
its siblings like any rule (up to 8 levels; deeper groups never match):

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

An unknown operator never matches; the dry run reports it as a warning.

## Pipeline steps and the step context

A pipeline can run several sinks in order for the same event, each step after the previous one succeeded, and a
later step can use what an earlier sink returned. The typical use is an archive and an index of it: write the
event to object storage, then write a row that points to the object.

```yaml
pipelines:
  - name: archive
    enabled: true
    condition: { … }                       # condition, batch and retry stay on the pipeline
    batch: { enabled: true, maxSize: 50 }
    steps:
      - name: original
        transformer: { name: zero }
        sink: { name: aws_s3_sink, properties: { … } }   # returns context {bucket, key}
      - name: index
        transformer: { name: my_index_transformer }     # reads input_data["context"]["original"]["key"]
        sink: { name: clickhouse_sink, properties: { … } }
```

- **One shape per pipeline.** A pipeline has either `transformer(s)` + `sink` (one step, as before) or `steps`. A
  tenant file that mixes them, has a step without a sink, or two steps with one name is refused when it loads.
  Step names follow the sink and transformer id rule `^[a-zA-Z0-9_]+$`. A step can have `transformers` and a sink
  `fallback`, like a pipeline.
- **The context.** A sink may return `context: {…}` in its result: `process` in the dict it returns,
  `process_batch` in each event's outcome dict. AuditFlow keeps it under the step's name and gives the next steps'
  transformers the event with a top-level `context` field, e.g. `{"original": {"bucket": "…", "key": "…"}}`.
  The event the first step writes never has it. The whole context of an event may take 4 KiB; a larger one, or one
  that is not a JSON object, is poison (DLQ).
- **Only sinks write it.** `context` is reserved in the event contract: a publish that sets it (with any key) is
  refused with 400, so nobody can forge what an earlier step returned. An empty object, as a generated client sends
  it, is accepted and dropped; the published event carries no `context` key.
- **Retries continue where they stopped.** A delivery that fails after a finished step is retried, deferred or
  dead-lettered with two headers, `x-auditflow-steps-done` and `x-auditflow-context`, and the next attempt, or a
  DLQ replay, starts at the failed step with that context. A finished step is not repeated. One retry budget
  (`retry`) covers the whole pipeline. If the process dies between a step and storing its outcome, the step can run
  again (at-least-once, as for any sink).
- **Batches.** Each step makes one sink call for the events of the batch still in progress; an event that fails a
  step leaves the batch there and settles on its own. Events at different steps never share a batch.
- **Coupled on purpose.** The steps of one pipeline depend on each other: while the first sink is down, the second
  waits under the retry tiers. Separate pipelines stay independent.
- **Dry run and listing.** `GET /actuator/pipelines/<tenantId>` lists the steps; a dry run with `"transform": true`
  runs every step's transformers, the later ones without a context (no sink is called, so none was returned:
  `withoutContext: true` in the report).

## Pipeline dry run and tenant fixtures

Ask the running backend which of a tenant's pipelines an event would reach, without publishing
anything (internal admin surface, like the DLQ endpoint; port-forward in Kubernetes):

```bash
# deployed pipelines, effective retry/batch settings, configuration warnings
curl -s localhost:8080/actuator/pipelines/<tenantId> | python3 -m json.tool

# sample events: per pipeline matched or not and why; "transform": true also returns transformer output
curl -s -X POST localhost:8080/actuator/pipelines/<tenantId>/dry-run -H 'Content-Type: application/json' \
     -d '{"events": [{"eventType": "api.call", "extra": {"responseStatus": 500}}], "transform": true}'
```

**Fixtures** pin a tenant's routing: a list of cases, each an event plus the exact set of pipelines it
must reach. Send them as `"cases"` (optionally with `"tenant": {...}` to test a tenant document that
is not deployed yet); the answer is `status: failed` with a reason per failing case.

```yaml
# tenants/fixtures/<tenantId>.yaml
cases:
  - name: a failed call is archived and logged
    event: {eventType: api.call, extra: {responseStatus: 500}}
    expect: [archive, failed-calls]
```

## Tamper-evidence for the S3 archive

`aws_s3_sink` sends an S3-verified SHA-256 checksum with every object (`checksum: none` turns it off
for stores without checksum support). With `digest: "true"` it also writes, per object, a signed
digest record under `<prefix>tenant=<id>/_digests/chain=<id>/<sequence>.json`: object key, SHA-256,
size, event ids, the previous record's hash and an Ed25519 signature. Chains are per tenant and per
sink process; the sink needs no read access.

```bash
python3 auditflow-sink/scripts/verify_s3_digests.py --generate-key     # once: seed + public key
```

Store the seed as the tenant's secret (`k8s-secret` resolver: key `digestSigningKey` in
`auditflow-tenant-<tenantId>-creds`) and reference it, never as a literal:

```yaml
sink:
  name: aws_s3_sink
  properties: {bucket: ..., prefix: tenants/, digest: "true", digest-signing-key: "${secretRef:digestSigningKey}"}
```

An auditor verifies with the public key (needs `s3:ListBucket` and `s3:GetObject` on the prefix):

```bash
python3 auditflow-sink/scripts/verify_s3_digests.py --bucket <bucket> --prefix tenants/tenant=<id> \
        --public-key <base64> [--unattested]
```

It checks every signature, sequence and previous-record link, and every attested object's SHA-256,
and with `--unattested` also fails on objects no record covers. Not covered by the chain alone:
removing the newest records of a chain; enable S3 Object Lock on the bucket for that. Use it with `batch.enabled`: a digest record per
object doubles the PUTs of one-object-per-event pipelines.

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
