---
title: Environment Variables
nav_exclude: true
---

# Environment Variables

This section outlines the standard environment variables recognized across the Labs64.IO ecosystem. 

## Standard System Variables

| Variable | Description | Default | Applicable To |
|----------|-------------|---------|---------------|
| `SPRING_PROFILES_ACTIVE` | Defines the active Spring Boot profile (e.g., `prod`, `dev`). | `default` | Java Backend Modules |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | The address of the OpenTelemetry Collector. | `http://otel-collector:4318` | All Modules |
| `JAVA_TOOL_OPTIONS` | Used to inject the OTel Java Agent automatically at startup. | - | Java Backend Modules |

For module-specific application properties (like `SPRING_DATASOURCE_URL` or `PAYMENT_STRIPE_KEY`), refer to the respective module's **Configuration** guide.
