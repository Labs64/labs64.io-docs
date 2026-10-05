---
title: Configuration Overview
nav_exclude: true
---

# Configuration Overview

Labs64.IO modules are designed to be configured externally using a Twelve-Factor App approach. Configuration is never hardcoded and is provided via environment variables, Kubernetes Secrets, or Helm `values.yaml` overlays.

## Configuration Principles

- **No Hardcoded Credentials:** All credentials must be injected via Secrets.
- **Environment Variables:** Used for runtime overrides (e.g., PSP API keys).
- **Helm Values:** Used for declarative infrastructure configuration, such as replica counts and gateway routes.
- **Module Specific:** Each module maintains its own configuration surface.

## Helm Values Structure

On Kubernetes, you configure each module through the values of its chart. See the [Helm charts reference](../reference/helm-values.md).

| Section | Purpose | Example |
|---------|---------|---------|
| `image` | Container image, tag or digest. | `repository: labs64/auditflow` |
| `replicaCount` | Number of pods to run. | `replicaCount: 2` |
| `gateway` | Gateway API routes of the module. | `enabled: true` |
| `applicationYaml` | Application configuration of a Java service. | `spring.profiles.active: prod` |
| `secrets` / `externalSecrets` | Credentials, from a Secret or External Secrets Operator. | `externalSecrets.enabled: true` |
| `observability` | Toggles tracing and metrics. | `enabled: true` |

## Production Recommendations

For production environments:
1. Always use Kubernetes Secrets for sensitive values. Supply them through `secrets.data` from your CI, or set `externalSecrets.enabled: true`.
2. Enable `observability.enabled` to ensure traces and metrics are collected.
3. Manage your configuration using GitOps (e.g., ArgoCD) to maintain an audit trail of configuration changes.

For specific configuration options for a particular module, refer to the **Configuration** section within that module's documentation page (e.g., [AuditFlow Configuration](../modules/auditflow/index.md)).
