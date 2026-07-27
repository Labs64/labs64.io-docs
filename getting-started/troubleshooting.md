---
title: Troubleshooting
parent: Getting Started
nav_order: 4
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
3. Check the Cerbos PDP logs (`kubectl logs -l app.kubernetes.io/name=cerbos`) to see why the policy evaluation failed. The system **fails closed**, meaning unmapped routes or missing tokens are explicitly rejected.

## Diagnostic Commands

When investigating an issue, these commands are highly effective:

| Goal | Command |
|------|---------|
| Check all module statuses | `kubectl get pods -n default` |
| View logs for a module | `kubectl logs -l app.kubernetes.io/name=<module-name>` |
| Check Auth Gateway logs | `kubectl logs -l app.kubernetes.io/name=authproxy` |
| View trace outputs | Access Grafana via `http://observability.localhost/grafana` |

If you encounter issues specific to a module, consult the Troubleshooting section on that module's page (e.g., [Payment Gateway Troubleshooting](../modules/payment-gateway/#troubleshooting)).
