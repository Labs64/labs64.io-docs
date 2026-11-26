---
title: Helm Charts Development
parent: Community & Contributing
nav_order: 5
---

# Local Development Setup

Step-by-step guide to spin up the full Labs64.IO stack on a local Kubernetes cluster, deploy all modules, and run regression tests.

> **Which guide do you need?**
> - This guide explains what that deployment consists of, and how to drive each step by hand when you work on the charts themselves.

## Architecture Overview

The diagram below outlines the local Kubernetes (`k3d`) setup for the Labs64.IO microservices ecosystem. It covers the configuration artifacts, third-party (3PP) infrastructure dependencies, and the proprietary Labs64 modules.

```mermaid
graph TB
    %% Definitions
    classDef config fill:#f9f2f4,stroke:#d3b8c6,stroke-width:2px,color:#333;
    classDef tools fill:#e6f3ff,stroke:#a6c8ff,stroke-width:2px,color:#333;
    classDef labs64 fill:#e6ffe6,stroke:#a6ffa6,stroke-width:2px,color:#333;
    classDef obs fill:#fff3e6,stroke:#ffd8a6,stroke-width:2px,color:#333;
    classDef host fill:#f0f0f0,stroke:#cccccc,stroke-width:2px,stroke-dasharray: 5, 5,color:#333;

    %% Host Environment
    subgraph Host["Local Host Machine"]
        registry["Docker Registry<br/>(localhost:5005)"]:::tools
        just["Just<br/>(Task Runner)"]:::tools
        
        subgraph Config["Configuration Artifacts"]
            dev_docs["DEVELOPERS.md<br/>(Setup Guide)"]:::config
            k3d_yaml["k3d/labs64io.yaml<br/>(Cluster Config)"]:::config
            helm_charts["labs64.io-helm-charts/*<br/>(Chart.yaml, values.yaml)"]:::config
        end
    end

    %% Kubernetes Cluster
    subgraph k3d_cluster["k3d Local Cluster (labs64io)"]
        
        %% Tools Namespace
        subgraph ns_tools["Namespace: tools (3rd Party Infrastructure)"]
            traefik["Traefik v3<br/>(Ingress Controller)"]:::tools
            rabbitmq["RabbitMQ<br/>(Message Broker)"]:::tools
            postgres["PostgreSQL<br/>(Database)"]:::tools
            redis["Redis<br/>(Cache)"]:::tools
            mock_oidc["Mock OIDC Provider<br/>(DEV only)"]:::tools
            eso["External Secrets Operator<br/>(local ClusterSecretStore, no ExternalSecrets by default)"]:::tools
            
            subgraph Observability["Observability Stack (optional)"]
                otel["OpenTelemetry<br/>Collector"]:::obs
                tempo["Tempo<br/>(Traces)"]:::obs
                vlogs["Loki<br/>(Logs)"]:::obs
                prom["Prometheus<br/>(Metrics)"]:::obs
                grafana["Grafana<br/>(Dashboards)"]:::obs
            end
        end

        %% Labs64io Namespace
        subgraph ns_labs64io["Namespace: labs64io (Labs64 Modules)"]
            
            subgraph Gateway["Gateway & Auth"]
                api_docs["api-docs<br/>(Swagger UI)"]:::labs64
                authgateway["authgateway<br/>(Auth Gateway + Middlewares)"]:::labs64
                authz_pdp["authz-pdp<br/>(Cerbos PDP)"]:::labs64
            end
            
            subgraph AuditFlow["AuditFlow"]
                audit_be["auditflow-be"]:::labs64
                audit_transformer["auditflow-transformer"]:::labs64
                audit_sink["auditflow-sink"]:::labs64
            end
            
            subgraph Checkout["Checkout"]
                checkout_fe["checkout ui.enabled<br/>(Vue)"]:::labs64
                checkout_be["checkout-be<br/>(Java)"]:::labs64
            end
            
            subgraph PaymentGateway["Payment Gateway"]
                pg_be["payment-gateway-be<br/>(Java)"]:::labs64
            end
            
            subgraph CustomerPortal["Customer Portal"]
                cp_fe["customer-portal ui.enabled<br/>(Vue)"]:::labs64
            end
        end
    end

    %% Build & Config Flow
    just -->|Reads| dev_docs
    just -->|Applies| k3d_yaml
    just -->|Runs `helm upgrade`| helm_charts
    k3d_yaml -->|Bootstraps| k3d_cluster
    
    helm_charts -->|Deploys Resources to| ns_tools
    helm_charts -->|Deploys Resources to| ns_labs64io
    registry -->|Pulls Images| ns_labs64io

    %% User Ingress Flow
    User((Developer)) -->|HTTP 80/443| traefik
    traefik -.->|"ForwardAuth call (authgateway auth middleware)"| authgateway
    authgateway -->|Validates JWT against| mock_oidc
    authgateway -->|"Authorization decision (HTTP :3592)"| authz_pdp
    traefik -->|"Routes via Gateway API HTTPRoute (native filters + authgateway middlewares via ExtensionRef)"| api_docs
    traefik --> audit_be
    traefik --> checkout_be
    traefik --> pg_be
    traefik --> checkout_fe
    traefik --> cp_fe
    
    %% Internal Dependencies
    checkout_be -->|Persists Data| postgres
    
    pg_be -->|Persists Data| postgres
    pg_be -->|Idempotency| redis
    pg_be -->|"Audit events (HTTP)"| audit_be
    
    audit_be -->|Publishes Audits| rabbitmq
    rabbitmq -->|Consumes| audit_be
    audit_be -->|"Transform (HTTP, per pipeline)"| audit_transformer
    audit_be -->|"Sink (HTTP, per pipeline)"| audit_sink
    audit_be -->|Idempotency| redis
    
    %% Telemetry
    ns_labs64io -.->|OTLP Logs/Traces| otel
    otel -.-> tempo
    otel -.-> vlogs
    prom -.->|Scrapes| ns_labs64io
```

> **Observability model:** instrumentation is infrastructure-owned and injected at runtime — the
> same images run with it on or off, toggled by `observability.enabled`. See
> [OBSERVABILITY.md](./observability.md) for the full concept, signal flow, and env-variable contract.

### Key Configuration Artifacts

- **`k3d/labs64io.yaml`**: The cluster definition file. Bootstraps the lightweight Kubernetes cluster and local Docker registry mappings.
- **`labs64.io-helm-charts/`**: Contains the Kubernetes definitions for all services:
  - `Chart.yaml`: Helm chart metadata and dependency definitions.
  - `values.yaml` / `values.schema.json`: Configuration overrides and input validation schemas for local and deployed environments.

### Namespaces & Infrastructure

1. **`tools` Namespace**: Holds all external dependencies (3PP tools). Relies on third-party Helm repositories like Bitnami (Postgres, Valkey) and Traefik; RabbitMQ runs from the local chart in `overrides/rabbitmq/chart` (official image).
2. **`labs64io` Namespace**: Where all proprietary Labs64 domains execute. All services route internal traffic through the common gateways.

Both namespaces carry Pod Security Admission labels, set by `just install-tools` / `just install-apps`: `labs64io` enforces `restricted` (charts, helm tests, migration Jobs and test fixtures all comply), `tools` enforces `baseline` and warns/audits on `restricted`. Shared data stores accept connections from the `labs64io` namespace only (RabbitMQ: from AuditFlow only), and each module's own NetworkPolicy names its in-namespace callers (`networkPolicy.ingressFrom`). The Swagger UI lists an API only while its module is installed (`apiDefinitions`, driven by the same state values as the optional checkout/reporting releases).

Reference versions: the shared local toolset (`just install-tools`) runs exactly the chart
versions pinned in `helmfile.yaml.gotmpl` — the single place they are written; print one with
`just show-chart-version postgresql` (or `redis`, `traefik`, …). RabbitMQ is the official image via
`overrides/rabbitmq/chart`. For local development, images must be built and pushed to the local
registry (`localhost:5005`) — see [Building module images](#building-module-images).

### Request Flow

Traefik receives external requests mapping on ports 80/443 and routes them via Kubernetes Gateway API `HTTPRoute`s (module-owned, attached to the platform `Gateway` `labs64io-gateway` in `tools`). Each protected route strips inbound `X-Auth-*` headers first (native `RequestHeaderModifier`), then calls the `authgateway` ForwardAuth middleware via an `ExtensionRef` filter. The Auth Gateway validates the `Authorization: Bearer` against the `Mock OIDC Provider` (generating fake JWT tokens for local environments). Validated requests pass through the remaining `authgateway` middlewares (rate-limit, compress) before hitting the downstream microservices.

## Building module images

All Labs64.IO modules must be built as Docker images and pushed to the local registry (`localhost:5005`) before deploying to the k3d cluster. The Helm charts reference `localhost:5005/<module>:latest` for local development.

### Build all images

Before building images, you must ensure the local Docker registry (`localhost:5005`) is running. It is created automatically when you create the k3d cluster.

```bash
# 1. Create the cluster (and registry)
k3d cluster create --config k3d/labs64io.yaml

# 2. Build and push all images
# From the sibling labs64.io-workspace repository — this recipe lives in its justfile,
# not this repo's, and builds every sibling module repo via scripts/build-images.sh
# in a containerized builder.
(cd ../labs64.io-workspace && just build)
```

### Build individually

```bash
# Java backends (require Maven build first)
cd ../labs64.io-auditflow && mvn -B clean package -DskipTests --file auditflow-be/pom.xml
docker build -t localhost:5005/auditflow:latest -f auditflow-be/Dockerfile auditflow-be/
docker build -t localhost:5005/auditflow-transformer:latest -f auditflow-transformer/Dockerfile auditflow-transformer/
docker build -t localhost:5005/auditflow-sink:latest -f auditflow-sink/Dockerfile auditflow-sink/
docker push localhost:5005/auditflow:latest
docker push localhost:5005/auditflow-transformer:latest
docker push localhost:5005/auditflow-sink:latest

cd ../labs64.io-checkout && mvn -B clean package -DskipTests --file checkout-be/pom.xml
docker build -t localhost:5005/checkout:latest -f checkout-be/Dockerfile checkout-be/
docker build -t localhost:5005/checkout-ui:latest -f checkout-fe/Dockerfile checkout-fe/
docker push localhost:5005/checkout:latest
docker push localhost:5005/checkout-ui:latest

cd ../labs64.io-payment-gateway && mvn -B clean package -DskipTests --file payment-gateway-be/pom.xml
docker build -t localhost:5005/payment-gateway:latest -f payment-gateway-be/Dockerfile payment-gateway-be/
docker push localhost:5005/payment-gateway:latest

# Python services
cd ../labs64.io-authgateway
docker build -t localhost:5005/authgateway-traefik:latest -f traefik/Dockerfile traefik/
docker push localhost:5005/authgateway-traefik:latest

# Vue frontends
cd ../labs64.io-customer-portal
docker build -t localhost:5005/customer-portal-ui:latest -f customer-portal-fe/Dockerfile customer-portal-fe/
docker push localhost:5005/customer-portal-ui:latest
```

### Verify images in registry

```bash
curl -s http://localhost:5005/v2/_catalog
# Should list: auditflow, auditflow-transformer, auditflow-sink, checkout, checkout-ui, payment-gateway, reporting, authgateway-traefik, customer-portal-ui
```

## Quick start

**From this repository alone**, `just up` creates the cluster and deploys the same charts, but it does not build images. They have to be in the local registry first, so the sequence is:

```bash
just start-cluster          # k3d cluster + registry on localhost:5005 (and the kubeconfig fix inside a dev container)
(cd ../labs64.io-workspace && just build)   # workspace recipe — see "Building module images" above
just up
```

## Step-by-step setup

If you prefer to understand each step, or need to customize the setup:

### 1. Create the k3d cluster

```bash
# Create cluster with local registry (localhost:5005) and port mappings (80, 443)
k3d cluster create --config k3d/labs64io.yaml
```

This creates:
- A single-node k3s cluster named `labs64io`
- A local Docker registry on `localhost:5005`
- Port mappings: `80:80` and `443:443` on the loadbalancer
- k3s's built-in Traefik is disabled (we install our own)

Verify:
```bash
kubectl get nodes
# NAME                        STATUS   ROLES                  AGE   VERSION
# k3d-labs64io-server-0       Ready    control-plane,master   30s   v1.36.x+k3s1
```

### 2. Add Helm repositories

```bash
just update-repos   # adds + refreshes exactly the repositories helmfile.yaml.gotmpl declares
```

This adds repositories for: traefik, bitnami (PostgreSQL, Valkey), open-telemetry, grafana, prometheus-community, metrics-server.

### 3-5. Install core tools and the selected identity provider

All infra tools are declared as [Helmfile](https://helmfile.io/) releases (`helmfile.yaml.gotmpl`,
`layer: infra`) and installed together:

```bash
just install-tools
```

This installs the Gateway API + Traefik CRDs (`just install-crds`, run first since Helmfile
has no per-release CRD-skip equivalent), then via Helmfile: Traefik v3, [External Secrets
Operator](https://external-secrets.io/) (ESO), RabbitMQ, PostgreSQL, Redis, and the identity
provider selected by `identityProvider` in `overrides/helmfile/values.local.yaml` — `mock`
(default), `keycloak` or `external`. That one value selects the provider release **and**
authgateway's OIDC settings + NetworkPolicy egress (`overrides/authgateway/oidc-<provider>.local.yaml`);
apply a switch with `just install-tools && just install-app authgateway`. Keycloak comes from the
pinned upstream `codecentric/keycloakx` chart (official Keycloak image), configured in
`overrides/keycloak/`: `values.yaml` (shared with AWS), `values.local.yaml`, the realm contract
`realm.base.json` (shared with AWS) and the test clients `realm.test-fixtures.json` (local, and AWS
development environments only — enabled there by the operator, never in production).
`just generate-jwt <persona>` mints a token from whichever provider is selected. `just install-tools` also applies the Traefik dashboard HTTPRoute and the local
`ClusterSecretStore` (`overrides/eso/cluster-secret-store.yaml`) used by charts with
`externalSecrets.enabled` (see [Unified secret management](#unified-secret-management) below).

To (re)install a single tool, name its Helmfile release: `just install-tool rabbitmq`,
`just install-tool postgresql`, `just install-tool redis`, … (`helmfile -e local list` shows
them all). Five need more than their release, and `install-tool` does that too: `traefik`
(its CRDs first), `opentelemetry` (validates the collector config first), `grafana` (route +
dashboards), `mock-oidc` / `keycloak` (only the provider selected in the identity overrides). Chart
versions are never passed on the command line — they come from `helmfile.yaml.gotmpl`
(`just show-chart-version <release>` prints one). Or target a Helmfile release/layer directly:
```bash
helmfile -e local -l name=rabbitmq apply
helmfile -e local -l layer=identity apply
```

Wait for all pods:
```bash
kubectl get pods -n tools
```

### 6. Build and Install Labs64.IO modules

**Build images (Required if not available in localhost:5005):**
```bash
(cd ../labs64.io-workspace && just build)   # workspace recipe — see "Building module images" above
```

### Unified secret management

Every chart with a `secret.yaml` supports two mutually-exclusive modes, toggled by
`externalSecrets.enabled`:

- **`false` (default, Local Development / BYO Infra):** a plain `Secret` rendered from `.Values.secrets.data` only
  — infrastructure is decoupled from every application chart, so there is no bundled-dep
  credential fallback; broker/database credentials must always be supplied explicitly.
  Populated locally via `values.secrets.local.yaml`
  (below) — never committed.
- **`true` (opt-in locally, intended default for AWS Staging / Prod Environment):** an `ExternalSecret`
  (`chart-libs.externalsecret`) that ESO resolves against a `ClusterSecretStore` — the
  same object shape in every environment, only the backing store differs. Locally that
  store is the `kubernetes`-provider `local-kubernetes-store` (installed by
  `just install-tools`), which replicates a same-named Secret out of the `tools`
  namespace; an AWS environment points `externalSecrets.storeName` at a
  ClusterSecretStore backed by AWS Secrets Manager. See `overrides/<app>/values.prod-example.yaml`
  for a documented example per app.

**Local secrets (default mode):** before installing the modules, make sure you have the
required secrets configured. Auto-generate the default local secrets from their `.example`
templates by running:
```bash
just generate-secrets
```
This is done automatically when you run `just up`. These files are ignored by git but injected during the local helm upgrade (and, since Helmfile adoption, by the matching `helmfile.yaml.gotmpl` release's conditional `values.secrets.local.yaml` entry).

**Install all at once:**
```bash
# This will start everything locally
just up
```

**Or one at a time:**
```bash
just install-app authz-pdp           # Cerbos PDP (required first)
just install-app authgateway         # Auth Gateway + shared Traefik middlewares
just install-app api-docs            # Swagger UI
just install-app auditflow           # audit logging
just install-app checkout            # checkout backend + UI (ui.enabled)
just install-app payment-gateway     # payment gateway
just install-app reporting           # reporting (not in the default set; needs a ClickHouse)
just install-app customer-portal      # customer portal UI (no backend yet)
```

Verify all pods:
```bash
kubectl get pods -n labs64io
```

### 7. Verify the deployment

**Check Swagger UI:**
```
http://gateway.localhost/swagger-ui/
```

You should see API docs for: AuditFlow, Checkout, Payment Gateway, Customer Portal.

**Check Traefik dashboard:**
```
http://dashboard.localhost/dashboard/
```

## Generating JWT tokens for testing

All API calls to protected endpoints require a Bearer token. Use the mock OIDC provider:

```bash
# Generate a token with admin scope
just generate-jwt admin

# Generate a token with specific scope
just generate-jwt ecommerce
```

Use the returned `access_token` in API calls:
```bash
TOKEN=$(just generate-jwt admin | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -H "Authorization: Bearer $TOKEN" \
  http://gateway.localhost/auditflow/api/v1/audit/publish \
  -H "Content-Type: application/json" \
  -d '{"eventType": "test.event", "sourceSystem": "test"}'
```

## Regression tests

### End-to-end auth smoke test

Authentication through the full Traefik → Auth Gateway → upstream path is covered by the
Robot Framework suite in `labs64.io-tests` (`tests/auditflow/authz.robot`):

```bash
cd ../labs64.io-tests
robot --include auditflow tests/auditflow/authz.robot
```

This asserts the full scope matrix (no token, malformed token, wrong scope, no scope, correct
scope, multiple scopes) against the live gateway edge, and — when the active kubectl context is
the local k3d dev cluster — additionally corroborates each decision against the Auth Gateway's
authz decision log and AuditFlow's delivery log (`local-k8s-only` tagged cases; see
`labs64.io-tests/AGENTS.md` "Local-only pod-log corroboration").

### API smoke tests

**AuditFlow — publish an audit event:**
```bash
TOKEN=$(just generate-jwt admin | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -s -X POST http://gateway.localhost/auditflow/api/v1/audit/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "X-Correlation-ID: test-$(date +%s)" \
  -d '{
    "sourceSystem": "regression-test",
    "eventType": "test.user.created",
    "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "data": {"userId": "test-123", "action": "create"}
  }' | python3 -m json.tool
```

**Checkout — list customers (expects empty list or existing data):**
```bash
TOKEN=$(just generate-jwt ecommerce | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -s http://gateway.localhost/checkout/api/v1/customers \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

**Payment Gateway — list payment providers:**
```bash
TOKEN=$(just generate-jwt ecommerce | python3 -c 'import sys,json; print(json.load(sys.stdin)["access_token"])')

curl -s http://gateway.localhost/payment-gateway/api/v1/payment-providers \
  -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
```

### Check observability (if installed with `just up-otel`)

```bash
# Grafana
kubectl port-forward -n monitoring svc/grafana 3000:80
# Open http://localhost:3000 (admin/admin — get password from secret)

# Prometheus
kubectl port-forward -n monitoring svc/prometheus-kube-prometheus-prometheus 9090:9090
# Open http://localhost:9090

# Check logs in Loki (via Grafana → Explore → Loki)
```

## Common operations

### Reinstall a single module

```bash
just install-app checkout     # applies that module's helmfile release (all value layers)
```

### Uninstall everything

```bash
just uninstall-apps
just uninstall-monitoring
just uninstall-tools          # every core tool + whichever identity provider is installed
just uninstall-tool redis     # …or a single tool, by helmfile release name
just down             # delete the k3d cluster
```

## Local development with hot reload

For active development with file watching, build and run services directly instead of via Helm:

### Backend (Java services)

```bash
# Checkout backend
cd ../labs64.io-checkout/checkout-be
just dev-up       # build JAR + docker compose up (PostgreSQL + Cerbos)
just dev-watch    # auto-restart on code changes
just dev-down     # stop

# Payment Gateway backend
cd ../labs64.io-payment-gateway/payment-gateway-be
just dev-up       # build JAR + start infrastructure and debug application
just dev-watch    # auto-restart on JAR changes
just dev-down     # stop
```

### Frontend (Vue apps)

```bash
# Checkout frontend
cd ../labs64.io-checkout/checkout-fe
npm install
npm run dev       # Vite dev server on :5173

# Customer Portal frontend
cd ../labs64.io-customer-portal/customer-portal-fe
npm install
npm run dev       # Vite dev server on :5173
```

## Troubleshooting

### Pods stuck in CrashLoopBackOff

```bash
kubectl describe pod <pod-name> -n labs64io
kubectl logs <pod-name> -n labs64io --previous
```

Common causes:
- Missing secrets (check `kubectl get secrets -n labs64io`)
- Database not ready (check `kubectl get pods -n tools -l app.kubernetes.io/name=postgresql`)
- RabbitMQ not ready (check `kubectl get pods -n tools -l app.kubernetes.io/name=rabbitmq`)

### 404 from gateway.localhost

- Check Traefik is running: `kubectl get pods -n tools -l app.kubernetes.io/name=traefik`
- Check HTTPRoutes are accepted: `kubectl get httproute -n labs64io` (details: `kubectl describe httproute <name> -n labs64io`)
- Check the platform Gateway is programmed: `kubectl get gateway -n tools labs64io-gateway`
- Check the Auth Gateway is running: `kubectl get pods -n labs64io -l app.kubernetes.io/name=authgateway`

### 401/403 on API calls

- Verify token: `just generate-jwt admin`
- Check the central PDP: `kubectl get deploy,svc -n labs64io -l app.kubernetes.io/name=authz-pdp` and `kubectl exec -n labs64io deploy/labs64io-authz-pdp -- /cerbos healthcheck --kind=grpc` (— the Auth Gateway loads a generated routes manifest and asks Cerbos; there is no `/.well-known/auth-policy` discovery anymore) plus `kubectl exec -n labs64io deploy/authgateway -- wget -qO- http://localhost:8081/health/ready`
- Check static UI policies: `kubectl get configmap -n labs64io -l app.kubernetes.io/name=authgateway -o yaml` (renders `static_policies.yaml` from `staticPolicies`)
- Check the Auth Gateway logs: `kubectl logs -n labs64io -l app.kubernetes.io/name=authgateway`

### RabbitMQ connection refused

- Check RabbitMQ is running: `kubectl get pods -n tools -l app=rabbitmq`
- Verify credentials match chart defaults (username: `labs64`, password: `labs64pw`)
- Check service secrets: `kubectl get secret -n labs64io`

### Port 80/443 already in use

Stop other web servers (Apache, nginx, etc.) or change the port mapping in `k3d/labs64io.yaml`.
