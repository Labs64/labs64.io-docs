---
title: PayPal
parent: Payment Gateway
nav_order: 2
---

# PayPal

The `paypal` provider implements PayPal Checkout, order capture, and verified PayPal
webhook handling behind the Payment Gateway provider SPI. PayPal-specific API
calls, webhook verification, payload parsing, and status mapping stay inside
this module.

## Provider configuration

Every PayPal `PaymentProvider` must contain these configuration fields:

| Field | Required | Purpose |
| --- | --- | --- |
| `clientId` | yes | Client ID of the PayPal REST application. |
| `clientSecret` | yes | Client secret of the same PayPal REST application. |
| `environment` | yes | `sandbox` or `live`. It must match the PayPal application and webhook environment. |
| `webhookId` | yes | ID of the webhook endpoint registered in that PayPal application. PayPal requires it when verifying a webhook signature. |

Example configuration:

```json
{
  "provider": "paypal",
  "config": {
    "clientId": "sandbox-client-id",
    "clientSecret": "sandbox-client-secret",
    "environment": "sandbox",
    "webhookId": "9AA00000AA000000A"
  }
}
```

Never commit real credentials. `webhookId` is the ID of the registered webhook
endpoint, not the ID of an individual delivered event.

## API endpoint override

By default, the provider lets the PayPal SDK use PayPal's official Sandbox or Live endpoint.
Isolated integration environments may set the provider-owned Spring property:

```yaml
payment-provider:
  paypal:
    api-base-url: http://localhost:8090
```

Spring's environment-variable equivalent is:

```bash
PAYMENT_PROVIDER_PAYPAL_API_BASE_URL=http://localhost:8090
```

This is process-level infrastructure configuration, not tenant `PaymentProvider` config. The
PayPal provider's auto-configuration applies it while constructing SDK clients and while sending
webhook verification requests. If absent, the official SDK endpoint is unchanged; Payment
Gateway does not own PayPal-specific configuration binding.

## Webhook endpoint

The backend route is:

```text
POST /providers/paypal/webhooks
```

Typical URLs are:

```text
# Backend accessed directly
http://localhost:8080/providers/paypal/webhooks

# Default Labs64 gateway route
https://gateway.example.com/payment-gateway/api/v1/providers/paypal/webhooks
```

The external gateway prefix is deployment-specific. Confirm it before
registering the endpoint. PayPal must be able to reach the URL over public
HTTPS; it cannot call `localhost` directly. Use a trusted tunnel for local
manual testing.

## Required webhook events

Configure the PayPal webhook endpoint for at least these events:

| PayPal Dashboard label | Event name | Gateway behavior |
| --- | --- | --- |
| Checkout order approved | `CHECKOUT.ORDER.APPROVED` | **Required.** The provider captures the approved order. This completes the payment even if the buyer closes the browser before returning. |
| Checkout order completed | `CHECKOUT.ORDER.COMPLETED` | Maps the completed order to `SUCCESS`. |
| Payment capture completed | `PAYMENT.CAPTURE.COMPLETED` | Maps the capture to `SUCCESS`. |
| Payment capture pending | `PAYMENT.CAPTURE.PENDING` | Maps the capture to `PENDING`. |
| Payment capture denied | `PAYMENT.CAPTURE.DENIED` | Maps the capture to `FAILED`. |
| Payment capture reversed | `PAYMENT.CAPTURE.REVERSED` | Maps the capture to `FAILED`. |

### Why `CHECKOUT.ORDER.APPROVED` is mandatory

The provider creates PayPal orders with `intent=CAPTURE`, but buyer approval
does not capture the order by itself. Normally the browser returns to Payment
Gateway and the return handler calls the PayPal capture API. If the buyer
closes the browser, that callback never happens.

`CHECKOUT.ORDER.COMPLETED` and `PAYMENT.CAPTURE.COMPLETED` are therefore not
enough on their own: they are emitted only after capture. The
`CHECKOUT.ORDER.APPROVED` webhook is the independent fallback that lets the
provider perform capture without relying on the browser.

The return handler and approved-order webhook use the gateway transaction UUID
as the PayPal idempotency key. If they race, PayPal sees the same capture
attempt, and Payment Gateway also protects the local transaction with a
database lock and terminal-state guard.

## PayPal application setup

1. Open PayPal Developer Dashboard and select **Apps & Credentials**.
2. Select **Sandbox** or **Live**, matching the provider `environment`.
3. Open the REST application whose `clientId` and `clientSecret` are stored in
   the Payment Gateway provider configuration.
4. Add a webhook using the public Payment Gateway PayPal webhook URL.
5. Select all events from the table above. In particular, select
   **Checkout order approved**.
6. Save the webhook and copy its webhook ID.
7. Save that ID as `webhookId` in the corresponding Payment Gateway PayPal
   provider configuration.

PayPal documentation:

- [PayPal Standard Checkout integration](https://developer.paypal.com/docs/checkout/standard/integrate/)
- [PayPal REST webhooks](https://developer.paypal.com/api/rest/webhooks/)
- [PayPal webhook event names](https://developer.paypal.com/api/rest/webhooks/event-names/)
- [Verify webhook signature API](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature_post)

## Checkout and webhook flow

1. The client calls `/payments/{paymentId}/pay` and supplies absolute
   `checkout.returnUrl` and `checkout.cancelUrl` values. These are the final
   tenant/client destinations.
2. Payment Gateway validates the request, creates the payment transaction and
   Checkout Session, and builds its own provider return/cancel callback URLs.
3. The PayPal provider creates an order and writes the gateway transaction UUID
   to the purchase unit `invoice_id`. It sends only the gateway callback URLs
   to PayPal.
4. The client follows the approval redirect returned by PayPal.
5. Browser return and cancel callbacks must carry a PayPal `token` matching the
   `orderId` stored on the restored transaction. Missing or mismatched tokens
   redirect the browser to the configured gateway fallback without calling
   PayPal or changing transaction state.
6. After buyer approval, either of these paths can finish capture:
   - the browser reaches the gateway return callback; or
   - PayPal sends `CHECKOUT.ORDER.APPROVED` and the verified webhook handler
     captures the order.
7. Before trusting a webhook, the provider extracts `invoice_id` only to let
   Payment Gateway restore the transaction and its PayPal provider config.
8. The provider sends the PayPal transmission headers, full webhook event, and
   configured `webhookId` to PayPal's `verify-webhook-signature` API.
9. Only a `SUCCESS` verification result is handled. Invalid or unverifiable
   requests throw `WebhookRejectedException` and leave the transaction unchanged.
10. Payment Gateway applies the normalized result under a database lock. A
   duplicate return or capture webhook cannot overwrite a terminal transaction.
11. For a successful one-time payment, the transaction becomes `SUCCESS`, the
    payment becomes `CLOSED`, and finalized/closed events are published.

## Automated PSP integration coverage

The opt-in Robot suite `tests/e2e/paypal_psp_flow.robot` runs the built Payment Gateway through
the public gateway edge while the real PayPal Java SDK talks to external WireMock. It covers the
OAuth, create-order, capture-order, and webhook-verification HTTP contracts; idempotent replay;
upstream and incomplete responses; browser return/cancel; approved-order capture fallback;
completed and denied events; verification rejection; and terminal-state protection.

```bash
cd labs64.io-tests   # sibling checkout of the workspace
just test-up
just test-psp
just test-down
```

The deterministic suite verifies our integration and state transitions. It does not prove that
PayPal credentials, account configuration, hosted checkout, or the live PayPal network are healthy.

## Troubleshooting

- **No delivery attempt in PayPal:** verify that the webhook belongs to the
  same Sandbox/Live REST application as `clientId`, and that the required event
  is selected.
- **Only `Checkout order completed` is selected:** add
  `Checkout order approved`; completed is emitted after capture and cannot be
  the browser-independent capture trigger.
- **Controller breakpoint is not reached:** verify the path is
  `/providers/paypal/webhooks`, including the deployment's external gateway
  prefix, and confirm that the URL is publicly reachable over HTTPS.
- **Controller is reached but returns HTTP 400:** check `webhookId`, PayPal
  transmission headers, transaction `invoice_id`, and the application environment.
- **Verification fails after recreating the endpoint:** update `webhookId` in
  the Payment Gateway provider config; a newly created endpoint has a new ID.
- **PayPal webhook simulator is rejected:** simulator payloads may not contain
  the transaction UUID written by a real gateway-created order. Use an actual
  Sandbox checkout when testing the complete transaction flow.
- **Browser return and webhook arrive together:** this is expected and handled
  idempotently by the PayPal request ID and gateway transaction lock.
