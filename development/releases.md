---
title: Releases and versions
parent: Community & Contributing
nav_order: 5
---

# Releases and versions

One release model applies to every Labs64.IO repository. This page describes what a release publishes, which number means what, and how a module release reaches the Helm charts you install.

## Principles

1. **A release is a tag.** A maintainer publishes a GitHub Release with the tag `X.Y.Z`, without a `v` prefix. That is the whole release gesture. The pipeline commits nothing back to the repository.
2. **No file carries the version.** Java poms declare `<version>${revision}</version>`, which defaults to `0.0.0-SNAPSHOT` for a build from source. The release build passes the tag as the version, so the jar, the image tag, the image label and the chart `appVersion` carry the same number.
3. **A release is rebuildable.** A release build refuses any `-SNAPSHOT` parent or dependency, so a tag always builds from the same inputs.
4. **Charts deploy by digest.** The release pipeline pins every first-party image in its chart as `image@sha256:…`. Docker Hub lets anyone with push rights move a tag. Nobody can move a digest.
5. **Every version has one owner.** Each version is written in exactly one place. The workspace's `just check-pins` verifies every value that two places must share.
6. **The umbrella chart version is the ecosystem release.** A new version of the `labs64io-ecosystem` chart is a set of module versions that were released and tested together.
7. **A person decides twice: at the release and at the deployment.** Publishing a module release is the decision to ship it. The pull request that pins the release into its chart merges itself once its checks pass. Whoever operates an environment decides when to install a new chart version.

## What is published where

| Repository | Artefacts | Published to |
|---|---|---|
| `labs64.io-commons` | `io.labs64:labs64io-parent` and the [shared libraries](./shared-libraries.md), all at one version | Labs64 Nexus. Maintainers promote selected releases to Maven Central. |
| `labs64.io-auditflow` | Images `labs64/auditflow`, `labs64/auditflow-transformer` and `labs64/auditflow-sink`, and the jar `io.labs64:auditflow-api`, all at one version | Images to Docker Hub. The jar to Labs64 Nexus, and selected releases to Maven Central. |
| `labs64.io-payment-gateway` | Image `labs64/payment-gateway` | Docker Hub |
| `labs64.io-checkout` | Images `labs64/checkout` and `labs64/checkout-ui` | Docker Hub |
| `labs64.io-customer-portal` | Image `labs64/customer-portal-ui` | Docker Hub |
| `labs64.io-authproxy` | Image `labs64/traefik-authproxy`, deployed by the chart `api-gateway` | Docker Hub |
| `labs64.io-helm-charts` | The module charts, `chart-libs`, `preflight` and the `labs64io-ecosystem` umbrella chart | The Helm repository `https://labs64.github.io/labs64.io-helm-charts`, with one GitHub Release per chart version |

A release pushes `labs64/<image>:X.Y.Z` and `:latest`, built for `linux/amd64` and `linux/arm64`. Every green build of a main branch also pushes `:edge`. Only the nightly regression run deploys `:edge`.

Every Java release goes to Labs64 Nexus. Maven Central receives a release only when a maintainer runs the manual promotion for it, after the release is on Nexus. If you use a library outside the Labs64.IO repositories, pick a version that is on [Maven Central](https://central.sonatype.com/namespace/io.labs64).

## Version numbers

| Number | Meaning |
|---|---|
| `X.Y.Z` | A module release. It is the jar version, the image tag and label, and the chart `appVersion`. |
| `0.0.0-SNAPSHOT` | Built from source and not released. Local builds and main-branch CI use it. |
| `edge` | The latest image from a green main-branch build |
| `labs64io-parent` version | The Spring Boot line, the security overrides, the shared Java dependency versions and the version of every commons library |
| Chart `version` | A chart package. It goes up at every module release and whenever the chart, or a chart it bundles, changes. |
| `labs64io-ecosystem` version | The ecosystem release |

The remaining pins each have one home. The CLI toolchain for the dev container and CI is in `labs64.io-workspace/tool-versions.env`. Third-party Helm charts and Helm repositories are in `labs64.io-helm-charts/helmfile.yaml.gotmpl`. The CRD sets that `kubectl` applies are in `labs64.io-helm-charts/justfile.versions`.

## How a module release flows

![Release flow: a maintainer publishes a GitHub Release, the release workflow pushes the images to Docker Hub and sends their digests to the Helm charts repository, where the chart update pull request merges itself once chart CI passes, the chart release publishes a new labs64io-ecosystem version to the Helm repository, and you upgrade your cluster to it](./diagrams/release-flow.svg)

1. A maintainer publishes a GitHub Release `X.Y.Z` on the main branch of the module repository.
2. The release workflow runs the tests, builds the multi-architecture images with that version, pushes them and checks their labels. AuditFlow also publishes `auditflow-api` to Labs64 Nexus.
3. The workflow sends the digests of all the module's images to the Helm charts repository. There, an automated pull request pins the digests, sets `appVersion`, and bumps the version of the module chart and of the umbrella chart.
4. The pull request merges itself once both chart workflows, Lint Charts and Published Chart E2E, pass on its current head and `master` has not moved under it. When modules are released together and their pull requests conflict, the Helm charts repository rebuilds them on the next push to `master`. Maintainers can switch the automatic merge off with the repository variable `CHART_UPDATE_AUTOMERGE`.
5. The chart release publishes every chart whose version is new to the Helm repository.

A module chart deploys all of its first-party images at one `appVersion`, so the pull request pins all of them or none. Replaying a release is safe, because the chart update does nothing when the digests are already pinned.

When `labs64.io-commons` changed, release it first. Renovate then opens a pull request in each Java module that moves it to the new `labs64io-parent`. Merge those, then release the modules. Release AuditFlow before Payment Gateway when Payment Gateway needs a new `auditflow-api`, because Payment Gateway pins a released version of it.

To consume a release, upgrade to the new `labs64io-ecosystem` version, or to the new module chart version if you install modules one by one. Published chart versions and image digests stay available, so you can roll back by installing the previous chart version.

## Dependency updates

[Renovate](https://docs.renovatebot.com/) proposes dependency updates in every repository. Each repository's `renovate.json` only extends the shared preset `default.json` in `labs64.io-workspace`, so the rules live in one place.

- Renovate groups routine updates and opens them on Monday mornings (Europe/Berlin).
- It proposes new Labs64 artefacts, such as a new `labs64io-parent`, a new `auditflow-api` or a new umbrella chart, at any time.
- Major updates carry the label `major-update`.
- PostgreSQL, RabbitMQ and Valkey images take patch updates only.
- Renovate never touches first-party images. The release pipeline pins those by digest.
- A version written outside a package manifest needs a comment on the line above it that names its source, so Renovate can follow it:

  ```text
  # renovate: datasource=github-releases depName=kubernetes-sigs/gateway-api
  GATEWAY_API_VERSION := "v1.6.2"
  ```

Each repository's *Dependency Dashboard* issue lists the open, pending and ignored updates.

## Gates

| Gate | Runs | Fails when |
|---|---|---|
| Chart version bump (`just check-bumps`) | Pull requests in `labs64.io-helm-charts` | A changed chart, or a chart that bundles it, kept its version. `just bump <chart>` fixes it. |
| Chart lint | Pull requests in `labs64.io-helm-charts` | Generated schemas or docs are out of date, or a ConfigMap holds a credential |
| `just check` | `labs64.io-workspace`, locally, on every change and daily | Pins that two places share disagree, a pom hard-codes a version, or a released image does not reach its chart |
| Release build rules | Release builds | An input is a `-SNAPSHOT`, or the jar version differs from the tag |
| v1 API freeze | Pull requests in `labs64.io-auditflow` | A change removes or narrows something in the frozen v1 OpenAPI contract |
