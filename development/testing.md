---
title: Testing
parent: Community & Contributing
nav_order: 4
---

# Testing

Each repository tests its own code (JUnit 5 for Java, pytest for Python, Vitest for Vue). On top of that, the [labs64.io-tests](https://github.com/Labs64/labs64.io-tests) repository runs a black-box regression suite against a deployed stack, built with [Robot Framework](https://robotframework.org/).

## The regression suite

- **Gateway edge only.** Every test calls the public gateway (`http://gateway.localhost/<module>/api/v1` locally), never a backend port, so authorization is always part of what is tested.
- **Contract first.** Every test maps to an operation in the module's OpenAPI contract, and the authorization matrix follows the operation's `x-labs64.auth` block.
- **Generated edge coverage.** `tests/common/auth_enforcement.robot` is generated from every module's contract: one case per protected operation, asserting that a call without credentials is rejected. CI fails when the committed file is out of date.
- **One exception.** Cases tagged `local-k8s-only` may additionally check a pod log, when an effect is otherwise invisible to an HTTP client (an authorization decision, or AuditFlow delivering an event). They skip themselves outside the local k3d cluster.

Shared resources live in `resources/`; module suites live in `tests/<module>/` of the tests repository or in `tests/e2e/` of the module repository. Each module has a `smoke.robot` (fast happy path) and an `authz.robot` (scope matrix), plus feature suites where a flow needs them.

## Tags

| Tag | Meaning |
|---|---|
| `smoke` | Fast critical path; runs on every pull request. |
| `regression` | Full functional coverage; runs nightly and before a release. |
| `e2e` | Flows across more than one module. |
| `auth`, `tenant-isolation`, `error-handling` | Authorization, cross-tenant and negative cases. |
| `psp-stub` | Needs the PSP HTTP stub (WireMock) in place of the real provider endpoints. |
| `local-k8s-only` | Runs only against the local k3d cluster. |
| `known-bug` | Documents an open defect; excluded from `smoke` and `regression`. |
| `not-ga` | Targets a module that has no released image yet; excluded everywhere. |

Every test carries `smoke` or `regression`.

## Run it

You need a stack reachable through its gateway, normally the local cluster from `just up` in the workspace.

From the workspace:

```bash
just smoke           # PR-gating smoke tests
just regression      # ordinary regression
just test            # complete local gate: regression, then the PSP-stub suite
```

`just mock …` and `just keycloak …` (for example `just keycloak regression`) run against a specific local identity provider and write reports to `results/mock/` or `results/keycloak/`.

From the tests repository, `just --list` shows every recipe; `just test-module auditflow` runs one module and `just dryrun` checks every suite in seconds without a cluster (it resolves all keywords and imports; run it before claiming a suite change works).

Robot writes `output.xml`, `log.html` and `report.html`; open `log.html` first, it has the request and response of every step.

**PSP stub.** `just test-up` starts WireMock and points the local Payment Gateway at it, `just test-psp` runs the `psp-stub` cases and `just test-down` restores the normal deployment.

**Another environment.** Set `GATEWAY_BASE_URL` and the identity-provider variables (`IDENTITY_PROVIDER=mock|keycloak`, `MOCK_OIDC_BASE_URL` or `KEYCLOAK_BASE_URL`, …); `resources/common.resource` lists them all.

## In CI

| Job | When | What it runs against |
|---|---|---|
| Static checks | Every pull request | No cluster: the generated-suite check and `robot --dryrun`. |
| Smoke | Every pull request | A fresh k3d cluster with the published ecosystem chart. |
| Full regression | Nightly, on release, on demand | A k3d cluster from the Helmfile stack, running every module's latest `:edge` image. |

Every module publishes `<image>:edge` after a green build of its main branch; the nightly run mirrors those images and records their digests in the job summary. A failing run's summary groups failures by cause, so a broken environment shows up as one row rather than dozens of failures.

## Add a test

1. Read the operation in the module's OpenAPI contract and its `x-labs64.auth` block.
2. Put happy-path checks in `smoke.robot`, scope cases in `authz.robot`, other flows in a feature suite.
3. After changing a contract, regenerate the edge suite (`scripts/generate_auth_enforcement_suite.py`) and commit it.
4. Run `just dryrun`, then the suite against your local cluster.
