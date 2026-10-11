---
title: Auth Gateway
parent: Core Platform
nav_order: 1
---

# Auth Gateway

## Overview
The Auth Gateway (`traefik-authproxy`) provides the authenticated edge for the entire Labs64.IO ecosystem. It enforces authentication via OIDC/JWT and delegates authorization decisions to the Cerbos Policy Decision Point (PDP) before requests reach any module.

## Capabilities

| Capability | Description |
|------------|-------------|
| **Centralized Authentication** | Validates JWTs from identity providers (e.g., Keycloak, Auth0). |
| **Centralized Authorization** | Queries Cerbos for policy-as-code evaluation. |
| **Trusted Header Injection** | Passes validated context (`X-Auth-User`, etc.) to upstream modules. |
| **Fail Closed** | Rejects unmapped or unauthorized routes explicitly. |

## Architecture

Auth Gateway leverages Traefik's `ForwardAuth` middleware.

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant T as Traefik
    participant AG as Auth Gateway
    participant Cerbos as Cerbos PDP
    participant M as Upstream Module

    C->>T: HTTPS Request
    T->>AG: ForwardAuth
    AG->>AG: Validate JWT
    AG->>Cerbos: Check Policy
    Cerbos-->>AG: Allow
    AG-->>T: HTTP 200 + X-Auth-* Headers
    T->>M: Forwarded Request
```

## Quick Start

The Auth Gateway is part of every Kubernetes install; you do not start it separately. The [Quickstart](../../getting-started/quickstart.md) installs it in about five minutes and walks through the three answers it gives.

A request without a token is refused with `401`:
```bash
curl -i -X POST http://localhost:8000/auditflow/api/v1/audit/publish \
  -H 'Content-Type: application/json' -d '{}'
```

A request with a valid token that lacks the required scope is refused with `403`, and one with the right scope is forwarded to the service with a trusted tenant and user context.

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AUTH_JWKS_URL` | The URL to fetch the public keys for JWT validation. | - |
| `AUTH_CERBOS_ADDRESS` | The gRPC address of the Cerbos PDP. | `cerbos:3593` |
| `AUTH_ALLOWED_ISSUERS`| Comma-separated list of valid token issuers. | - |

## REST APIs

The Auth Gateway does not expose business APIs. It exposes a single endpoint used by Traefik:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/verify` | `GET` | The ForwardAuth target for Traefik. |

## Events

The Auth Gateway does not publish domain events to RabbitMQ.

## Examples

### Upstream Trusted Headers

When a request is allowed, the Auth Gateway injects these headers:
- `X-Auth-User: usr_123`
- `X-Auth-Scopes: read:orders write:orders`
- `X-Auth-Tenant: tnt_abc`

## Operations

Auth Gateway is stateless and can be aggressively scaled. It must be deployed alongside a Cerbos PDP sidecar or connected to a highly available Cerbos cluster.

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| Valid tokens rejected (403) | Cerbos policy mismatch | Verify the Cerbos policies mapped to the endpoint. Check Cerbos logs. |
| JWT validation fails | Incorrect JWKS URL | Ensure `AUTH_JWKS_URL` is accessible from the Auth Gateway pod. |
