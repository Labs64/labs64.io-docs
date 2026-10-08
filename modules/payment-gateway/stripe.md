---
title: Stripe
parent: Payment Gateway
nav_order: 1
---

# Stripe

The `stripe` provider implements Stripe Checkout and Stripe webhook handling behind the
Payment Gateway provider SPI. Stripe-specific API calls, payload parsing,
signature verification, and status mapping stay inside this module.

## Provider configuration

Every Stripe `PaymentProvider` must contain these configuration fields:

| Field | Required | Purpose |
| --- | --- | --- |
| `secretKey` | yes | Stripe secret or restricted API key used to create and retrieve Checkout Sessions. Test keys normally start with `sk_test_`. |
| `webhookSecret` | yes | Signing secret of the configured Stripe webhook endpoint. It starts with `whsec_`. |

Example configuration:

```json
{
  "provider": "stripe",
  "config": {
    "secretKey": "sk_test_...",
    "webhookSecret": "whsec_..."
  }
}
```

Never commit real keys. The Stripe CLI signing secret and the Dashboard
endpoint signing secret are different values. Store the secret of the endpoint
that sends events to the current environment.

## API endpoint override

By default, the Stripe SDK calls Stripe's official API endpoint. An isolated integration
environment can point it elsewhere with this Spring property, which the Stripe provider owns:

```yaml
payment-provider:
  stripe:
    api-base-url: http://localhost:8090
```

The equivalent environment variable is:

```bash
PAYMENT_PROVIDER_STRIPE_API_BASE_URL=http://localhost:8090
```

This setting applies to the whole process and is meant for test infrastructure. It is not part
of the tenant `PaymentProvider` config. The Stripe provider's auto-configuration applies it only
when it builds the Stripe SDK client. Without the property, the SDK uses its default endpoint.
The Payment Gateway core has no Stripe-specific configuration binding.

## Webhook endpoint

The backend route is:

```text
POST /providers/stripe/webhooks
```

Typical URLs are:

```text
# Backend accessed directly
http://localhost:8080/providers/stripe/webhooks

# Default Labs64 gateway route
https://gateway.example.com/payment-gateway/api/v1/providers/stripe/webhooks
```

The external gateway prefix depends on your deployment. Confirm it before you
register the endpoint. Stripe must reach the URL over the internet, so it
cannot call `localhost`.

## Required webhook events

Configure the Stripe endpoint for these events:

| Stripe event | Gateway result |
| --- | --- |
| `checkout.session.completed` | `SUCCESS` when `payment_status` is `paid` or `no_payment_required`; otherwise `PENDING` |
| `checkout.session.async_payment_succeeded` | `SUCCESS` |
| `checkout.session.async_payment_failed` | `FAILED` |
| `checkout.session.expired` | `FAILED` |

The provider stores `paymentTransactionId` in Checkout Session and Payment
Intent metadata. The webhook handler uses this metadata to restore the
transaction and its provider configuration before it verifies the signature.

## Dashboard setup

1. Open the Stripe Dashboard and select Test or Live mode to match the environment.
2. Open **Developers**, then **Webhooks**, and add the public Payment Gateway webhook URL.
3. Select the events listed above.
4. Reveal the endpoint signing secret.
5. Save that value as `webhookSecret` in the corresponding Payment Gateway
   Stripe provider configuration.

Stripe documentation:

- [Stripe Checkout quickstart](https://docs.stripe.com/checkout/quickstart)
- [Stripe webhooks](https://docs.stripe.com/webhooks)

## Local development with Stripe CLI

Authenticate the CLI and forward only the supported events:

```bash
stripe login

stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired \
  --forward-to http://localhost:8080/providers/stripe/webhooks
```

`stripe listen` prints a temporary `whsec_...` signing secret. Use that value as
`webhookSecret` in the local Stripe provider configuration while the listener runs.

## Checkout flow

1. The client calls `/payments/{paymentId}/pay` and supplies absolute
   `checkout.returnUrl` and `checkout.cancelUrl` values. The gateway sends the
   customer to one of these URLs at the end of the flow.
2. Payment Gateway validates the request before creating the payment attempt.
3. Payment Gateway creates the transaction and Checkout Session, then builds
   its own provider callback URLs.
4. The Stripe provider creates a Stripe Checkout Session using the gateway
   callback URLs and stores the gateway transaction ID in Stripe metadata.
5. The client follows the returned redirect action to Stripe Checkout.
6. The payment result reaches Payment Gateway through the browser return, a
   Stripe webhook, or both.
7. The provider verifies the webhook using the exact raw body and
   `Stripe-Signature`, then returns a normalized provider result.
8. Payment Gateway applies the result under a database lock. A duplicate
   terminal result cannot overwrite the transaction.
9. For a successful one-time payment, the transaction becomes `SUCCESS`, the
   payment becomes `CLOSED`, and Payment Gateway publishes the `payment.finalized`
   and `payment.closed` events.

## Automated PSP integration coverage

The opt-in Robot suite `tests/e2e/stripe_psp_flow.robot` runs the built Payment Gateway through
the public gateway edge while the real Stripe Java SDK talks to an external WireMock process.
It covers:

- the outbound create-session HTTP contract, including amount, currency, metadata, callbacks,
  authorization, and the provider-side idempotency key;
- replay of the same `/pay` request without a second Stripe call;
- Stripe 5xx and incomplete-success responses recorded as non-terminal `PENDING`
  transactions with normalized `PROVIDER_*` status details;
- paid and unpaid browser returns, cancellation, tenant redirects, and persisted state;
- valid success/failure webhook signatures, invalid-signature rejection, and protection of a
  terminal successful transaction from a late failure event.

Run it through the shared test orchestrator:

```bash
cd labs64.io-tests   # sibling checkout of the workspace
just test-up
just test-psp
just test-down
```

This deterministic suite verifies the gateway's integration contract and state transitions. It
does not prove that Stripe's hosted UI, credentials, account configuration, or live network are
healthy. Checking those needs a separate, scheduled smoke flow against Stripe test mode.

## Troubleshooting

- **Controller breakpoint is not reached.** Verify the route and external
  gateway prefix. Check that the endpoint is publicly reachable.
- **HTTP 400 or signature verification failed.** The configured
  `webhookSecret` does not belong to the sending endpoint, or the raw request
  body was modified before verification.
- **Webhook cannot restore the transaction.** Confirm the event belongs to a
  Checkout Session created by this provider version and contains
  `paymentTransactionId` metadata.
- **Stripe CLI remains on `Getting ready`.** Run it with `--log-level debug`
  and check that no proxy or firewall blocks the Stripe WebSocket endpoints.
- **Browser return and webhook arrive together.** This is expected. The
  transaction update lock and terminal-state guard make processing idempotent.
