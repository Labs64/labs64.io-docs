---
title: Configuration
parent: Getting Started
nav_order: 2
---

# Configuration Overview

Labs64.IO modules are designed to be configured externally using a Twelve-Factor App approach. Configuration is never hardcoded and is provided via environment variables, Kubernetes Secrets, or Helm `values.yaml` overlays.

## Configuration Principles

- **No Hardcoded Credentials:** All credentials must be injected via Secrets.
- **Environment Variables:** Used for runtime overrides (e.g., PSP API keys).
- **Helm Values:** Used for declarative infrastructure configurations (e.g., replica counts, ingress hosts).
- **Module Specific:** Each module maintains its own configuration surface.

## Helm Values Structure

When deploying via Kubernetes, the primary configuration surface is `values.yaml`.

| Section | Purpose | Example |
|---------|---------|---------|
| `image` | Defines the container image and tag. | `repository: labs64/auditflow` |
| `replicaCount` | Number of pods to run. | `replicaCount: 2` |
| `ingress` | Routing configuration for Traefik. | `host: auditflow.labs64.io` |
| `env` | Direct environment variable injection. | `SPRING_PROFILES_ACTIVE: prod` |
| `observability`| Toggles tracing and metrics. | `enabled: true` |

## Production Recommendations

For production environments:
1. Always use Kubernetes Secrets for sensitive values. Reference them in Helm using the `envFrom` or explicit secret references.
2. Enable `observability.enabled` to ensure traces and metrics are collected.
3. Manage your configuration using GitOps (e.g., ArgoCD) to maintain an audit trail of configuration changes.

For specific configuration options for a particular module, refer to the **Configuration** section within that module's documentation page (e.g., [AuditFlow Configuration](../modules/auditflow/)).
