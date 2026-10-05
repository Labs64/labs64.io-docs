---
title: Testing
parent: Community & Contributing
nav_order: 4
---

# Testing

Each repository tests its own code with JUnit 5 for Java, pytest for Python and Vitest for Vue. The [labs64.io-tests](https://github.com/Labs64/labs64.io-tests) repository also runs a black-box regression suite against a deployed stack. The suite uses [Robot Framework](https://robotframework.org/).

## The regression suite

- **Gateway edge only.** Every test calls the public gateway, never a backend port, so every test passes through authorization. Locally the gateway is `http://gateway.localhost/<module>/api/v1`.
- **Contract first.** Every test maps to an operation in the module's OpenAPI contract, and the authorization matrix follows the operation's `x-labs64.auth` block.
- **Generated edge coverage.** A script generates `tests/common/auth_enforcement.robot` from every module's contract. It holds one case per protected operation, and each case asserts that the gateway rejects a call without credentials. CI fails when the committed file is out of date.
- **One exception.** Cases tagged `local-k8s-only` may also check a pod log when an HTTP client cannot see an effect, such as an authorization decision or AuditFlow delivering an event. They skip themselves outside the local k3d cluster.

Shared resources live in `resources/`. Module suites live in `tests/<module>/` of the tests repository or in `tests/e2e/` of the module repository. Each module has a `smoke.robot` for the fast happy path, an `authz.robot` for the scope matrix, and feature suites where a flow needs them.

## Tags

| Tag | Meaning |
|---|---|
| `smoke` | Fast critical path. Runs on every pull request. |
| `regression` | Full functional coverage. Runs nightly and before a release. |
| `e2e` | Flows across more than one module. |
| `auth`, `tenant-isolation`, `error-handling` | Authorization, cross-tenant and negative cases. |
| `psp-stub` | Needs the PSP HTTP stub (WireMock) in place of the real provider endpoints. |
| `local-k8s-only` | Runs only against the local k3d cluster. |
| `known-bug` | Documents an open defect. Excluded from `smoke` and `regression`. |
| `not-ga` | Targets a module that has no released image yet. Excluded everywhere. |

Every test carries `smoke` or `regression`.

## Run it

You need a stack that is reachable through its gateway. Normally this is the local cluster from `just up` in the workspace.

From the workspace:

```bash
just smoke           # PR-gating smoke tests
just regression      # ordinary regression
just test            # complete local gate: regression, then the PSP-stub suite
```

These recipes detect whether the local cluster runs mock-oidc or Keycloak and test against that identity provider. If the cluster runs both, set `IDENTITY_PROVIDER=mock` or `IDENTITY_PROVIDER=keycloak`. Reports go to `results/`.

In the tests repository, `just --list` shows every recipe and `just test-module auditflow` runs one module. `just dryrun` checks every suite in seconds without a cluster. It resolves all keywords and imports, so run it before you claim a suite change works.

Robot Framework writes `output.xml`, `log.html` and `report.html`. Open `log.html` first, because it has the request and response of every step.

**PSP stub.** `just test-up` starts WireMock and points the local Payment Gateway at it. `just test-psp` runs the `psp-stub` cases, and `just test-down` restores the normal deployment.

**Another environment.** Set `GATEWAY_BASE_URL` and the identity-provider variables, such as `IDENTITY_PROVIDER=mock|keycloak` and `MOCK_OIDC_BASE_URL` or `KEYCLOAK_BASE_URL`. `resources/common.resource` lists them all.

## In CI

| Job | When | What it runs against |
|---|---|---|
| Static checks | Every pull request | No cluster. The job runs the generated-suite check and `robot --dryrun`. |
| Smoke | Every pull request | A fresh k3d cluster with the published ecosystem chart. |
| Full regression | Nightly, on release, on demand | A k3d cluster from the Helmfile stack, running every module's latest `:edge` image. |

Every module publishes `<image>:edge` after a green build of its main branch. The nightly run mirrors those images and records their digests in the job summary. The summary of a failing run groups failures by cause, so a broken environment shows up as one row instead of dozens of failures.

## Add a test

1. Read the operation in the module's OpenAPI contract and its `x-labs64.auth` block.
2. Put happy-path checks in `smoke.robot`, scope cases in `authz.robot`, other flows in a feature suite.
3. After you change a contract, regenerate the edge suite with `scripts/generate_auth_enforcement_suite.py` and commit it.
4. Run `just dryrun`, then the suite against your local cluster.
