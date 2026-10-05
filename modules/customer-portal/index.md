---
title: Customer Portal
parent: Extensions
nav_order: 3
---

# Customer Portal

The Customer Portal is the shell of a self-service web front end for your end users: a Vue 3 single-page application with the portal layout, navigation and a home page, served by Nginx behind the Auth Gateway. Feature screens are composed into it as micro-frontends through module federation; the shopping-cart page shows the pattern by loading a `ShoppingCart` component from a remote `ecommerce` application.

The portal has no backend of its own and calls no Labs64.IO API yet.

| Part | Stack |
|---|---|
| `customer-portal-fe` | Vue 3 (Composition API), Vite, Pinia, TypeScript, Bootstrap 5 |

## Key capabilities

| Capability | What you get |
|---|---|
| **Portal shell** | Layout with header, sidebar and footer, routing and a home page to build on. |
| **Micro-frontend host** | Module federation (`@originjs/vite-plugin-federation`) loads screens from separately built and deployed applications, sharing `vue` and `pinia`. |
| **One image, any environment** | Multi-stage build (Node to build, Nginx to serve). |

## Start here

```bash
git clone https://github.com/Labs64/labs64.io-customer-portal.git
cd labs64.io-customer-portal/customer-portal-fe
npm install
npm run dev     # http://localhost:8080
```

The federation remote `ecommerce` is expected at `http://localhost:8081/assets/remoteEntry.js` in development; point the `remotes` entry in `vite.config.ts` at your own remote application.

On Kubernetes the portal is deployed by the `customer-portal` chart in [labs64.io-helm-charts](https://github.com/Labs64/labs64.io-helm-charts/tree/master/charts/customer-portal), as part of the [full ecosystem](../../getting-started/run-the-full-ecosystem-locally.md).

## Extend

Add a page as a route in `src/router/routes.ts`, or build the screen as its own federated application and load it as a remote. Calls to Labs64.IO APIs go through the gateway with the user's token, like any other client; see [Auth Gateway](../auth-gateway/index.md).

## Operate

The image serves static files only and can sit behind a CDN. Nginx is configured for single-page routing, so deep links resolve to `index.html`.

## Next steps

- [Checkout](../checkout/index.md)
- [Architecture overview](../../introduction/architecture.md)
