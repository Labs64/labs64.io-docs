---
title: Services & Modules
permalink: /services/
nav_order: 3
has_children: true
has_toc: false
---

# Services & Modules

Labs64.IO is composed of focused services. Adopt the capability you need today, then grow through shared identity, events, routing, and operating practices.

| Product area | Use it for | Services |
|---|---|---|
| [Core Platform](./core-platform.md) | Identity, policy, audit, and AI-tool access | Auth Gateway · AuditFlow · MCP Gateway |
| [Commerce & Billing](./commerce-billing.md) | Licensing, payments, checkout, and invoicing | NetLicensing · Payment Gateway · Checkout · Invoicing |
| [Extensions](./extensions.md) | Customer experiences, communication, and insight | Notifications · Reporting · Customer Portal · GuideChimp |

Every service page places its role in the wider ecosystem and tells you whether its documented capability is currently available or planned.

## The Labs64.IO ecosystem

Each module below has its own source repository. The documentation page of each module describes how to run, use and configure it.

| Module | What it does | Source |
|---|---|---|
| [Auth Gateway](./auth-gateway/index.md) | The authenticated edge in front of every module. It verifies the token of each request and asks the policy engine whether the operation is allowed. The repository is `labs64.io-authproxy`, the service is `traefik-authproxy` and its Helm chart is `api-gateway`. | [labs64.io-authproxy](https://github.com/Labs64/labs64.io-authproxy) |
| [AuditFlow](./auditflow/index.md) | Takes audit events over one REST call, redacts sensitive fields and routes each event to the destinations of its tenant | [labs64.io-auditflow](https://github.com/Labs64/labs64.io-auditflow) |
| [Payment Gateway](./payment-gateway/index.md) | One payment API in front of several payment providers | [labs64.io-payment-gateway](https://github.com/Labs64/labs64.io-payment-gateway) |
| [Checkout](./checkout/index.md) | An API for purchase orders, customers and checkout transactions, and a Vue 3 checkout page | [labs64.io-checkout](https://github.com/Labs64/labs64.io-checkout) |
| [Customer Portal](./customer-portal/index.md) | A front-end shell for a customer-facing web app, with a home page and a shopping-cart page and no backend | [labs64.io-customer-portal](https://github.com/Labs64/labs64.io-customer-portal) |
| [NetLicensing](./netlicensing/index.md) | Licensing as a service: license and entitlement management. It is a separate Labs64 product; its page here describes how it fits the platform. | [netlicensing.io](https://netlicensing.io) |
| [GuideChimp](./guidechimp/index.md) | Interactive guided product tours. It is a separate Labs64 product; its page here describes how it fits the platform. | [labs64.com/guidechimp](https://www.labs64.com/guidechimp/) |

The repositories that hold no module, such as the shared libraries, the Helm charts, the development workspace, the regression suite and this documentation, are listed in [Workspace and source repositories](../development/workspace-repositories.md).

The five GitHub repositories in this table are open source. For their license, see [License](../development/contributing.md#license).
