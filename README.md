<p align="center"><img src="https://repository-images.githubusercontent.com/1098335619/c9655378-1ac2-4fc2-bf59-d8c93d1faacc"></p>

# Labs64.IO :: Documentation

[![📖 Documentation](https://img.shields.io/badge/📖-Documentation-AB6543.svg)](https://labs64.io/docs/)

The documentation source for the Labs64.IO Ecosystem — everything needed to run, configure, and integrate the modules. Published at **[labs64.io/docs/](https://labs64.io/docs/)**.

## What's here

| You want to... | Go to |
|---|---|
| Run the ecosystem, or one module | [`getting-started.md`](./getting-started.md) |
| Configure or integrate a module | the module table below |
| Understand how it fits together | [`architecture.md`](./architecture.md) |
| Build and change the code | [`contributing.md`](./contributing.md) |

## Modules

| Module | What it does | Documentation |
|---|---|---|
| **AuditFlow** | Routes audit events to OpenSearch, S3, Splunk, and other destinations | [module reference](./auditflow/README.md) · [quickstart](./auditflow/quickstart.md) · [sink configuration](./auditflow/sink-configuration.md) · [operations](./auditflow/operations.md) |
| **Auth Gateway** | Authenticates and authorizes every request at the edge | [module reference](./auth-gateway/README.md) |
| **Checkout** | Cart-to-paid-order workflow with a whitelabel UI | [module reference](./checkout/README.md) |
| **Payment Gateway** | One payment API across multiple PSPs | [module reference](./payment-gateway/README.md) |
| **Customer Portal** | The customer-facing frontend | [module reference](./customer-portal/README.md) |

Module status and versions are published on the website, sourced from [`_data/modules.yml`](https://github.com/Labs64/labs64.io-website/blob/master/_data/modules.yml).

## Working on these docs

Docker-first — see [`AGENTS.md`](./AGENTS.md) for conventions.

```bash
just serve    # dev server at http://localhost:4000/docs/
just build    # one-off production build
just doctor   # Jekyll diagnostics
```

## License

Licensed under the [Apache License 2.0](./LICENSE).
