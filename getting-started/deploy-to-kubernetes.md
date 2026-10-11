---
title: Deploy to Your Kubernetes Cluster
parent: Get Started
nav_order: 3
---

# Deploy to Your Kubernetes Cluster

A team environment uses the same Helm chart as the [Quickstart](./quickstart.md). What changes is who provides three things the Quickstart fakes or bundles: the identity provider, the data stores and the secrets.

This works on any recent Kubernetes cluster: Amazon EKS, Azure AKS, Google GKE, or one you run yourself. The charts contain no cloud-specific code. AWS additionally has a ready-made values profile, described [below](#aws-azure-google-cloud-and-on-premises).

If you have not run the Quickstart yet, do that first on a laptop. It takes five minutes and shows you the moving parts before you make decisions about them.

## What you bring

| You provide | Needed by | Notes |
|---|---|---|
| A Kubernetes cluster where you can create namespaces and custom resource definitions | Everything | Routes use the Kubernetes Gateway API. The gateway is Traefik, which the chart can install for you |
| An OIDC identity provider that supports the client-credentials grant | The gateway | Keycloak, Microsoft Entra ID, Auth0, Okta and similar. The claims that carry scopes and the tenant are configurable |
| PostgreSQL | Payment Gateway, Checkout | One database per service: `payment_gateway`, `checkout` |
| A RabbitMQ broker (AMQP 0-9-1) | AuditFlow | Self-hosted or a managed service |
| A Redis-compatible store (Valkey or Redis) | AuditFlow, Payment Gateway | Used for deduplication and rate limiting, not as a system of record |
| A DNS name and a TLS certificate | The gateway | Routes are served at `gateway.<your-domain>` |
| A place to keep secrets | Everything | Plain Kubernetes Secrets work. Every module chart can read its secrets through External Secrets Operator instead |

You do not have to bring all of it on day one. The chart can run PostgreSQL, RabbitMQ and Valkey inside the cluster, with persistent volumes, until you move them to managed services.

## 1. Add the chart repository

```bash
helm repo add labs64io https://labs64.github.io/labs64.io-helm-charts
helm repo update
helm search repo labs64io
```

`labs64io/labs64io-ecosystem` is the umbrella chart that installs the platform. Each module is also published as a chart of its own.

## 2. Check your infrastructure before you install

The `preflight` chart runs one short job that tries each dependency from inside your cluster: a TCP connection to the broker, a PostgreSQL login, a Redis `PING`, an OIDC token request. It tells you about a closed firewall port or a wrong password before a service fails to start because of it.

Describe your endpoints in `my-endpoints.yaml`, enabling only the checks you need:

```yaml
checks:
  postgresql:
    enabled: true
    host: postgres.internal.example.com
    database: postgres
    existingSecret: preflight-postgres   # keys: username, password
  rabbitmq:
    enabled: true
    host: rabbitmq.internal.example.com
  redis:
    enabled: true
    host: redis.internal.example.com
    existingSecret: preflight-redis      # key: password
  oidc:
    enabled: true
    discoveryUrl: https://idp.example.com/realms/acme/.well-known/openid-configuration
    existingSecret: preflight-oidc       # keys: client-id, client-secret
```

```bash
helm install preflight labs64io/preflight -n labs64io --create-namespace -f my-endpoints.yaml
kubectl wait --for=condition=complete job/preflight -n labs64io --timeout=120s \
  || kubectl logs job/preflight -n labs64io --all-containers
helm uninstall preflight -n labs64io
```

The job completes only if every enabled check passes.

## 3. Install

Pick the route that fits how your team works.

### Route A: the installer, with your identity provider

The fastest way to a first shared environment. The installer asks for your OIDC discovery URL and which modules you want, runs the data stores inside the cluster with generated passwords, and leaves the demo identity provider out.

```bash
curl -fsSL https://raw.githubusercontent.com/Labs64/labs64.io-helm-charts/master/install.sh -o install.sh
bash install.sh        # choose "Install or update", then "BYO"
```

Or without questions, taking the default module selection:

```bash
LABS64_PROFILE=byo \
LABS64_OIDC_DISCOVERY_URL=https://idp.example.com/realms/acme/.well-known/openid-configuration \
bash install.sh
```

The installer writes the Helm values it used to `./labs64.io-install/values-overrides.yaml`. That file is a good starting point for Route B when you outgrow the installer. The [Quickstart](./quickstart.md#manage-the-install) lists the commands for checking, stopping and removing the install.

### Route B: Helm, with your own values file

Use this when values live in version control and a pipeline or a GitOps tool applies them. This example points the platform at your own data stores and identity provider. Save it as `my-values.yaml`:

```yaml
global:
  domain: example.com              # routes are served at gateway.example.com
  postgresql:
    host: postgres.internal.example.com
  rabbitmq:
    host: rabbitmq.internal.example.com
  redis:
    host: redis.internal.example.com

# Your infrastructure replaces the bundled data stores.
postgresql:
  enabled: false
rabbitmq:
  enabled: false
redis:
  enabled: false

api-gateway:
  oidc:
    discoveryUrl: https://idp.example.com/realms/acme/.well-known/openid-configuration

auditflow:
  gateway:
    enabled: true
  env:
    - name: LABS64_AUTH_AUTHZ_PDPADDRESS
      value: "labs64io-authz-pdp:3593"
payment-gateway:
  gateway:
    enabled: true
  env:
    - name: LABS64_AUTH_AUTHZ_PDPADDRESS
      value: "labs64io-authz-pdp:3593"

# Installs Traefik and the shared Gateway. Leave this off if you already run a
# Gateway named labs64io-gateway in the tools namespace.
traefik:
  enabled: true
```

Keep the passwords out of that file. Put them in a second one that never reaches version control, or let External Secrets Operator supply them:

```yaml
# my-secrets.yaml
secrets:
  postgresqlPassword: "..."
  rabbitmqPassword: "..."
  redisPassword: "..."
```

Then install the Gateway API resource definitions, following the [upstream guide](https://gateway-api.sigs.k8s.io/guides/#installing-gateway-api), and the chart:

```bash
kubectl create namespace tools     # holds the shared Gateway object
helm upgrade --install labs64io labs64io/labs64io-ecosystem \
  --namespace labs64io --create-namespace \
  --version <chart-version> \
  -f my-values.yaml -f my-secrets.yaml
helm test labs64io -n labs64io
```

Three details in the example are worth knowing:

- **The release name is `labs64io`.** The address `labs64io-authz-pdp:3593` follows from it. Without that setting, services look for a policy engine next to themselves, find none, and deny every request.
- **The chart refuses to install with its shipped default passwords.** That check is deliberate; it is only relaxed in demo mode.
- **Pin `--version`.** The umbrella chart version is the release number of the whole platform, so pinning it makes an environment reproducible.

`helm show values labs64io/labs64io-ecosystem` prints every setting. To read the example profiles that ship inside the chart:

```bash
helm pull labs64io/labs64io-ecosystem --untar
ls labs64io-ecosystem/values*.yaml    # values.yaml, values.demo.yaml, values.aws.yaml
```

### Route C: one module at a time

Every module chart installs on its own, so you can adopt a single capability and add the rest later:

```bash
helm upgrade --install auditflow labs64io/auditflow -n labs64io -f auditflow-values.yaml
```

Module charts bundle no data stores; you point each at yours. The [Helm charts repository](https://github.com/Labs64/labs64.io-helm-charts#building-box-cherry-pick-your-modules) lists what each module needs, the routes it exposes, and a commented production example per module under `overrides/<module>/values.prod-example.yaml`.

## AWS, Azure, Google Cloud and on-premises

The platform needs capabilities, not specific products. This is how they usually map:

| Capability | AWS | Azure | Google Cloud | Self-managed |
|---|---|---|---|---|
| Kubernetes | EKS | AKS | GKE | Any conformant cluster |
| PostgreSQL | RDS for PostgreSQL | Azure Database for PostgreSQL | Cloud SQL for PostgreSQL | Bundled, or your own |
| Redis-compatible store | ElastiCache (Valkey) | Azure Cache for Redis | Memorystore | Bundled, or your own |
| RabbitMQ | Amazon MQ for RabbitMQ | Bundled, or a hosted RabbitMQ | Bundled, or a hosted RabbitMQ | Bundled, or your own |
| Secrets | Secrets Manager | Key Vault | Secret Manager | Kubernetes Secrets, Vault |
| Identity | Any OIDC provider | Entra ID, or any OIDC provider | Any OIDC provider | Keycloak, or any OIDC provider |

**On AWS**, the umbrella chart ships a reference profile, `values.aws.yaml`, for EKS with managed data stores and secrets read from AWS Secrets Manager through External Secrets Operator. You provision the infrastructure with the tool you prefer and pass its coordinates in a second values file; the header of `values.aws.yaml` lists exactly which ones. On this profile the gateway is installed first, as a release of its own:

```bash
helm upgrade --install labs64io labs64io/labs64io-ecosystem -n labs64io \
  -f labs64io-ecosystem/values.aws.yaml -f my-environment.yaml
```

**On Azure and Google Cloud**, use Route A or Route B. To read secrets from Key Vault or Secret Manager, install External Secrets Operator, create a `ClusterSecretStore` for your provider, and set `externalSecrets.enabled: true` on each module.

**On any cloud**, two things catch people out:

- The bundled data stores need a default StorageClass. Some managed clusters, newer EKS clusters among them, come without one marked as default; check with `kubectl get storageclass`. The installer warns you when it is missing. Without one, the database pods stay `Pending`.
- A load balancer created for the gateway is usually public. Decide whether it should be before you install, and never expose an install that runs the demo identity provider.

## Before you go live

Treat these as deployment responsibilities. The software does not do them for you.

| Area | What to confirm |
|---|---|
| Identity | A real OIDC provider is configured, and the demo identity provider is not installed. It issues a valid token to anyone |
| TLS | The gateway is reached over HTTPS only, with TLS terminated at your load balancer or at Traefik |
| Secrets | No password sits in a values file under version control, and every generated or default password has been replaced |
| Data | PostgreSQL has backups and you have restored one. The broker's storage is persistent |
| Network | Network policies are enabled (`networkPolicy.enabled`) and only the gateway is reachable from outside |
| Payments | Provider webhooks are verified before your systems act on them |
| Observability | Metrics, logs and traces reach a backend someone watches (`observability.enabled`), and alerts have an owner |
| Versions | The chart version is pinned per environment and upgrades are rehearsed in a non-production environment first |

Continue with [Security & Compliance](../operate-manage/security-compliance.md), [Monitoring & Observability](../operate-manage/monitoring-observability.md) and [Kubernetes & Helm Setup](../operate-manage/kubernetes-helm-setup.md).
