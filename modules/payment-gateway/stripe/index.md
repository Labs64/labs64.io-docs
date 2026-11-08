---
title: Stripe
parent: Payment Gateway
grand_parent: Commerce & Billing
nav_order: 2
---

# Stripe payment provider

This module implements Stripe Checkout and Stripe webhook handling behind the
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
endpoint signing secret are different values. Store the secret belonging to
the endpoint that sends events to the current environment.

## API endpoint override

By default, the provider lets the Stripe SDK use Stripe's official API endpoint. Isolated
integration environments may set the provider-owned Spring property:

```yaml
payment-provider:
  stripe:
    api-base-url: http://localhost:8090
```

Spring's environment-variable equivalent is:

```bash
PAYMENT_PROVIDER_STRIPE_API_BASE_URL=http://localhost:8090
```

This is process-level test infrastructure configuration, not tenant `PaymentProvider` config.
The Stripe provider's auto-configuration owns the property and applies it only while constructing
the Stripe SDK client. If it is absent, the SDK default is unchanged. Payment Gateway does not
contain Stripe-specific configuration binding.

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

The external gateway prefix is deployment-specific. Confirm it before
registering the endpoint. Stripe must be able to reach the URL over the
internet; it cannot call `localhost` directly.

## Required webhook events

Configure the Stripe endpoint for these events:

| Stripe event | Gateway result |
| --- | --- |
| `checkout.session.completed` | `SUCCESS` when `payment_status` is `paid` or `no_payment_required`; otherwise `PENDING` |
| `checkout.session.async_payment_succeeded` | `SUCCESS` |
| `checkout.session.async_payment_failed` | `FAILED` |
| `checkout.session.expired` | `FAILED` |

The provider stores `paymentTransactionId` in Checkout Session and Payment
Intent metadata. The webhook uses this metadata to restore the correct
transaction and provider configuration before signature verification.

## Dashboard setup

1. Open Stripe Dashboard and select the correct Test or Live mode.
2. Go to **Developers → Webhooks** and add the public Payment Gateway webhook URL.
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

`stripe listen` prints a temporary `whsec_...` signing secret. Put that value
in the local Stripe provider configuration while the listener is in use.

## Checkout flow

1. The client calls `/payments/{paymentId}/pay` and supplies absolute
   `checkout.returnUrl` and `checkout.cancelUrl` values. These are the final
   tenant/client destinations.
2. Payment Gateway validates the request before creating the payment attempt.
3. Payment Gateway creates the transaction and Checkout Session, then builds
   its own provider callback URLs.
4. The Stripe provider creates a Stripe Checkout Session using the gateway
   callback URLs and stores the gateway transaction ID in Stripe metadata.
5. The client follows the returned redirect action to Stripe Checkout.
6. Completion can reach Payment Gateway through the browser return, a Stripe
   webhook, or both.
7. The provider verifies the webhook using the exact raw body and
   `Stripe-Signature`, then returns a normalized provider result.
8. Payment Gateway applies the result under a database lock. A duplicate
   terminal result cannot overwrite the transaction.
9. For a successful one-time payment, the transaction becomes `SUCCESS`, the
   payment becomes `CLOSED`, and finalized/closed events are published.

## Troubleshooting

- **Controller breakpoint is not reached:** verify the route and external
  gateway prefix. Check that the endpoint is publicly reachable.
- **HTTP 400 / signature verification failed:** the configured
  `webhookSecret` does not belong to the sending endpoint, or the raw request
  body was modified before verification.
- **Webhook cannot restore the transaction:** confirm the event belongs to a
  Checkout Session created by this provider version and contains
  `paymentTransactionId` metadata.
- **Stripe CLI remains on `Getting ready`:** run it with `--log-level debug`
  and check proxy/firewall access to Stripe WebSocket endpoints.
- **Browser return and webhook arrive together:** this is expected. The
  transaction update lock and terminal-state guard make processing idempotent.
