---
title: Regression Tests
parent: Community & Contributing
nav_order: 4
---

# Regression Tests

[`labs64.io-tests`](https://github.com/Labs64/labs64.io-tests) is a black-box regression suite for the platform, built with [Robot Framework](https://robotframework.org/). A change in one module can break another, and the break shows up at the edge: a wrong scope, a missing route, a payment that never reaches the audit log. The suite checks the platform the way a real client sees it.

- **Edge only.** Every test goes through Traefik and the auth proxy, never a backend port, so authentication and authorization are always part of what is tested. Locally the gateway serves a module at `http://gateway.localhost/<module>/api/v1`.
- **Contract first.** Every test maps to an operation in the module's OpenAPI contract. The operation's `x-labs64.auth` block decides which scopes the authorization cases expect to pass or fail.
- **Real tokens.** Tokens are minted with exact scopes from the mock identity provider or Keycloak. Both providers give the same results.
- **Generated edge coverage.** `scripts/generate_auth_enforcement_suite.py` generates `tests/common/auth_enforcement.robot` from every module's contract. It holds one case per protected operation, and each case checks that the gateway refuses a call without credentials. CI fails when the committed file no longer matches the contracts.
- **Tagged and filterable.** `smoke`, `regression`, `auth`, `flaky`, `not-ga`, `local-k8s-only` and module tags let you run exactly the slice you need.

A case tagged `local-k8s-only` may also read a pod log when an HTTP client cannot see the effect, such as an authorization decision or AuditFlow delivering an event. Such a case skips itself unless the current `kubectl` context is the local k3d cluster.

Unit tests for a module live in that module's repository: JUnit 5 for Java, pytest for Python and Vitest for Vue. This suite needs a running stack, reachable through its gateway edge. Get one with the [Quickstart](../getting-started/quickstart.md) (gateway, authentication, AuditFlow and Payment Gateway) or with the [full local ecosystem](../getting-started/run-the-full-ecosystem-locally.md).

## What it covers

The tests repository holds the shared keywords, the generated suite and the cross-module flows. Each module keeps its own suites in `tests/e2e/` of its repository.

| Area | What is checked |
|---|---|
| AuditFlow | Publishing events, validation errors, the authorization matrix, tenant isolation, pipeline routing and conditions, redaction, dead-letter replay, quotas and secret references |
| Payment Gateway | Provider lifecycle and the payment flow with the NoOp provider, the authorization matrix, and the Stripe and PayPal flows against the PSP stub |
| Auth enforcement | A generated suite that checks every protected operation of every module refuses a call without credentials |
| Across modules | A payment appearing in AuditFlow (local cluster only, via correlation-scoped logs) |

### Tags

| Tag | Meaning |
|---|---|
| `smoke` | Fast critical path. Runs on every pull request. |
| `regression` | Full functional coverage. Runs nightly. |
| `e2e` | A flow across more than one module |
| `auth`, `tenant-isolation`, `error-handling` | Authorization, cross-tenant and negative cases |
| `psp-stub` | Needs the WireMock stub in place of the real payment provider endpoints |
| `local-k8s-only` | Runs only against the local k3d cluster |
| `flaky` | A quarantined case. Gating runs exclude it. |
| `known-bug` | Documents an open defect. `smoke` and `regression` runs exclude it. |
| `not-ga` | Targets a module that has no released image yet. Every standard run excludes it. |

Every test carries `smoke` or `regression`. Module tags such as `auditflow` or `payment-gateway` select one module.

## Architecture

```
  ┌────────────────────────────────────────────┐
  │ Robot Framework suite   tests/ + resources/│
  └──────────────┬──────────────┬──────────────┘
                 │ mint token   │ HTTP
        ┌────────▼─────┐   ┌────▼───────────────────────────────┐
        │ mock OIDC or │   │ Gateway edge: Traefik + auth proxy │
        │ Keycloak     │   └────┬───────────────────────┬───────┘
        └──────────────┘        │                       │
                       ┌────────▼───────┐      ┌────────▼────────┐
                       │ AuditFlow      │      │ Payment Gateway │
                       └────────────────┘      └─────────────────┘
  results: output.xml · log.html · report.html · CI job summary
```

## Run the suite

From `labs64.io-workspace`, against the local cluster that `just up` creates:

```bash
just smoke           # the fast smoke tests of every module
just regression      # the regression suite, without the PSP-stub cases
just test            # the complete local gate: regression, then the PSP-stub cases
```

These recipes check whether the local cluster runs mock-oidc or Keycloak and test against that identity provider. If the cluster runs both, or you target another environment, set `IDENTITY_PROVIDER=mock` or `IDENTITY_PROVIDER=keycloak`.

In the tests repository, `just --list` shows every recipe; from the workspace they are `just tests <recipe>`. The recipes run the suites of `labs64.io-tests`, `labs64.io-auditflow` and `labs64.io-payment-gateway`, so clone the module repositories next to the tests repository, as `just clone` in the workspace does.

| Recipe | What it runs |
|---|---|
| `just smoke`, `just regression` | The same runs as in the workspace, with the identity provider from `IDENTITY_PROVIDER` (default `mock`) |
| `just test-auth` | Only the authorization cases |
| `just test-module auditflow` | Everything for one module, except the PSP-stub cases |
| `just test-common` | Every suite of the tests repository and the modules, without a tag filter |
| `just test-local-k8s` | Only the `local-k8s-only` cases. They skip on any `kubectl` context other than the local k3d cluster. |
| `just test-file <file>`, `just test-case "<name>" <file>` | One suite file, or one named case in it |
| `just dryrun` | Every suite through `robot --dryrun`, in seconds and without a cluster |
| `just open-log`, `just open-report` | Serves the latest `log.html` or `report.html` on `localhost:8000` |

The recipes write their results to `results/`. Open `log.html` first when a test fails, because it carries the full request and response for every failing keyword. If a run under an IDE task runner stops with `OSError: [Errno 5] Input/output error`, the runner closed the console output. Add `console=none` to the recipe, for example `just smoke console=none`.

**PSP stub.** `just enable-psp-stub` starts WireMock and points the local Payment Gateway at it. `just show-psp-stub` shows whether the stub runs and which provider endpoints Payment Gateway uses. `just test-psp` runs the `psp-stub` cases, and `just disable-psp-stub` restores the normal deployment. The tests repository's `just test` runs all of this after the regression and restores the deployment even when a step fails. The workspace's `just test` calls it.

**Without `just`.** The recipes call plain `robot`, so you can run it yourself. Needs Python 3.15, the version the workspace pins in `tool-versions.env`:

```bash
git clone https://github.com/Labs64/labs64.io-tests.git && cd labs64.io-tests
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt

robot --include smoke --exclude not-ga --exclude known-bug \
  tests/ ../labs64.io-auditflow/tests/e2e/ ../labs64.io-payment-gateway/tests/e2e/   # the fast gate
robot ../labs64.io-auditflow/tests/e2e/                                                # one service
```

By default the suite expects the local k3d addresses (`http://gateway.localhost`). Without `--outputdir`, Robot writes `output.xml`, `log.html` and `report.html` to the current directory.

### Target another environment

Point the suite at any cluster's gateway edge with environment variables. Set `GATEWAY_BASE_URL` to the gateway address and pick the identity provider with `IDENTITY_PROVIDER`. Then set `MOCK_OIDC_BASE_URL` for mock-oidc, or `KEYCLOAK_BASE_URL` for Keycloak:

```bash
export GATEWAY_BASE_URL=https://gateway.example.com
export IDENTITY_PROVIDER=keycloak
export KEYCLOAK_BASE_URL=https://keycloak.example.com   # when the stack uses Keycloak instead of mock OIDC
just smoke
```

Tests that need pod logs are tagged `local-k8s-only` and skip against any environment other than the local k3d cluster. `resources/common.resource` lists every variable and its default, and the [reference](https://github.com/Labs64/labs64.io-tests/blob/master/docs/reference.md#targeting-a-different-environment) describes them.

**A stack from `install.sh`.** The [Quickstart](../getting-started/quickstart.md) installer serves the gateway and the demo identity provider on one address, `http://localhost:8000` for the k3d cluster it suggests. Its gateway accepts only tokens that mock-oidc issued under its in-cluster name, so the token requests must carry that name as the `Host` header:

```bash
export GATEWAY_BASE_URL=http://localhost:8000
export MOCK_OIDC_BASE_URL=http://localhost:8000
export MOCK_OIDC_HOST_HEADER=mock-oidc.labs64io.svc.cluster.local:8080   # mock-oidc.<namespace>.svc.cluster.local:8080
just smoke
```

Without `MOCK_OIDC_HOST_HEADER`, the gateway refuses every token with `401 Invalid issuer`. The installer creates only the demo tenant `t_mock`, so the AuditFlow regression suites that need the regression tenants of the Helmfile stack fail there with `403 TENANT_NOT_PROVISIONED`. Use `just smoke` against an `install.sh` stack, and the local Helmfile cluster for the full regression.

## In CI

| Job | When | Runs against |
|---|---|---|
| Static checks | Every pull request | No cluster. The job checks the generated suite and runs `robot --dryrun`. |
| Smoke | Every pull request | A new k3d cluster with the published ecosystem chart, installed by `install.sh` |
| Full regression | Nightly, on a release of the tests repository, and on demand | A k3d cluster from the Helmfile stack, running each module's latest `:edge` image |

Every module pushes `<image>:edge` after a green build of its main branch. The nightly run mirrors those images into the cluster's registry and writes their digests to the job summary, so a failed run names the exact builds it tested. The summary groups failures by cause, so a broken environment shows up as one row instead of many failed tests.

## Add a test

Tests follow one convention: shared keywords in `resources/` of the tests repository, one `tests/e2e/` folder in each module's repository, and tags on every case.

```text
labs64.io-tests/
├── resources/              # common.resource (sessions, token minting) + per-module keywords
├── tests/
│   └── common/             # the generated auth_enforcement.robot + cross-module flows in e2e/
└── scripts/                # suite generator, readiness gate, summaries, edge-image mirroring

labs64.io-<module>/tests/e2e/
├── smoke.robot             # the fast happy path
├── authz.robot             # the scope matrix, where the module has one
└── <feature>.robot         # one suite per flow that needs one
```

1. Read the operation in the module's OpenAPI contract and its `x-labs64.auth` block.
2. Put happy-path checks in `smoke.robot`, scope cases in `authz.robot`, and other flows in a feature suite of the module's `tests/e2e/`.
3. After a contract change, run `just generate-auth-suite` in the tests repository and commit the regenerated suite.
4. Run `just dryrun`, then the suite against your local cluster. `just dryrun` resolves every keyword and every `Resource` import, so it catches a call to a keyword that does not exist.

New tests go through the gateway; the only exception is an explicitly tagged `local-k8s-only` probe. Pick the narrowest slice while you work and run `just ci` before you push. The repository's `AGENTS.md` explains how to add a module, and its [`docs/reference.md`](https://github.com/Labs64/labs64.io-tests/blob/master/docs/reference.md) holds every command, the tag taxonomy and the CI setup.

## Next steps

| You want to… | Go to |
|---|---|
| Open a pull request with a new scenario | [Contributing guide](./contributing.md) |
| Understand the authorization being tested | [Auth Gateway](../modules/auth-gateway/index.md) |
