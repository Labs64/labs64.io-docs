<p align="center"><img src="https://raw.githubusercontent.com/Labs64/.github/master/assets/labs64-io-ecosystem.png" alt="Labs64.IO Ecosystem"></p>

# Labs64.IO :: Documentation

[![CI](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-ci.yml/badge.svg)](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-ci.yml)
[![Deploy Pages](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-deploy-pages.yml/badge.svg)](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-deploy-pages.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![📖 Documentation](https://img.shields.io/badge/📖-Documentation-AB6543.svg)](https://labs64.io/docs/index.html)

The documentation source for the Labs64.IO Ecosystem — everything needed to run, configure, and integrate the modules. Published at **[labs64.io/docs/](https://labs64.io/docs/index.html)**.

## What's here

| You want to... | Go to |
|---|---|
| Run the ecosystem, or one module | [`getting-started/`](./getting-started/index.md) |
| Configure or integrate a module | the module table below |
| Understand how it fits together | [`introduction/architecture.md`](./introduction/architecture.md) |
| Build and change the code | [`development/contributing.md`](./development/contributing.md) |

## Modules

| Module | What it does | Documentation |
|---|---|---|
| **AuditFlow** | Routes audit events to OpenSearch, S3, Splunk, and other destinations | [module reference](./modules/auditflow/index.md) |
| **Auth Gateway** | Authenticates and authorizes every request at the edge | [module reference](./modules/auth-gateway/index.md) |
| **Checkout** | Cart-to-paid-order workflow with a whitelabel UI | [module reference](./modules/checkout/index.md) |
| **Payment Gateway** | One payment API across multiple PSPs | [module reference](./modules/payment-gateway/index.md) |
| **Customer Portal** | The customer-facing frontend | [module reference](./modules/customer-portal/index.md) |

Module status and versions are published on the website, sourced from [`_data/modules.yml`](https://github.com/Labs64/labs64.io/blob/master/_data/modules.yml).

## Working on these docs

Docker-first — see [`AGENTS.md`](./AGENTS.md) for conventions.

```bash
just serve    # dev server at http://localhost:4000/docs/
just build    # one-off production build
just doctor   # Jekyll diagnostics
```

## License

Licensed under the [Apache License 2.0](./LICENSE).
