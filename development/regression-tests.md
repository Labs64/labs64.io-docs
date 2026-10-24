---
title: Regression Tests
parent: Community & Contributing
nav_order: 4
---

# Regression Tests

[`labs64.io-tests`](https://github.com/Labs64/labs64.io-tests) is a black-box regression suite for the platform, built with [Robot Framework](https://robotframework.org/). A change in one module can break another, and the break shows up at the edge: a wrong scope, a missing route, a payment that never reaches the audit log. The suite checks the platform the way a real client sees it.

- **Edge only.** Every test goes through Traefik and the auth proxy, never a backend port, so authentication and authorization are always part of what is tested.
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
        │ mock OIDC or │   │ Gateway edge: Traefik + auth proxy │
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

### Target another environment

Point the suite at any cluster's gateway edge with environment variables:

```bash
export GATEWAY_BASE_URL=https://gateway.example.com
export KEYCLOAK_BASE_URL=https://keycloak.example.com   # when the stack uses Keycloak instead of mock OIDC
robot --include smoke tests/
```

Tests that need pod logs are tagged `local-k8s-only` and are skipped or excluded elsewhere. The [reference](https://github.com/Labs64/labs64.io-tests/blob/master/docs/reference.md#targeting-a-different-environment) lists every variable.

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

New tests go through the gateway; the only exception is an explicitly tagged `local-k8s-only` probe. Pick the narrowest slice while you work and run `just ci` before you push. The repository's `AGENTS.md` explains how to add a module, and its [`docs/reference.md`](https://github.com/Labs64/labs64.io-tests/blob/master/docs/reference.md) holds every command, the tag taxonomy and the CI setup.

## Next steps

| You want to… | Go to |
|---|---|
| Open a pull request with a new scenario | [Contributing guide](./contributing.md) |
| Understand the authorization being tested | [Auth Gateway](../modules/auth-gateway/index.md) |
