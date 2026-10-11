---
title: Troubleshooting Your First Run
parent: Get Started
nav_order: 6
---

# Troubleshooting Your First Run

The problems people hit on day one, grouped by the path you took. Each entry starts from what you see on screen.

For problems in a running environment, use [Operate & Manage: Troubleshooting](../operate-manage/troubleshooting.md).

## Quickstart and the installer

### `helm 4.0+ is required`

The installer needs Helm 4. Check with `helm version --short` and upgrade from [helm.sh](https://helm.sh/docs/intro/install/).

### `Cannot reach a Kubernetes cluster`

`kubectl` is not pointed at a running cluster. Check which one it uses and whether it is up:

```bash
kubectl config current-context
kubectl get nodes
k3d cluster list                      # for a k3d cluster
k3d cluster start labs64io-demo       # if it is listed but stopped
```

### `No terminal available for prompts`

The script was piped into a shell somewhere without a terminal, such as a CI job. Download it and name the profile so it has nothing to ask:

```bash
curl -fsSL https://raw.githubusercontent.com/Labs64/labs64.io-helm-charts/master/install.sh -o install.sh
LABS64_PROFILE=quickstart bash install.sh
```

### The install hangs and pods stay `Pending`

```bash
kubectl -n labs64io get pods
kubectl -n labs64io describe pod <pending-pod> | tail -20
```

Two causes cover nearly every case:

- **No default StorageClass.** The installer prints a warning about it at the start. The bundled PostgreSQL, RabbitMQ and Valkey wait for a volume that never comes. Check with `kubectl get storageclass` and mark one as default.
- **Not enough memory or CPU.** The events at the end of `describe` say `Insufficient memory` or `Insufficient cpu`. Give Docker at least 4 GB, or add a node.

### Pods show `ImagePullBackOff`

The cluster could not download an image. The installer lists the affected images when this happens. Check that the cluster nodes can reach Docker Hub and `ghcr.io`, then run `bash install.sh install` again; a second run continues where the first stopped.

### `FAIL  Gateway not reachable at http://…`

The install itself succeeded, but the installer could not reach the gateway from your machine at the address it worked out. Tell it the address:

```bash
LABS64_GATEWAY_URL=http://localhost:8000 bash install.sh smoke
```

Use the host port you published when you created the cluster (`8000` in the Quickstart's `k3d` command). On a cluster without a load balancer, start the `kubectl port-forward` command the installer printed in a second terminal first.

### `401 Invalid token: Invalid issuer`

You have a token, but it was issued under a different name than the gateway expects. The demo identity provider names itself after the host it is called on. Request the token with the `Host` header shown in the [Quickstart](./quickstart.md#3-send-your-first-request):

```bash
-H 'Host: mock-oidc.labs64io.svc.cluster.local:8080'
```

If you installed into a namespace other than `labs64io`, replace `labs64io` in that header with your namespace.

### `403 Access denied by policy`

Authentication worked; authorization said no. The token does not carry a scope the route requires. With the demo identity provider, request the token with `scope=admin`, or see the [persona table](./quickstart.md#4-look-around) for what each persona may do.

### The address answers, but with `404 page not found`

The gateway is up and no route matches the path. Check the spelling: API routes carry the module name and a version, as in `/auditflow/api/v1/audit/publish`. List the routes with `kubectl -n labs64io get httproute`.

### Starting over

`bash install.sh uninstall` removes what the installer created and asks before it deletes data. For a local cluster, deleting it is quicker: `k3d cluster delete labs64io-demo`.

## One module on Docker Compose

### `just up` stops with a Maven or compiler error

AuditFlow's `just up` builds the backend on your machine and enforces JDK 25 and Maven 3.6.3 or newer. Check both:

```bash
java -version
mvn -version
```

### A container fails to start because a port is taken

The stack uses ports 8080, 8081, 8082, 8123 and 15673, plus 3000, 3100, 3200 and 9090 with `just up obs`. Find what holds a port and stop it:

```bash
lsof -i :8080
```

### The publish call returns `403 TENANT_NOT_PROVISIONED`

The `tenantId` in your request has no configuration. Use `demo`, or add a file for your tenant under `tenants/`. Every event is routed only through the pipelines of the tenant that owns it.

### The call succeeds but nothing appears in the sink log

Check that a pipeline of that tenant matches the event. `just log backend` shows how each event was routed, and `just status` shows whether every container is healthy.

## The full ecosystem from source

### `just doctor` reports something missing

Install what it lists as missing, or open the workspace in the dev container, which has everything. Tools reported as optional do not block `just up`.

### `just up` cannot create the cluster

Ports 80, 443 and 5005 must be free; a local web server is the usual culprit. If a previous attempt left a half-created cluster behind:

```bash
k3d cluster delete labs64io
just up
```

### `gateway.localhost` does not resolve

Most systems resolve every `*.localhost` name to your own machine. If yours does not, add the names to `/etc/hosts`:

```text
127.0.0.1 gateway.localhost mock-oidc.localhost dashboard.localhost
```

### `gateway.localhost` answers with 404

```bash
kubectl get pods -n tools -l app.kubernetes.io/name=traefik    # is the gateway running?
kubectl get gateway -n tools labs64io-gateway                  # is it programmed?
kubectl get httproute -n labs64io                              # are the module routes there?
```

A missing route usually means that module is not installed. From `labs64.io-helm-charts`, run `just install-app <module>`.

### API calls return 401 or 403

```bash
kubectl logs -n labs64io -l app.kubernetes.io/name=api-gateway --tail=50   # the Auth Gateway's decision
kubectl get pods -n labs64io -l app.kubernetes.io/name=authz-pdp           # the policy engine
```

The platform fails closed: a route without a policy, a missing token or an unreachable policy engine all end in a refusal, never in an open door.

### Pods stay `Pending` or keep restarting

Give Docker at least 4 CPUs and 8 GB of memory. Then look at the pod:

```bash
kubectl describe pod <pod> -n labs64io | tail -20
kubectl logs <pod> -n labs64io --previous
```

## Commands worth knowing

| You want to know | Command |
|---|---|
| Is everything running? | `kubectl get pods -n labs64io` |
| Why is this pod unhappy? | `kubectl describe pod <pod> -n labs64io` |
| What does a service say? | `kubectl logs -n labs64io -l app.kubernetes.io/name=<module> --tail=100` |
| What happened recently? | `kubectl get events -n labs64io --sort-by=.lastTimestamp` |
| Which routes exist? | `kubectl get httproute -n labs64io` |
| Is the installer's install healthy? | `bash install.sh status` |

Module names for the log command: `auditflow`, `payment-gateway`, `checkout`, `customer-portal`, `api-gateway`, `authz-pdp`, `api-docs`.

## Still stuck?

Open an issue in the repository the problem belongs to: [Helm charts and the installer](https://github.com/Labs64/labs64.io-helm-charts/issues), [AuditFlow](https://github.com/Labs64/labs64.io-auditflow/issues), or the [workspace](https://github.com/Labs64/labs64.io-workspace/issues) for anything about the local ecosystem. Say which path you followed and what you saw. For installer problems, attach `./labs64.io-install/install.log`, and never `secrets.yaml`.
