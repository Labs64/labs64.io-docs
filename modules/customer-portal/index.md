---
title: Customer Portal
parent: Extensions
nav_order: 3
---

# Customer Portal

## Overview
Customer Portal is the customer-facing single-page app of the platform: a Vue 3 application built into static files and served by unprivileged nginx behind the API Gateway.

> **Current scope.** The repository ships the front-end shell, with a home page and a shopping-cart page. A Java backend (`customer-portal-be`) is planned but not implemented, so the portal does not yet call a Labs64.IO API on its own.

## Capabilities

| Capability | Description |
|------------|-------------|
| **Static, one image** | A multi-stage build produces files served by unprivileged nginx; the image runs on any cluster or static host. |
| **Edge authentication** | Sign-in is handled at the API Gateway (OIDC/JWT); the app itself is static. |
| **Modern front end** | Vue 3 (Composition API), Vite, Pinia, TypeScript, Bootstrap 5 and Bootstrap Vue Next. |
| **Composable** | Module federation (`@originjs/vite-plugin-federation`) is available for micro-frontends. |
| **Tested** | Unit tests with Vitest, end-to-end tests with Playwright, linted with ESLint. |

## Architecture

The portal is a single-page app served by nginx. The API Gateway authenticates the caller and routes `/customer-portal` to it.

```mermaid
flowchart LR
    Browser["Browser"] -->|"GET /customer-portal"| GW["API Gateway"]
    GW -->|"static files"| CP["customer-portal-fe<br/>Vue 3 · nginx (unprivileged)"]
```

## Quick Start

Install the platform with the BYO profile of the [installer](../../getting-started/deploy-to-kubernetes.md) and answer **yes** to "Enable Customer Portal", or run the [full local ecosystem](../../getting-started/run-the-full-ecosystem-locally.md) and open `http://gateway.localhost/customer-portal`.

To see the app without a cluster, run the published image. Only the `edge` tag is published today:

```bash
docker run -d --rm --name portal -p 8080:8080 labs64/customer-portal-ui:edge
```

Open <http://localhost:8080> and clean up with `docker rm -f portal`.

### Install with Helm

The portal chart has no backend dependency, so this is the shortest install of any module:

```bash
helm repo add labs64io https://labs64.github.io/labs64.io-helm-charts
helm repo update

helm install my-portal labs64io/customer-portal -n labs64io --create-namespace
```

Put it behind your gateway route at `/customer-portal`. See [Deploy to your Kubernetes cluster](../../getting-started/deploy-to-kubernetes.md) and the [chart on Artifact Hub](https://artifacthub.io/packages/helm/labs64io-helm-charts/customer-portal).

### Build from source

Needs Node and npm (Docker for the image):

```bash
git clone https://github.com/Labs64/labs64.io-customer-portal.git && cd labs64.io-customer-portal/customer-portal-fe
npm install
npm run dev          # hot-reload dev server on http://localhost:8080
npm run test:unit    # Vitest
npm run test:e2e     # Playwright
npm run lint         # ESLint
docker build -t customer-portal-ui .
```

The repository's `AGENTS.md` describes the layout, commands and tests; the [Contributing guide](../../development/contributing.md) covers the workflow.

## Configuration

The chart has no backend dependency; enable the UI with `ui.enabled`. The nginx image listens on port `8080` as an unprivileged user.

## REST APIs

The Customer Portal is a client, not a server. It does not expose REST APIs.

## Events

The Customer Portal does not publish events.

## Operations

The portal is stateless static content: scale it with replicas and cache it at the edge. Because authentication happens at the gateway, expose it only through the gateway route.

## Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| `ImagePullBackOff` | No release tag of `labs64/customer-portal-ui` exists yet | Use the `edge` tag, or build the image from the repository. |
| `404` at `/customer-portal` | The route is not installed | Enable the module and its gateway route in the chart values. |
