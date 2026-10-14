# Labs64.IO :: Docs

**The documentation for running, using and configuring Labs64.IO.**
*Part of the [Labs64.IO Ecosystem](https://labs64.io): the source of the documentation site at labs64.io/docs.*

[![CI](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-ci.yml/badge.svg)](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-ci.yml)
[![Deploy Pages](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-deploy-pages.yml/badge.svg)](https://github.com/Labs64/labs64.io-docs/actions/workflows/labs64io-deploy-pages.yml)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![📖 Documentation](https://img.shields.io/badge/📖-Documentation-AB6543.svg)](https://labs64.io/docs/)

<p align="center"><img src="docs/assets/docs-hero.svg" alt="Docs: The docs as a metro map: from Start, the Run it, Use it and Change it lines lead to quickstart, install, operate, concepts, module reference, API, architecture, build and contributing, with llms.txt for AI agents." width="880"></p>

[**Get started**](#get-started) · [Features](#features) · [Architecture](#architecture) · [AI agents](#using-docs-with-ai-agents) · [Ecosystem](#the-labs64io-ecosystem) · [Documentation](https://labs64.io/docs/) · [labs64.io](https://labs64.io)

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

## Get started

Four ways in. Pick the one that matches what you have; each is complete on its own.

```
 1  install.sh             2  Kubernetes             3  Docker                 4  Source
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│ Follow the Quickstart │ │ Read the deployment   │ │ Preview the site on   │ │ Change a page,        │
│ the docs describe:    │ │ guides for your       │ │ your machine while    │ │ follow the page       │
│ one script, five      │ │ own cluster and       │ │ you edit a page       │ │ conventions, check    │
│ minutes               │ │ identity provider     │ │                       │ │ the links             │
├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤ ├───────────────────────┤
│ needs  a cluster,     │ │ needs  a browser      │ │ needs  Docker         │ │ needs  Docker, Git    │
│        kubectl, helm  │ │                       │ │                       │ │                       │
│ time   ~5 minutes     │ │ time   ~20 minutes    │ │ time   ~2 minutes     │ │ time   a few minutes  │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘ └───────────────────────┘
 try what is documented    plan a real install       write docs                contribute back
```

Not sure? Open the [published site](https://labs64.io/docs/) first; come back here to fix or extend a page.

### 1. `install.sh`: the quick ecosystem start

The Quickstart is the first page of this site: one script installs the gateway, AuditFlow and Payment Gateway on any Kubernetes cluster, then proves it with a real request.

```bash
# No cluster yet? A throwaway one needs only Docker and k3d:
k3d cluster create labs64io-demo -p "8000:80@loadbalancer" --k3s-arg "--disable=traefik@server:0"

curl -fsSL https://raw.githubusercontent.com/Labs64/labs64.io-helm-charts/master/install.sh -o install.sh
bash install.sh
```

Press Enter three times to take the defaults. A few minutes later you should see:

```text
  PASS  Obtained a demo access token from mock-oidc
  PASS  Published a demo audit event (HTTP 200) — first good request succeeded

 Labs64.IO is ready.
   Base URL:  http://localhost:8000
   API docs:  http://localhost:8000/swagger-ui/
```

Every command on that page is kept in step with `install.sh` in `labs64.io-helm-charts`. The same script later runs `status`, `stop`, `start` and `uninstall`. This is an evaluation install with a demo identity provider: keep it on a local or private cluster. Details: [Quickstart](https://labs64.io/docs/getting-started/quickstart.html) · [`install.sh`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/install.sh).

### 2. Kubernetes: on your own cluster

The adopter guides cover running on your own cluster: choosing a path, deploying to Kubernetes, configuring identity and troubleshooting. Start at [Get Started](https://labs64.io/docs/getting-started/) and [Deploy to your Kubernetes cluster](https://labs64.io/docs/getting-started/deploy-to-kubernetes.html).

### 3. Docker: on your machine

Only Docker is needed. The site is built with Jekyll and the just-the-docs theme inside a container:

```bash
git clone https://github.com/Labs64/labs64.io-docs.git && cd labs64.io-docs
docker compose up --build
```

Open <http://localhost:4000/docs/>. Edits are picked up while the container runs. Stop it with `docker compose down`.

### 4. Source: build and change it

Pages are Markdown, organised by module under `modules/<id>/index.md`; child pages live in `modules/<id>/<topic>/index.md`. Cross-link with relative `.md` paths, and verify the built output:

```bash
docker compose run --rm labs64io-docs bundle exec jekyll build --config _config.yml
```

[`AGENTS.md`](AGENTS.md) has the page conventions, the link-checking steps and how the site is deployed.

### Where next?

Everything below is in the [Docs documentation](https://labs64.io/docs/):

| I want to… | Read |
|---|---|
| Run Labs64.IO in five minutes | [Quickstart](https://labs64.io/docs/getting-started/quickstart.html) |
| Choose how to run it | [Choose a deployment path](https://labs64.io/docs/getting-started/choose-a-deployment-path.html) |
| Change the code | [Contributing guide](https://labs64.io/docs/development/contributing.html) |
| Compare all the ways to run Labs64.IO | [Choose a deployment path](https://labs64.io/docs/getting-started/choose-a-deployment-path.html) |

Something not working? [Troubleshooting your first run](https://labs64.io/docs/getting-started/troubleshooting.html) covers the usual suspects, and you are always welcome to [open an issue](https://github.com/Labs64/labs64.io-docs/issues).

## Features

- **Adopter guides**: quickstart, one module, your own cluster, the whole ecosystem from source, troubleshooting.
- **Module references**: AuditFlow, Auth Gateway, Checkout, Payment Gateway and Customer Portal, each with capabilities, API, configuration and operations.
- **Contributor handbook**: build and test a module, the OpenAPI-first workflow, workspace layout.
- **Diagrams as code**: Mermaid in any page.
- **Machine-readable**: `llms.txt` and full-text exports for agents.
- **Docker-first**: preview, build and link-check without installing Ruby.

## Architecture

```
  ┌──────────────────────────────┐   ┌──────────────────────────────────┐
  │ Markdown in this repository  │   │ _data/modules.yml (labs64.io)    │
  │ modules/ · getting-started/  │   │ module status and versions       │
  └──────────────┬───────────────┘   └────────────────┬─────────────────┘
                 │ Jekyll + just-the-docs             │ referenced, never copied
  ┌──────────────▼────────────────────────────────────▼─────────────────┐
  │ GitHub Pages build (Actions)                                        │
  └──────────────┬──────────────────────────────────────────────────────┘
                 │ CloudFront path rewrite
  ┌──────────────▼──────────────────────────────────────────────────────┐
  │ https://labs64.io/docs                                              │
  └─────────────────────────────────────────────────────────────────────┘
```

## Where things live

| You want… | Look in |
|---|---|
| The five-minute path | [`getting-started/quickstart.md`](getting-started/quickstart.md) |
| To choose how to run it | [`getting-started/`](getting-started/index.md) |
| A module's API, configuration and operations | [`modules/<module>/`](modules/index.md) |
| How it fits together | [`introduction/architecture.md`](introduction/architecture.md) |
| To change the code | [`development/contributing.md`](development/contributing.md) |

The published site is at [labs64.io/docs](https://labs64.io/docs/).

## Using Docs with AI agents

The documentation is also written to be read by agents.

- **Plain Markdown, stable URLs.** Every page is a Markdown file under a predictable path.
- **`llms.txt`.** A machine-readable index of the site is published for agent consumers.
- **Docs follow the code.** Pages describe what ships; an agent changing a module should update its page in the same change.
- **Working on the docs with an agent?** [`AGENTS.md`](AGENTS.md) and [`CLAUDE.md`](CLAUDE.md) describe conventions and verification.

## The Labs64.IO Ecosystem

Docs is one module of the [Labs64.IO Ecosystem](https://labs64.io); [every module is documented here](https://labs64.io/docs/).

| Module | What it does | Link |
|---|---|---|
| **AuditFlow** | Audit-event routing pipeline | [labs64.io-auditflow](https://github.com/Labs64/labs64.io-auditflow) |
| **API Gateway** | Authenticating, policy-enforcing edge for all modules | [labs64.io-authproxy](https://github.com/Labs64/labs64.io-authproxy) |
| **Payment Gateway** | One API over multiple payment providers | [labs64.io-payment-gateway](https://github.com/Labs64/labs64.io-payment-gateway) |
| **Checkout** | Embeddable, brandable checkout | [labs64.io-checkout](https://github.com/Labs64/labs64.io-checkout) |
| **Customer Portal** | Customer self-service UI | [labs64.io-customer-portal](https://github.com/Labs64/labs64.io-customer-portal) |
| **Commons** | Shared Java and Python libraries | [labs64.io-commons](https://github.com/Labs64/labs64.io-commons) |
| **Helm Charts** | Kubernetes deployment for every module | [labs64.io-helm-charts](https://github.com/Labs64/labs64.io-helm-charts) |
| **Workspace** | Dev container and multi-repo tooling | [labs64.io-workspace](https://github.com/Labs64/labs64.io-workspace) |
| **Tests** | Cross-module regression suite | [labs64.io-tests](https://github.com/Labs64/labs64.io-tests) |
| **Docs** | Published documentation | [labs64.io-docs](https://github.com/Labs64/labs64.io-docs) |
| **NetLicensing** | Licensing-as-a-Service: license and entitlement management | [netlicensing.io](https://netlicensing.io) |
| **GuideChimp** | Interactive guided product tours | [labs64.com/guidechimp](https://www.labs64.com/guidechimp/) |

## Contributing

We would love your help. Found a typo, a stale command or a missing explanation? A one-line fix is a real contribution here. Fork the repository, make your change on a branch, run the checks described in [`AGENTS.md`](AGENTS.md) and open a pull request. Not sure whether an idea fits? Open an issue first and we will talk it through; that is a perfectly good way to start.

## License

Licensed under the [Apache License 2.0](LICENSE).

---

<p align="center">
  <a href="https://labs64.io"><img alt="Labs64.IO" src="https://labs64.io/docs/assets/images/labs64-logo.png" width="110"></a><br>
  <sub>Made by the <a href="https://labs64.io">Labs64</a> team and community.</sub>
</p>
