---
title: Releases and versions
parent: Community & Contributing
nav_order: 3
---

# Releases and versions

One release model applies to every Labs64.IO repository.

## Principles

1. **A release is a tag.** Publishing a GitHub Release with tag `X.Y.Z` (no `v` prefix) is the whole release gesture. Nothing is committed back.
2. **No file carries the version.** Java poms declare `<version>${revision}</version>`, which defaults to `0.0.0-SNAPSHOT` (built from source, unreleased). The release build sets it from the tag, so the jar, the image tag and label and the chart `appVersion` are the same number.
3. **Releases are rebuildable.** A release build refuses any `-SNAPSHOT` parent or dependency.
4. **Deploy by digest.** The release pipeline pins first-party images in the charts as `image@sha256:…`. A tag can be moved, a digest cannot.
5. **Every version has one owner.** A version is written in exactly one place. `just check-pins` checks any value that two places must share.
6. **The umbrella chart version is the ecosystem release.** Install a new version of `labs64io-ecosystem` to get a consistent set of modules.

## What is published where

| Repository | Artefacts | Published to |
|---|---|---|
| `labs64.io-commons` | `io.labs64:labs64io-parent` and the [shared libraries](./shared-libraries.md), all on one version | Labs64 Nexus; Maven Central for selected artefacts |
| `labs64.io-auditflow` | Images `labs64/auditflow`, `labs64/auditflow-transformer`, `labs64/auditflow-sink`; jar `io.labs64:auditflow-api` | Docker Hub; Labs64 Nexus and Maven Central |
| `labs64.io-payment-gateway` | Image `labs64/payment-gateway` | Docker Hub |
| `labs64.io-checkout` | Images `labs64/checkout`, `labs64/checkout-ui` | Docker Hub |
| `labs64.io-customer-portal` | Image `labs64/customer-portal-ui` | Docker Hub |
| `labs64.io-authproxy` | Image `labs64/traefik-authproxy` (deployed by chart `api-gateway`) | Docker Hub |
| `labs64.io-helm-charts` | Module charts, `chart-libs`, `preflight`, the `labs64io-ecosystem` umbrella | Helm repository `https://labs64.github.io/labs64.io-helm-charts`, one GitHub Release per chart |

A release pushes `labs64/<image>:X.Y.Z` and `:latest`. Every green build of a main branch also pushes `:edge`, used only by the nightly regression run.

## Version numbers

| Number | Meaning |
|---|---|
| `X.Y.Z` | A module release: jar, image tag and label, chart `appVersion` |
| `0.0.0-SNAPSHOT` | Built from source and unreleased. Local builds and main-branch CI use it. |
| `edge` | The latest green main-branch image |
| `labs64io-parent` version | The Spring Boot line, security overrides, shared Java dependency versions and every commons library version |
| Chart `version` | A chart package. It bumps whenever the chart or a chart it bundles changes. |
| `labs64io-ecosystem` version | The ecosystem release |

Other pins each have a single home: the CLI toolchain in `labs64.io-workspace/tool-versions.env`, third-party Helm charts in `labs64.io-helm-charts/helmfile.yaml.gotmpl`, CRD sets in `labs64.io-helm-charts/justfile.versions`.

## How a module release flows

![Release flow: a maintainer publishes a GitHub Release, the release workflow pushes the images to Docker Hub and sends their digests to the helm-charts repository, where a chart-update pull request is reviewed and merged and the chart release publishes the new labs64io-ecosystem version](./diagrams/release-flow.svg)

1. A maintainer publishes a GitHub Release `X.Y.Z` on the main branch.
2. The release workflow tests, builds the multi-arch images with that version, pushes them and verifies their labels.
3. It sends the image digests to the helm-charts repository, where an automated pull request pins them, sets `appVersion` and bumps the module chart and the umbrella chart.
4. A maintainer checks the digests against the release run and merges.
5. The chart release publishes the new chart versions to the Helm repository.

If `labs64.io-commons` changed, release it first, then move the modules to the new `labs64io-parent` (Renovate opens those pull requests), then release the modules.

To consume a release, upgrade to the new `labs64io-ecosystem` version, or to the new module chart version if you install modules individually.

## Dependency updates

[Renovate](https://docs.renovatebot.com/) proposes updates in every repository from one shared preset (`default.json` in the workspace).

- Renovate groups routine updates and opens them weekly. It proposes new Labs64 artefacts, such as a new `labs64io-parent` or a new umbrella chart, at any time. Major updates carry the label `major-update`.
- Renovate never touches first-party images. The release pipeline pins them.
- A version written outside a package manifest needs a comment naming its source on the line above, so Renovate can follow it:

  ```text
  # renovate: datasource=github-releases depName=kubernetes-sigs/gateway-api
  GATEWAY_API_VERSION := "v1.6.2"
  ```

## Gates

| Gate | Where | Fails when |
|---|---|---|
| Chart version bump (`just check-bumps`) | helm-charts pull requests | A changed chart, or a chart bundling it, kept its version. Fix with `just bump <chart>`. |
| Chart lint | helm-charts pull requests | Generated files are stale, or a credential is in a ConfigMap. |
| `just check` | Workspace, on every change and daily | Shared pins disagree, a pom hard-codes a version, or a released image does not reach its chart. |
| Release build rules | Release builds | A `-SNAPSHOT` input, or a jar whose version differs from the tag. |
| v1 API freeze | AuditFlow pull requests | The frozen v1 OpenAPI contract loses or narrows something. |
