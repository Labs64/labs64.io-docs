---
title: Regression Tests
parent: Community & Contributing
nav_order: 4
---

# Regression Tests

[`labs64.io-tests`](https://github.com/Labs64/labs64.io-tests) is a black-box regression suite for the platform, built with [Robot Framework](https://robotframework.org/). A change in one module can break another, and the break shows up at the edge: a wrong scope, a missing route, a payment that never reaches the audit log. The suite checks the platform the way a real client sees it.

- **Edge only.** Every test goes through Traefik and the Auth Gateway, never a backend port, so authentication and authorization are always part of what is tested.
- **Real tokens.** Tokens are minted with exact scopes from the mock identity provider or Keycloak.
- **Tagged and filterable.** `smoke`, `regression`, `auth`, `flaky`, `not-ga`, `local-k8s-only` and module tags let you run exactly the slice you need.

Unit tests for a module live in that module's repository. This suite needs a running stack, reachable through its gateway edge. Get one with the [Quickstart](../getting-started/quickstart.md) (gateway, authentication, AuditFlow and Payment Gateway) or with the [full local ecosystem](../getting-started/run-the-full-ecosystem-locally.md).

## What it covers

| Area | What is checked |
|---|---|
| AuditFlow | Publishing events, validation errors and the authorization matrix |
| Payment Gateway | Provider lifecycle with the NoOp provider and the authorization matrix |
| Auth enforcement | A generated matrix across every route: the scopes it should and should not accept |
| Across modules | A payment appearing in AuditFlow (local cluster only, via correlation-scoped logs) |

## Architecture

```
  ┌────────────────────────────────────────────┐
  │ Robot Framework suite   tests/ + resources/│
  └──────────────┬──────────────┬──────────────┘
                 │ mint token   │ HTTP
        ┌────────▼─────┐   ┌────▼───────────────────────────────┐
        │ mock OIDC or │   │ Edge: Traefik + Auth Gateway       │
        │ Keycloak     │   └────┬───────────────────────┬───────┘
        └──────────────┘        │                       │
                       ┌────────▼───────┐      ┌────────▼────────┐
                       │ AuditFlow      │      │ Payment Gateway │
                       └────────────────┘      └─────────────────┘
  results: output.xml · log.html · report.html · CI job summary
```

## Run the suite

Needs Python 3.14:

```bash
git clone https://github.com/Labs64/labs64.io-tests.git && cd labs64.io-tests
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

robot --include smoke --exclude not-ga tests/         # the fast gate
robot tests/auditflow/                                # one service
```

By default the suite expects the local k3d addresses (`http://gateway.localhost`). Robot writes `output.xml`, `log.html` and `report.html` to the current directory: open `log.html` first when a test fails, because it carries the full request and response for every failing keyword. `just smoke`, `just regression` and `just test-module <name>` wrap the same commands; from the workspace they are `just tests <recipe>`.

From `labs64.io-workspace`, the same suites run against the already-running local stack, with the identity provider it
has installed (mock OIDC or Keycloak, detected from the cluster):

```bash
just smoke
just regression
just test
just tests test-auth        # any recipe of this repository: just tests <recipe>
```

Against another stack, name its provider: `IDENTITY_PROVIDER=keycloak just smoke`.

**All smoke tests (fast, every PR):**
```bash
robot --include smoke --exclude not-ga tests/
```

**A single service:**
```bash
robot tests/auditflow/
robot tests/payment-gateway/
```

**A single file or test case:**
```bash
robot tests/auditflow/authz.robot
robot --test "Publish With Correct Scope Is Allowed" tests/auditflow/authz.robot
```

**P0 blocker tests only (never skipped):**
```bash
robot --include smoke --exclude not-ga tests/
```

**Full regression, excluding flaky and not-yet-GA modules:**
```bash
robot --include regression --exclude flaky --exclude not-ga --exclude psp-stub tests/
```

**Auth/authz matrix only, across all services:**
```bash
robot --include auth tests/
```

### Target another environment

Point the suite at any cluster's gateway edge with environment variables:

```bash
export GATEWAY_BASE_URL=https://gateway.example.com
export KEYCLOAK_BASE_URL=https://keycloak.example.com   # when the stack uses Keycloak instead of mock OIDC
robot --include smoke tests/
```

Tests that need pod logs are tagged `local-k8s-only` and are skipped or excluded elsewhere. The [variables are defined in `resources/common.resource`](https://github.com/Labs64/labs64.io-tests/blob/master/resources/common.resource).

For the local Keycloak profile, set `IDENTITY_PROVIDER=keycloak`; the default transport reuses
`GATEWAY_BASE_URL` with `Host: keycloak.localhost`, which also works from the workspace
devcontainer. Override `KEYCLOAK_BASE_URL`, `KEYCLOAK_ROUTE_HOST`, `KEYCLOAK_REALM`,
`OIDC_CLIENT_ID`, and `OIDC_CLIENT_SECRET` when targeting another environment. Its realm must
provide the same exact-scope/tenant-persona contract as the local declarative realm.

## Tag Taxonomy

| Tag | Meaning | Runs where |
|---|---|---|
| `smoke` | Fast critical-path only | Every PR |
| `regression` | Full functional coverage per service | Nightly + pre-release |
| `contract` | Mirrors a path covered by Schemathesis | Informational |
| `e2e` | Cross-service flows | Targeted / pre-release |
| `critical` | Failure blocks a release | Always gating |

| `flaky` | Quarantined — non-blocking | Nightly, excluded from gating |
| `known-bug` | Documents a known, unresolved defect | Excluded from `smoke` and `regression`; target it directly via `test-file`/`test-case` to check on it |
| `not-ga` | Targets a module whose images have never been published | Always excluded, kept for when it ships |
| `auth` | Authentication / authorisation assertions | — |
| `tenant-isolation` | Cross-tenant / cross-scope isolation scenarios | — |
| `error-handling` | Error path / negative testing | — |
| `psp-stub` | Requires the external PSP HTTP stub and a matching provider endpoint override | Targeted locally + nightly |

> `contract`, `critical`, and `flaky` are **reserved for future use** — no test currently carries
> them, and that's not drift. `contract` is earmarked for tests that mirror a path Schemathesis
> already covers (informational, not gating); `critical` for a case whose failure should always
> block a release regardless of suite; `flaky` is for quarantining a genuinely flaky case without
> deleting its coverage. The `e2e` tag is active for cross-service flows spanning more than one
> module; environment-specific probes also carry a tag such as `local-k8s-only`.
>
> `not-ga` **is** currently carried — by every Checkout case, generated and hand-written. No
> *released* Checkout image exists (`labs64/checkout`, `labs64/checkout-ui` have only ever
> published `:edge`), so `charts/labs64io-ecosystem` defaults `checkout.enabled` to `false`
> and the PR gate's install.sh stack never serves it; a call there would be a `503 no
> available server`, not a pass/fail signal about the module itself. `smoke`/`p0`/`regression`
> all `--exclude not-ga` so that structural fact doesn't read as a permanent regression.
>
> The nightly job is now the exception: it deploys Checkout's `:edge` image, so those cases
> would actually run there. Dropping the tag is therefore a judgement call per job, not a
> blocked one — remove it from a module's cases (and the `not_ga=True` module entry in
> `scripts/generate_auth_enforcement_suite.py`, for the generated suite) once its suites are
> confirmed green, and unconditionally the day its chart flips `enabled` to `true` by default.

## CI

The GitHub Actions workflow (`.github/workflows/labs64io-regression-suite.yml`) runs three jobs:

| Job | Trigger | Target it provisions |
|---|---|---|
| **Static Checks** | every PR, ~1 min | none — no cluster needed |
| **Smoke** | every PR | ephemeral k3d + `bash install.sh install` (the **published** ecosystem chart, same pattern as `labs64io-published-chart-e2e.yml` in `labs64.io-helm-charts`) |
| **Full Regression** | nightly, `release`, `workflow_dispatch` | k3d + local registry + **Helmfile** (`just up`), running each module's `:edge` image |

**Static Checks** is the fastest way to find a broken test. It runs
`scripts/generate_auth_enforcement_suite.py --check` (every operation declaring
an `auth` block under `x-labs64` has a generated edge test) and `robot --dryrun` over every suite, which
resolves each keyword and `Resource` import without sending a request — so a test calling a
keyword that doesn't exist fails in seconds instead of surfacing an hour later as a test
failure indistinguishable from a real regression. Run the same check locally with
`just dryrun`.

**Full Regression** deliberately provisions differently from the PR gate. Its item-12 suites
(pipeline routing, condition operators, redaction, DLQ replay, quota enforcement, secretRef
resolution) assert against fixtures that exist only in `labs64.io-helm-charts`'
`overrides/auditflow/values.local.yaml` — the `t_regression` tenant and its deliberately
failing probe pipelines, `t_regression_quota`'s tiny quota, and the global redaction rule.
`install.sh`'s quickstart profile provisions only a `t_mock` demo tenant, so on that path
every one of those cases fails `403 TENANT_NOT_PROVISIONED` no matter how healthy the code
is. The Helmfile path is also the only one that applies each module's local override
(central Cerbos PDP address, `env` secretRef resolver, gateway routes), and — because it
creates the `k3d-labs64io` context — the only one where the `local-k8s-only` cases actually
execute instead of self-skipping.

### What nightly runs against

Every module publishes `<image>:edge` to Docker Hub after a green master build — the
`edge-image` job in each repo's CI, via `labs64.io-workspace`'s reusable
`docker-publish.yml`. Nightly mirrors those tags into the k3d registry
(`scripts/mirror_edge_images.sh`) as the `localhost:5005/<name>:latest` references the
Helmfile local overrides pin, and deploys them. Nothing is built here: nightly exists to
find integration failures *between* modules, and rebuilding eight images to do that would
re-run work each module's CI already did while adding several more ways to go red for
reasons that are not a regression.

The mirror step writes every image's source digest to the job summary, so a red nightly
says exactly which builds it ran against — `:edge` moves on every master push, so
timestamps alone would not.

If a module's `:edge` tag is missing, the step fails listing every missing image together
with the workflow that publishes it, rather than deploying a half-mirrored stack of mixed
vintages.

Every job excludes `not-ga`; see the `not-ga` entry in [Tag Taxonomy](#tag-taxonomy). Note
that Checkout and Customer Portal — which have never had a released image — now publish
`:edge` too, so nightly does deploy them (the Helmfile app layer deploys them regardless,
and an unpublished image would otherwise sit in `ImagePullBackOff`). Dropping `not-ga` from
that job's filter is a one-line change once those suites are confirmed green.

Every robot step writes a triage summary to the GitHub job summary via
`scripts/robot_summary.py`: totals, failures grouped by cause, then the failing test list.
A broken environment reads as one fat row ("39 × `TENANT_NOT_PROVISIONED`") rather than 39
individual regressions, without downloading the `log.html` artifact.

## P0 Defect Coverage

| Defect class | Test file | Tag |
|---|---|---|
| Phantom JWT (auth gap between spec and implementation) | `tests/auditflow/authz.robot` | `regression` |

## Add a test

Tests follow one convention: shared keywords in `resources/`, one folder per module under `tests/`, and tags on every case.

```text
labs64.io-tests/
├── resources/              # common.resource (sessions, token minting) + per-module keywords
├── tests/
│   ├── auditflow/          # smoke.robot · authz.robot · …
│   ├── payment-gateway/    # smoke.robot · payment_providers.robot · authz.robot
│   └── common/             # cross-module probes
└── scripts/                # readiness gate, summaries, edge-image mirroring
```

New tests go through the gateway; the only exception is an explicitly tagged `local-k8s-only` probe. Pick the narrowest slice while you work and run `just ci` before you push. The repository's `AGENTS.md` explains how to add a module, and the [Tag Taxonomy](#tag-taxonomy) and [CI](#ci) sections above hold the tags and the CI setup.

## Next steps

| You want to… | Go to |
|---|---|
| Open a pull request with a new scenario | [Contributing guide](./contributing.md) |
| Understand the authorization being tested | [Auth Gateway](../modules/auth-gateway/index.md) |
