---
title: Docker Images Index
parent: Reference
nav_order: 4
---

# Docker Images Index

All Labs64.IO Docker images are published to Docker Hub under `labs64/`. A GitHub Release of a module publishes its images as `:X.Y.Z` and `:latest`, and every green build of the main branch publishes `:edge`. [Releases and versions](../development/releases.md) describes the whole release flow. The published Helm charts pin each image by digest; see [Image pinning](../operate-manage/kubernetes-helm-setup.md#image-pinning). The images adhere to the following principles:
- **Non-root user execution:** The service images run as `l64user` (uid/gid 1064). The Nginx-based UI images run as the unprivileged Nginx user (uid 101).
- **Runtime observability:** No image contains an OpenTelemetry SDK. When you enable observability at deployment, Java images start the bundled OpenTelemetry Java agent and Python images start under `opentelemetry-instrument`. The same image runs with observability on or off.

## Published Images

| Module | Registry Repository | Base Image |
|--------|---------------------|------------|
| **AuditFlow (backend)** | `labs64/auditflow` | `eclipse-temurin:25-jre` |
| **AuditFlow (transformer)** | `labs64/auditflow-transformer` | `python:3.15-alpine` |
| **AuditFlow (sink)** | `labs64/auditflow-sink` | `python:3.15-alpine` |
| **Payment Gateway** | `labs64/payment-gateway` | `eclipse-temurin:25-jre` |
| **Checkout (backend)** | `labs64/checkout` | `eclipse-temurin:25-jre` |
| **Checkout (UI)** | `labs64/checkout-ui` | `nginxinc/nginx-unprivileged` (Alpine) |
| **Customer Portal** | `labs64/customer-portal-ui` | `nginxinc/nginx-unprivileged` (Alpine) |
| **Auth Gateway** | `labs64/traefik-authproxy` | `python:3.15-slim` |

`labs64/customer-portal-ui` is published as `:edge` only, so set `ui.image.tag` or `ui.image.digest` when you install the `customer-portal` chart. The `authz-pdp` and `api-docs` charts run the upstream images `ghcr.io/cerbos/cerbos` and `swaggerapi/swagger-ui`.
