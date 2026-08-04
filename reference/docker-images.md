---
title: Docker Images Index
parent: Reference
nav_order: 4
---

# Docker Images Index

All Labs64.IO Docker images are published to our official container registry. They adhere to the following principles:
- **Non-root user execution:** All images run as `l64user` (uid/gid 1064), except for `nginx`-based frontend images which may use uid 101.
- **Embedded Observability:** Java images include the OpenTelemetry Java Agent. Python images include `opentelemetry-instrument`.

## Published Images

| Module | Registry Repository | Base Image |
|--------|---------------------|------------|
| **AuditFlow (API)** | `labs64io/auditflow-api` | `eclipse-temurin:25-jre` |
| **AuditFlow (Transformers)** | `labs64io/auditflow-transformer` | `python:3.13-slim` |
| **AuditFlow (Sinks)** | `labs64io/auditflow-sink` | `python:3.13-slim` |
| **Checkout** | `labs64io/checkout` | `eclipse-temurin:25-jre` |
| **Payment Gateway** | `labs64io/payment-gateway` | `eclipse-temurin:25-jre` |
| **Auth Gateway** | `labs64io/authproxy` | `traefik:v3` |
| **Customer Portal** | `labs64io/customer-portal` | `nginx:alpine` |
