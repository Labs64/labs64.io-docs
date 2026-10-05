---
title: Contributing
parent: Community & Contributing
nav_order: 1
---

# Contributing guide

Labs64.IO lives in focused repositories. The [workspace repository](https://github.com/Labs64/labs64.io-workspace) coordinates them. It clones the ecosystem, provides a DevContainer with every tool, and runs cross-repository tasks with one `justfile`.

## Set up the workspace

The workspace clones the ecosystem repositories next to itself, so give it a folder of its own:

```text
<ecosystem-root>/
├── labs64.io-workspace/     # justfile, DevContainer, scripts: run every command here
├── labs64.io-auditflow/
├── labs64.io-helm-charts/
└── ...
```

```bash
mkdir labs64io && cd labs64io
git clone https://github.com/Labs64/labs64.io-workspace.git
cd labs64.io-workspace     # keep this name: the DevContainer expects it
just clone                 # clone the ecosystem repositories into ../
```

Open `labs64.io-workspace` in VS Code and choose **Reopen in Container**. The DevContainer mounts the parent folder, so every repository is visible, and provides Java 25 with Maven, Python 3.14, Node.js, Terraform, Docker, k3d, Helm, Helmfile, kubectl and `just`. `labs64.io.code-workspace` opens all repositories as one multi-root workspace.

Without the DevContainer, install Docker, k3d 5+, Helm 3+ with the helm-diff plugin, Helmfile 1+, kubectl 1.28+ and `just`. To build images locally, also install Java 25, Maven and Node.js. `just doctor` checks them against the pinned versions.

## Everyday commands

Run them in `labs64.io-workspace`. `just --list` shows all of them.

| Command | What it does |
|---|---|
| `just doctor` | Check installed tools against the pinned versions |
| `just clone`, `just pull`, `just status` | Clone, update and show the state of every repository |
| `just up`, `just down` | `just up` creates the local k3d cluster, builds images and deploys the stack. `just down` tears the cluster down. |
| `just logs [module]` | Tail error logs of all modules, or one |
| `just smoke`, `just regression`, `just test` | Run the [regression suite](./testing.md) against the local stack |
| `just check` | Run the cross-repository gates for release wiring and shared version pins |
| `just verify-deps` | Check that every Java module resolves its dependencies |

`just up` deploys the stack described by `labs64.io-helm-charts/overrides/helmfile/values.local.yaml`, which also selects the local identity provider (mock OIDC or Keycloak). The cluster layout and manual setup steps are in [`DEVELOPERS.md`](https://github.com/Labs64/labs64.io-helm-charts/blob/master/DEVELOPERS.md) of the helm-charts repository.

## Make a change

1. Work in the repository that owns the behaviour, on a branch.
2. **Contracts first.** An API change starts in the module's OpenAPI document. The build generates the code and the authorization policy from it. Never edit generated code.
3. Update the module's tests, the Helm chart if configuration changes, and this documentation in the same change.
4. Run the repository's own checks (`just test` in the module) and, for cross-module changes, the regression suite.
5. Open a pull request; CI runs the same checks.

Rules that apply in every repository:

- Never commit credentials. Configuration comes from environment variables or Kubernetes Secrets.
- Never write a version. See [Releases and versions](./releases.md).
- Container images run as the non-root user `l64user` (uid/gid 1064).
- Services carry no OpenTelemetry SDK. The deployment attaches instrumentation.
- Each repository has its own history. A change that spans repositories needs one pull request per repository.

## Where to make common changes

| Goal | Where |
|---|---|
| A module's API | `<module>/…/openapi/*.yaml` in the module repository |
| An AuditFlow sink or transformer | `auditflow-sink/sinks/` or `auditflow-transformer/transformers/` |
| A payment provider | `payment-gateway-providers/<psp>/` |
| Gateway authentication behaviour | `labs64.io-authproxy/traefik-authproxy/` |
| Helm templates and values | `labs64.io-helm-charts/charts/<chart>/` |
| A shared Java version or library | `labs64.io-commons/labs64io-parent/` |
| A CLI tool version | `labs64.io-workspace/tool-versions.env` |
| Regression tests | `labs64.io-tests/` or `<module>/tests/e2e/` |

## Next steps

- [Workspace and source repositories](./workspace-repositories.md)
- [Releases and versions](./releases.md)
- [Testing](./testing.md)
- [Shared libraries](./shared-libraries.md)
