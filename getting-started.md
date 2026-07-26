# Getting Started (Contributors)

Looking to just run it? Start at **[labs64.io/get-started/](https://labs64.io/get-started/)**. This page is for changing the code.

The website's onboarding path answers *"I want to run it."* This page answers *"I want to build and change it."* If you only need to stand up the ecosystem — one module, the whole thing, or your own cluster — the website already covers that in more depth than a docs page should try to duplicate. Come back here once you're ready to make a change.

## The workspace and its 12 repositories

Labs64.IO is not a monorepo. Development starts from the **workspace repo**, [`labs64.io-workspace`](https://github.com/Labs64/labs64.io-workspace), which clones and orchestrates 12 independent repositories with a shared `justfile` and DevContainer:

**Runtime services**
- [`labs64.io-authproxy`](https://github.com/Labs64/labs64.io-authproxy) — Traefik-based gateway and ForwardAuth proxy
- [`labs64.io-auditflow`](https://github.com/Labs64/labs64.io-auditflow) — audit event router
- [`labs64.io-payment-gateway`](https://github.com/Labs64/labs64.io-payment-gateway) — PSP integration and payment processing
- [`labs64.io-checkout`](https://github.com/Labs64/labs64.io-checkout) — commerce/checkout workflow engine
- [`labs64.io-customer-portal`](https://github.com/Labs64/labs64.io-customer-portal) — self-service SaaS portal

**Shared libraries, infrastructure & docs**
- [`labs64.io-commons`](https://github.com/Labs64/labs64.io-commons) — shared Java libraries (auth SDK, business telemetry, utilities)
- [`labs64.io-helm-charts`](https://github.com/Labs64/labs64.io-helm-charts) — Helm charts, ArgoCD, observability stack
- [`labs64.io-devops`](https://github.com/Labs64/labs64.io-devops) — Terraform, CI/CD, GitOps automation
- [`labs64.io-tests`](https://github.com/Labs64/labs64.io-tests) — black-box, contract-first API regression suite
- [`labs64.io-docs`](https://github.com/Labs64/labs64.io-docs) — this repository
- [`labs64.io-docs-internal`](https://github.com/Labs64/labs64.io-docs-internal) — internal RFCs and design decisions
- [`labs64.io-website`](https://github.com/Labs64/labs64.io-website) — the public site (labs64.io)

Each repository has its own `AGENTS.md` — read the one for the module you're touching before making changes. Each repo also owns its own git history; commits never cross repositories.

## Toolchain

Don't install from memory — the canonical, versioned prerequisites list (Docker, Java 25, Maven, `just`, and the additional tools needed for the full local cluster) lives in one place and this page links to it rather than copying it:

**[Prerequisites table in the workspace README](https://github.com/Labs64/labs64.io-workspace#-prerequisites)**

That table is the single source; if it changes, this page doesn't need to.

## Building a single module

You don't need the whole workspace to work on one module. Clone the module's own repository and use its `justfile`:

```bash
git clone https://github.com/Labs64/labs64.io-auditflow.git
cd labs64.io-auditflow
just build
```

Check `just --list` in any module for its available recipes — build, test, and local run targets are conventionally named the same way across repos, but each `justfile` is the source of truth for that repo.

## Running tests per stack

Tests live alongside the stack they cover:

| Stack | Command | Where |
|---|---|---|
| Java (Spring Boot services) | `mvn -B verify` | inside the module's Maven project |
| Python (FastAPI services, e.g. AuditFlow transformer/sink) | `pytest` | inside the module's Python project |
| Vue (frontends) | `vitest` | inside the module's frontend project |
| Black-box / API-edge regression | Robot Framework | [`labs64.io-tests`](https://github.com/Labs64/labs64.io-tests) — read its `AGENTS.md` first; it's contract-first and gateway-edge only |

Run the stack-specific command inside the module you're changing before opening a PR. The Robot Framework suite in `labs64.io-tests` is the one that exercises requests through the real gateway edge — unit/integration tests inside a module don't replace it.

## The OpenAPI-first change workflow

Every module boundary is an OpenAPI-first contract: the YAML spec is the source of truth, and server/client code is generated from it.

1. Edit the module's OpenAPI YAML spec (e.g. `src/main/resources/openapi/*.yaml` for Java services).
2. Rebuild the module so the generator regenerates server/client stubs from the updated spec.
3. **Never hand-edit generated Java under `target/`.** Anything there is regenerated from the YAML on the next build and your changes will be silently lost — the spec is what to change, not the output.

## The knowledge graph

The ecosystem is indexed by a shared knowledge graph (`graphify-out/` in the workspace) covering all repos. Use it instead of grepping across 12 checkouts:

```bash
graphify query "<question>"    # targeted lookup
graphify path "A" "B"          # relationship trace
graphify explain "concept"     # focused explanation
graphify update .              # refresh after significant code changes
```

Run `graphify update .` after making changes that alter architecture-relevant structure, so the graph doesn't drift from the code.
