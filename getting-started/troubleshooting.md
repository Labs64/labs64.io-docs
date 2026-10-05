---
title: Local Troubleshooting Notes
nav_exclude: true
---

# Troubleshooting

This guide covers common issues encountered during the evaluation and deployment of the Labs64.IO ecosystem.

## Common Onboarding Errors

### Docker Compose Fails to Start

**Symptom:** `just up` fails with a Maven build error.
**Resolution:** Ensure you are using Java 25. The build process enforces this version strictly. Run `java -version` to verify.

### Kubernetes Pods Pending

**Symptom:** `kubectl get pods` shows pods stuck in the `Pending` state.
**Resolution:** Your local k3d cluster may lack sufficient resources. Ensure Docker Desktop (or your container engine) is allocated at least 4 CPUs and 8GB of RAM.

### Connection Refused on Gateway

**Symptom:** Browsing to `http://gateway.localhost` returns connection refused.
**Resolution:** Verify that Traefik is running. In a k3d deployment, Traefik binds to port 80 on your host. Ensure no other service (like Apache or Nginx) is already using port 80.

### 403 Forbidden on API Requests

**Symptom:** API requests return `403 Forbidden`.
**Resolution:** 
1. Ensure the request is routed through the Auth Gateway.
2. Verify that you have provided a valid OIDC/JWT token.
3. Find the Auth Gateway's `authz` log line for the request in the log of the `gateway-common` pod in namespace `labs64io`. The line names the operation and the decision. The system **fails closed**, so the Auth Gateway rejects unmapped routes and missing tokens.

## Diagnostic Commands

When investigating an issue, these commands are highly effective:

| Goal | Command |
|------|---------|
| Check all module statuses | `kubectl get pods -n labs64io` |
| View error logs for one or all modules | `just logs [module]` in the workspace |
| View traces, logs and metrics | Grafana at `http://gateway.localhost/grafana`, after `just up-otel` in the helm-charts repository |

If an issue is specific to one module, see the Troubleshooting section on that module's page, for example [AuditFlow](../modules/auditflow/index.md#troubleshooting).
