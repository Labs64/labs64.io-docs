---
title: Traefik Gateway Routing
parent: Operate & Manage
nav_order: 3
---

# Traefik Gateway Routing

Traefik is the public routing layer. It sends an incoming request through the Auth Gateway's ForwardAuth check before forwarding traffic to an upstream service.

```mermaid
sequenceDiagram
  participant C as Client
  participant T as Traefik
  participant A as Auth Gateway
  participant P as Cerbos PDP
  participant S as Service
  C->>T: HTTPS request
  T->>A: ForwardAuth check
  A->>P: Evaluate policy
  P-->>A: Allow or deny
  alt allowed
    A-->>T: Trusted identity headers
    T->>S: Forward request
    S-->>C: Response
  else denied
    A-->>T: 403 response
    T-->>C: 403 response
  end
```

## Route checklist

| Control | What to verify |
|---|---|
| TLS | Certificates, hostnames, redirects, and renewal process |
| Authentication | Every protected route uses the intended ForwardAuth middleware |
| Authorization | Route and method policies are mapped and tested with allow/deny cases |
| Headers | Only the gateway may inject trusted `X-Auth-*` context headers |
| Webhooks | External callback routes have their own authenticity verification and narrow exposure |
| Rate protection | Public routes have an appropriate rate and abuse-control policy |

Never expose a service's private port simply to bypass a routing problem. Fix the route and its policy instead.
