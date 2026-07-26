<p align="center"><img src="https://repository-images.githubusercontent.com/1098335619/c9655378-1ac2-4fc2-bf59-d8c93d1faacc"></p>

# Labs64.IO :: Documentation

[![📖 Documentation](https://img.shields.io/badge/📖-Documentation-AB6543.svg)](https://github.com/Labs64/labs64.io-docs)

## What this repo is

This repository is the **public reference documentation** for the Labs64.IO ecosystem: module-by-module technical detail, integration guides, and the architecture reference. It is not the onboarding path.

**The website owns the onboarding journey.** If you want to run the ecosystem, start at **[labs64.io/get-started/](https://labs64.io/get-started/)** — it has the three supported ways to run it (one module, the whole ecosystem, or your own cluster) and the exact steps for each. This repo does not duplicate that path, so the two surfaces don't compete or drift out of sync with each other.

Two audiences, two homes:

| You want to... | Go to |
|---|---|
| Run the ecosystem (or one module) | [labs64.io/get-started/](https://labs64.io/get-started/) |
| Understand the architecture at a glance | [labs64.io/architecture/](https://labs64.io/architecture/) |
| Build and change the code | [`getting-started.md`](./getting-started.md) in this repo |
| Go deeper on how modules fit together | [`architecture.md`](./architecture.md) in this repo |
| Look up a module's integration/operational detail | the module table below |

## Modules

Status and version are the single source of truth published on the website ([`_data/modules.yml`](https://github.com/Labs64/labs64.io-website/blob/master/_data/modules.yml)). No module has reached a 1.0 / GA tier yet.

| Module | Status | Version | Docs | Known gaps |
|---|---|---|---|---|
| [AuditFlow](./auditflow/README.md) | beta | 0.0.3 | [sink configuration reference](./auditflow/README.md), [AWS CloudWatch setup](./auditflow/aws-cloudwatch-setup.md) | v1 API contract not yet frozen |
| [Auth Gateway](./auth-gateway/README.md) | beta | 0.0.2 | pending — page not yet published in this repo | — |
| [Checkout](./checkout/checkout-service-spec-en.md) | alpha | (none) | [service specification](./checkout/checkout-service-spec-en.md) | No tagged release yet; known cross-tenant read gap under review |
| [Payment Gateway](./payment-gateway/README.md) | alpha | (none) | [module reference](./payment-gateway/README.md) | **PSP webhook signature verification incomplete — do not connect to live funds**; no tagged release yet; no frontend |
| [Customer Portal](./customer-portal/README.md) | alpha | (none) | pending — page not yet published in this repo | Frontend only, backend not implemented; no tagged release yet |
| Invoicing | planned | — | not started | No repository yet |
| AI & MCP Gateway | exploring | — | not started | Design stage only; not scheduled |

## Where to go next

- **[`getting-started.md`](./getting-started.md)** — set up the workspace, build a module, run its tests, and follow the OpenAPI-first change workflow. For contributors, not adopters.
- **[`architecture.md`](./architecture.md)** — the module map, request path, database-per-service model, tenancy, and observability, consolidated from each repo's `AGENTS.md`. A reference companion to [labs64.io/architecture/](https://labs64.io/architecture/), which has the diagram.
