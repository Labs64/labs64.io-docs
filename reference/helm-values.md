---
title: Helm Values
parent: Reference
nav_order: 5
---

# Helm Values

All Labs64.IO modules are deployed using Helm. While each module exposes its own `values.yaml`, they all share a standard set of root keys for consistency.

## Standard Chart Structure

| Value Key | Description | Default Type |
|-----------|-------------|--------------|
| `image.repository` | Docker image name. | string |
| `image.tag` | Docker image tag. | string |
| `replicaCount` | Number of pods. | integer |
| `ingress.enabled` | Whether to create an Ingress resource. | boolean |
| `ingress.hosts` | List of hostnames for routing. | array |
| `env` | Environment variables injected into the pod. | map (key/value) |
| `envFrom` | Secrets or ConfigMaps to load as environment variables. | list |
| `observability.enabled` | Toggle OTEL auto-instrumentation. | boolean |

For module-specific Helm configurations, check the **Configuration** section within the specific module documentation (e.g., [Checkout Configuration](../modules/checkout/)).
