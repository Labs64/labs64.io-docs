---
title: Contributing
parent: Community & Contributing
nav_order: 1
---

# Contributing Guide

Contributions of every size are welcome: a fixed typo, a clearer sentence, a new AuditFlow sink, a bug fix in a service. This page takes you from nothing to an open pull request.

## Pick your starting point

| You want to… | Do this |
|---|---|
| Fix or improve a documentation page | Use **Edit this page on GitHub** at the bottom of the page. GitHub forks the repository and opens the pull request for you |
| Report a bug or ask for a feature | Open an issue in the [repository that owns it](./workspace-repositories.md). Say what you did, what you expected and what happened |
| Change one service | Fork that service's repository and work in it directly. Each one builds and tests on its own |
| Change how services work together, or the Helm charts | Set up the [full ecosystem](../getting-started/run-the-full-ecosystem-locally.md) |

Unsure whether an idea fits? Open an issue first and describe it. That is cheaper for everyone than a pull request that has to be reworked.

## Set up

For a single service you need that repository and its tools, listed in its `README.md`. For example, AuditFlow:

```bash
git clone https://github.com/<your-user>/labs64.io-auditflow.git
cd labs64.io-auditflow
just up       # run it
just test     # run its tests
```

For anything that spans services, use the workspace. It clones every repository side by side and gives you one command to build and run them all:

```bash
mkdir labs64.io && cd labs64.io
git clone https://github.com/Labs64/labs64.io-workspace.git
cd labs64.io-workspace
just doctor && just clone && just up
```

[Run the full ecosystem locally](../getting-started/run-the-full-ecosystem-locally.md) walks through these steps, and the [workspace README](https://github.com/Labs64/labs64.io-workspace#readme) is the full command reference. From the workspace you reach the other repositories' recipes without changing folder: `just helm-charts <recipe>` runs in `labs64.io-helm-charts`, `just tests <recipe>` in `labs64.io-tests`. The workspace also ships a dev container with every tool at the pinned version, which is the easiest way to get a working toolchain.

When you fork, clone your fork in place of the upstream repository, in the same folder and under the same name.

## Where a change goes

Labs64.IO is many repositories, not one. A change belongs to the repository that owns the thing you are changing, and each pull request stays within one repository.

| To change… | Go to |
|---|---|
| An API: a field, an endpoint, a model | The module's OpenAPI file, under `src/main/resources/openapi/` |
| Where AuditFlow can deliver events | A new file in `labs64.io-auditflow/auditflow-sink/sinks/` |
| How AuditFlow reshapes events | A new file in `labs64.io-auditflow/auditflow-transformer/transformers/` |
| A payment provider integration | `labs64.io-payment-gateway/payment-gateway-providers/` |
| Authentication at the edge | `labs64.io-authproxy/traefik-authproxy/` |
| How something is deployed | `labs64.io-helm-charts/charts/<chart>/` |
| A regression test at the API edge | `labs64.io-tests/` |
| These pages | `labs64.io-docs/` |

Every repository has an `AGENTS.md` at its root. Despite the name, it is the most useful page for a human newcomer too: it describes the layout, the rules and the commands of that repository.

## Rules that keep the build green

A few conventions are enforced by the build or by review. Knowing them up front saves a round trip.

- **APIs are OpenAPI-first.** Change the YAML contract and rebuild. Never edit the generated Java under `target/`; it is overwritten on the next build.
- **No credentials in code or in committed files.** Use environment variables and Kubernetes Secrets.
- **Images run as a non-root user.** Keep the `l64user` user in every Dockerfile.
- **Services do not instrument themselves.** Tracing, metrics and log shipping are injected at deployment time. Do not add an OpenTelemetry SDK to a service.
- **Each service owns its data.** A service never connects to another service's database.
- **A chart change bumps the chart version.** In `labs64.io-helm-charts`, run `just bump <chart>`; it also bumps every chart that bundles the one you changed.
- **Versions have one owner each.** Do not write a version number into a `pom.xml` or a `justfile`. The workspace's `just check` verifies this across repositories.
- **Recipes follow one convention.** The same recipe name means the same thing in every repository, and a new recipe goes in `just/<group>.just` with a one-line description: see [Justfiles: where to run what](https://github.com/Labs64/labs64.io-workspace/blob/master/docs/justfiles.md). `just check` verifies it too.

## Before you open the pull request

1. Run `just ci` in the repository you changed: it runs what that repository's pull-request check runs, so it passes locally for the same reasons it passes there. In a repository without a `ci` recipe, `just --list` shows its test command.
2. If the change crosses service boundaries, run `just smoke` from the workspace against your local cluster.
3. If behavior changed, update the documentation in the same contribution: the API contract, the chart's values, and the page here that describes it.

## Open the pull request

1. Push a branch to your fork.
2. Open a pull request against `master` of the upstream repository.
3. Describe what you changed and why. A reviewer who understands the reason reviews faster.
4. A change that spans repositories needs one pull request per repository. Link them to each other in the descriptions.

Continuous integration runs on every pull request. A maintainer reviews it and merges it, or tells you what is missing.

## License

The community modules of Labs64.IO are licensed under the [Apache License 2.0](https://github.com/Labs64/labs64.io-workspace/blob/master/LICENSE). Contributions are accepted under the same license.
