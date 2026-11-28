---
title: Workspace reference
parent: Community & Contributing
nav_order: 8
---

# Workspace reference

The commands, repositories and version rules of the [workspace](https://github.com/Labs64/labs64.io-workspace) repository. The workspace README is the short entry point; [Run the full ecosystem locally](../getting-started/run-the-full-ecosystem-locally.md) walks through the first run, and the [Contributing Guide](./contributing.md) explains where a change belongs and how to open a pull request.

## Optional EE commands

Enterprise
{: .label .label-orange }

The optional sibling repository `../labs64.io-workspace-ee/` adds commands under
`just ee`. It uses this workspace's DevContainer and shared tooling. The public
commands do not require it and keep the same behavior when it is present.

With the EE workspace in place, run `just ee clone` to clone missing
repositories listed in its `repos.txt` (Labs64 names or HTTPS GitHub URLs).
Run `just ee pull` to update its Git checkout and existing
listed checkouts. Missing checkouts are reported and skipped by `pull`.
Use `just ee show-repos` for branches and local changes, and `just ee doctor` to check
EE checkouts, remote identities, upstreams and authenticated remote access.
Run `just ee test [target]` to execute module-owned test suites for one private
runtime module or all installed modules.
The public `just doctor` remains the shared tooling check.
See `../labs64.io-workspace-ee/README.md` for configuration.

## Included repositories

The workspace clones these repositories as siblings of itself: the runtime services plus the shared libraries, infrastructure, and docs that support them.

**Services**

| Repository | Description |
|------------|-------------|
| [**labs64.io-authgateway**](https://github.com/Labs64/labs64.io-authgateway) | The Auth Gateway: the authenticated edge for the ecosystem. It verifies OIDC/JWT tokens, matches the route and asks Cerbos before a request reaches a module. |
| [**labs64.io-auditflow**](https://github.com/Labs64/labs64.io-auditflow) | Central router for audit events: redacts, routes through each tenant's pipelines and delivers to one or more destinations. |
| [**labs64.io-payment-gateway**](https://github.com/Labs64/labs64.io-payment-gateway) | One REST API in front of every payment provider (Stripe, PayPal and a NoOp test provider), with idempotent payments. |
| [**labs64.io-checkout**](https://github.com/Labs64/labs64.io-checkout) | Whitelabel order and checkout layer: purchase orders, customers, checkout transactions and a Vue 3 checkout page. |
| [**labs64.io-reporting**](https://github.com/Labs64/labs64.io-reporting) | Read-only reports over the events AuditFlow stored, per customer. |
| [**labs64.io-customer-portal**](https://github.com/Labs64/labs64.io-customer-portal) | Customer-facing Vue 3 single-page app, served as static files by unprivileged nginx. |

**Shared libraries, infrastructure and docs**

| Repository | Description |
|------------|-------------|
| [**labs64.io-commons**](https://github.com/Labs64/labs64.io-commons) | Shared libraries (the build parent, auth context for Java and Python, OpenAPI tooling, policy tooling) consumed by the modules. |
| [**labs64.io-helm-charts**](https://github.com/Labs64/labs64.io-helm-charts) | Kubernetes Helm charts (module charts + the `labs64io-ecosystem` umbrella), the local Helmfile stack, and the centralized observability stack. |
| [**labs64.io-tests**](https://github.com/Labs64/labs64.io-tests) | Black-box, contract-first API regression & integration test suite (Robot Framework). |
| [**labs64.io-docs**](https://github.com/Labs64/labs64.io-docs) | Public-facing product documentation and developer integration guides. |
| [**labs64.io**](https://github.com/Labs64/labs64.io) | Public marketing website (labs64.io). |

## Key features

### The knowledge graph

The ecosystem is indexed by a shared knowledge graph (`../graphify-out/`, at the ecosystem root so it spans every sibling repo). Use `graphify` for architectural queries:

```bash
graphify query "<question>"    # targeted lookup
graphify update ..             # refresh after code changes (indexes all sibling repos)
```

### AI skills

The workspace is equipped with custom AI agent skills located in `.agents/skills/` to automate complex ecosystem workflows. Available skills include:

- `openapi-first-change`: For safely updating OpenAPI specifications.
- `helm-config-binding-check`: For verifying Helm chart config mapping.
- `local-k8s-qa-audit`: For auditing local Kubernetes deployments.
- `ecosystem-website-sync`: For keeping the public website in sync with the ecosystem.
- `test-suite-steward`: For auditing and extending the black-box test suite.
- `boxdiagram`: For drawing diagrams as text sources and rendering them to SVG.
- `standards-*` (quality-bar, reliability, performance, security, compatibility, messaging, kubernetes, observability, maintainability, data-integrity, testing, cost): The engineering standards, one skill per work area, loaded when a change touches that area.

## Development commands

### Working with repositories

```bash
just list-prs           # open pull requests across all repos
just check-deps         # confirm every Java module resolves its dependencies offline
just check              # cross-repo gates: release wiring, Renovate wiring, shared version pins, justfiles
just ci                 # what this repository's CI runs: the gates' own tests, actionlint, the Renovate preset, every gate
```

### Versions, releases and dependency updates

Every version has exactly one owner; nothing below is restated anywhere else.

| What | Single source |
|------|---------------|
| CLI toolchain (helm, helmfile, k3d, terraform, …) for the dev container **and** CI | [`tool-versions.env`](https://github.com/Labs64/labs64.io-workspace/blob/master/tool-versions.env); `just doctor` reports drift |
| Spring Boot line, BOM overrides, shared Java dependency/plugin versions, commons libraries | `io.labs64:labs64io-parent` in `labs64.io-commons` |
| Third-party Helm chart versions and repositories | `labs64.io-helm-charts/helmfile.yaml.gotmpl` |
| CRD sets applied outside Helm (Gateway API, Traefik CRDs) | `labs64.io-helm-charts/justfile.versions` |
| Dependency updates in all repositories | Renovate, shared preset [`default.json`](https://github.com/Labs64/labs64.io-workspace/blob/master/default.json) |

**Releasing** is the same gesture in every repository: publish a GitHub Release whose tag is the
version (`X.Y.Z`). No pom carries a version — the tag becomes the jar, the image tag and label,
and the chart `appVersion`; the module chart and the umbrella are bumped by an automated PR. The
published umbrella chart version is the ecosystem release; whoever operates an environment pins it. Release order when commons changed:
`commons` → modules pin the new `labs64io-parent` → module releases. See
[Reusable workflows](./reusable-workflows.md) for the pipeline in detail.

`just check` verifies the parts no single repository can see: `check-release-wiring` (every
released image reaches its chart) and `check-pins` (pins that two files or repositories must
share actually agree; no pom hard-codes a version; no version constant creeps back into a
justfile; the local k3s minor equals EKS and the local PostgreSQL, Valkey and RabbitMQ lines
equal the AWS ones).

The Helm charts repository keeps its own pins in a `justfile.versions` that its justfile `import`s,
so recipes still use `{% raw %}{{GATEWAY_API_VERSION}}{% endraw %}` and the like unchanged. (`just` loads only one dotenv file, and that
justfile already uses it for the shared `tool-versions.env`.)
To bump a version, edit that one file or merge the Renovate PR.

Pass `0` as the `verbose` argument to switch to a quieter animated-progress mode that only prints a module's log if it fails, e.g. `just build all 0` or `just check-deps 0`.
