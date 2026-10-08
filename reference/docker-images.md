---
title: Docker Images Index
parent: Reference
nav_order: 4
---

# Docker Images Index

Labs64.IO publishes every image to Docker Hub under `labs64/`. A release publishes `:X.Y.Z` and `:latest`. Every green main-branch build publishes `:edge`. In shared environments, deploy by digest with `image.digest` in the charts, not by tag. See [Releases and versions](../development/releases.md).

Images run as the non-root user `l64user` (uid/gid 1064). The Nginx-based UI images run as the unprivileged Nginx user. No image carries an OpenTelemetry SDK. When you enable observability at deployment, Java services get the OpenTelemetry Java agent and Python services get `opentelemetry-instrument`.

| Module | Image | Base image |
|---|---|---|
| AuditFlow backend | `labs64/auditflow` | `eclipse-temurin:25-jre` |
| AuditFlow transformer | `labs64/auditflow-transformer` | `python:3.14-alpine` |
| AuditFlow sink | `labs64/auditflow-sink` | `python:3.14-alpine` |
| Payment Gateway | `labs64/payment-gateway` | `eclipse-temurin:25-jre` |
| Checkout backend | `labs64/checkout` | `eclipse-temurin:25-jre` |
| Checkout UI | `labs64/checkout-ui` | `nginxinc/nginx-unprivileged` (Alpine) |
| Customer Portal | `labs64/customer-portal-ui` | `nginxinc/nginx-unprivileged` (Alpine) |
| Auth Gateway | `labs64/traefik-authproxy` | `python:3.14-slim` |
