# Labs64.IO :: Docs

**The documentation for running, using and configuring Labs64.IO.**
*Part of the [Labs64.IO Ecosystem](https://labs64.io): the source of the documentation site at labs64.io/docs.*

[![CI](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-ci.yml/badge.svg)](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-ci.yml)
[![Deploy Pages](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-deploy-pages.yml/badge.svg)](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-deploy-pages.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![📖 Documentation](https://img.shields.io/badge/📖-Documentation-AB6543.svg)](https://labs64.io/docs/)

<p align="center"><img src="docs/assets/docs-hero.svg" alt="Docs: The docs as a metro map: from Start, the Run it, Use it and Change it lines lead to quickstart, install, operate, concepts, module reference, API, architecture, build and contributing, with llms.txt for AI agents." width="880"></p>

[Why Docs?](#why-docs) · [Documentation](https://labs64.io/docs/) · [Build and test](#build-and-test) · [Ecosystem](#the-labs64io-ecosystem) · [labs64.io](https://labs64.io)

> [!NOTE]
> This repository owns technical reference and onboarding, not marketing. Module status and versions come from the website's `_data/modules.yml` and are never restated in pages.

## Why Docs?

Good documentation is read by people who are in the middle of something: trying to get a first request through, or deciding whether this is the right tool for the team. This site is organised around what they are doing.

1. **Get started.** A five-minute Quickstart and a comparison of every way to run Labs64.IO.
2. **Use a module.** One reference per module: capabilities, API, configuration, events, operations and troubleshooting.
3. **Change the code.** A contributor guide, the workspace layout and the OpenAPI-first workflow.

**A good fit if**

- You want to run, use or configure a Labs64.IO module and need the reference.
- You are evaluating the platform and want to compare the ways to run it.
- You found a page that is wrong or missing and want to fix it.

**Probably not what you need if**

- You are looking for marketing or positioning: that lives on [labs64.io](https://labs64.io).
- You want internal design records: those are in a private repository.

## Documentation

The published site lives at **[labs64.io/docs](https://labs64.io/docs/)**. This repository is its source: technical reference and onboarding for Labs64.IO, not marketing.

## Build and test

```bash
just serve       # preview at http://localhost:4000/docs/ (Docker)
just build       # one-off production build: run it before committing
```

Needs Docker. Pages are Markdown under `modules/<id>/index.md`; cross-link with relative `.md` paths. The page conventions, the link-checking steps and how the site is deployed are in `AGENTS.md`. Working on the code with an AI agent? [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) describe the layout, conventions and checks.

## The Labs64.IO Ecosystem

This repository is part of the [Labs64.IO Ecosystem](https://labs64.io): open-source building blocks for secure commerce platforms. Every module is documented at [labs64.io/docs](https://labs64.io/docs/).

| Module | What it does |
|---|---|
| [**AuditFlow**](https://github.com/Labs64/labs64.io-auditflow) | Publish once, route anywhere, lose nothing |
| [**Auth Gateway**](https://github.com/Labs64/labs64.io-authproxy) | One authenticated edge for every module |
| [**Payment Gateway**](https://github.com/Labs64/labs64.io-payment-gateway) | One API across multiple payment providers |
| [**Checkout**](https://github.com/Labs64/labs64.io-checkout) | Whitelabel checkout and order workflow |
| [**Customer Portal**](https://github.com/Labs64/labs64.io-customer-portal) | Self-service portal for your customers |

Built on [Commons](https://github.com/Labs64/labs64.io-commons), deployed with [Helm Charts](https://github.com/Labs64/labs64.io-helm-charts), developed in the [Workspace](https://github.com/Labs64/labs64.io-workspace), verified by [Tests](https://github.com/Labs64/labs64.io-tests) and documented in [Docs](https://github.com/Labs64/labs64.io-docs). Also from Labs64: [NetLicensing](https://netlicensing.io) for licensing-as-a-service and [GuideChimp](https://www.labs64.com/guidechimp/) for guided product tours.

## Contributing

We would love your help. Found a typo, a stale command or a missing explanation? A one-line fix is a real contribution here. Fork the repository, make your change on a branch, run the checks described in [`AGENTS.md`](AGENTS.md) and open a pull request. Not sure whether an idea fits? Open an issue first.

## License

Licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
  <a href="https://labs64.io"><img alt="Labs64.IO" src="https://labs64.io/docs/assets/images/labs64-logo.png" width="110"></a><br>
  <sub>Made by the <a href="https://labs64.io">Labs64</a> team and community.</sub>
</p>
