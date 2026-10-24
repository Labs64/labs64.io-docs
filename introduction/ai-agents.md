---
title: Using Labs64.IO with AI agents
parent: Overview
nav_order: 4
---

# Using Labs64.IO with AI agents

An AI agent can use Labs64.IO the way any other client does: it gets a token, calls a REST API and reads an OpenAPI contract. It can also work on the platform's code the way a human contributor does. This page covers both, and what to watch for.

## Calling the platform from an agent

### Give the agent its own identity

Create a service client (OAuth client credentials) for each agent and grant it only the scopes its task needs. A reporting agent does not need `payment:pay`. The [API Gateway](../modules/auth-gateway/) turns the token into trusted headers (`X-Auth-User: svc:<client>`, `X-Auth-Scopes`, `X-Auth-Tenant`) before a module sees the request, so the module never handles the agent's credentials.

When a call is refused, the status tells the agent what to do next:

| Status | Meaning | What the agent should do |
|---|---|---|
| `401` | No token, or an invalid one | Get a fresh token. Retrying with the same one will not help |
| `403` | Valid token, but the scope is missing or no policy covers the route | Stop and ask for the scope. Retrying will not help |
| `429` | Rate or quota limit | Wait for the `Retry-After` period, then retry |

### Read the contract instead of guessing

Every module publishes an OpenAPI v1 spec, and the running service serves it. Generate a client or a tool definition from it. Within v1 the specs only grow, so a tool definition you generate today keeps working. The aggregated Swagger UI behind the gateway lists every installed module, which is the quickest way to see what a given environment offers. The [OpenAPI reference](../reference/openapi.md) lists the spec locations.

### Make retries safe

Agents time out and retry, so build for it:

- **Payments.** Send an `Idempotency-Key` with `POST /payments/{id}/pay`. If the agent retries after a timeout, it gets the original transaction back and the customer is not charged twice.
- **Audit events.** Reuse the same `eventId` when you retry. A duplicate is suppressed rather than stored twice.

### Module notes

**[Payment Gateway](../modules/payment-gateway/).** `GET /payment-definitions` lists the providers the platform supports, and `GET /payment-providers` lists the ones this tenant has configured. Ask the second one before you assume a provider is available.

**[Checkout](../modules/checkout/).** Send `consents` and `extra` in every order body, even if both are `{}`. Today a body without them returns `500` instead of a validation error. Orders need scopes such as `purchase-order:write` and `purchase-order:checkout`.

**[AuditFlow](../modules/auditflow/).** This is where an agent can record what it did. Call `POST /audit/publish` (or `/audit/publish/batch` for up to 100 events) with an `eventType` such as `agent.tool.called`, the agent's name as `sourceSystem`, and the details in `extra`. Fields named in your redaction rules are removed before the event is stored anywhere. It needs no SDK, one HTTP call per action is enough. Errors you may see:

- `400` for an invalid event
- `403` with `TENANT_NOT_PROVISIONED` or `TENANT_DISABLED`
- `413` when the event is larger than the broker accepts (about 1 MiB on SQS)
- `429` with `Retry-After`
- `503` when the broker has not confirmed the event. Retry with the same `eventId`

Before you rely on a route, `POST /actuator/pipelines/<tenantId>/dry-run` shows which pipelines a sample event would reach and why.

**[Customer Portal](../modules/customer-portal/).** This is a human-facing app, so agents mostly work on it, not through it.

## Getting an environment to test against

The installer is built to run without a person at the keyboard, which suits CI jobs and agents:

- `LABS64_PROFILE=quickstart` or `byo` skips every prompt.
- `bash install.sh --dry-run` shows what would change before anything does.
- `bash install.sh status` exits non-zero when something is unhealthy, and `smoke` repeats the token and publish check.
- The installer labels everything it creates, so `uninstall` never touches a resource it did not create.

See [Quickstart](../getting-started/quickstart/) for the full walkthrough.

## Working on the code with an agent

Each repository has an `AGENTS.md` (and usually a `CLAUDE.md`) that describes its layout, conventions and test commands. Read those first. Some habits apply everywhere:

- **Start in the workspace.** Every build, deploy and test is a `just` recipe run from the workspace repository, and the same recipe name means the same thing in every repository. The workspace also carries a knowledge graph and skills for following a change across repositories. See [Workspace and source repositories](../development/workspace-repositories.md).
- **Check before you propose.** `just ci` in the repository you changed runs what its pull-request check runs. `just smoke` checks the running platform.
- **Use the narrowest test slice.** In the [regression suite](../development/regression-tests.md), `robot --include smoke --exclude not-ga tests/` is the fast gate and `robot tests/<module>/` runs one service. Open `log.html` first when something fails, since it holds the full request and response. New tests go through the gateway.
- **Leave version pins to the parent.** Services get their versions from `labs64io-parent` in [Commons](../development/shared-libraries.md). Change it there, once, and do not re-pin in a service. The trusted-header test vectors in Commons are the spec for both languages, so a parser change has to keep them green.
- **Update the docs in the same change.** Pages describe what ships.

## Docs for agents

This site is plain Markdown under stable URLs. [`llms.txt`](/docs/llms.txt) is a short index of it, and each section is also published as one bundled text file (linked from `llms.txt`), so an agent can load a whole section in one request. For module status, read `_data/modules.yml` in the website repository. Do not infer status from prose.
