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
| `webhookId` | yes | ID of the webhook endpoint registered in that PayPal application. PayPal requires it to verify a webhook signature. |

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

By default, the PayPal SDK calls PayPal's official Sandbox or Live endpoint. An isolated
integration environment can point it elsewhere with this Spring property, which the PayPal
provider owns:

```yaml
payment-provider:
  paypal:
    api-base-url: http://localhost:8090
```

The equivalent environment variable is:

```bash
PAYMENT_PROVIDER_PAYPAL_API_BASE_URL=http://localhost:8090
```

This setting applies to the whole process and is not part of the tenant `PaymentProvider`
config. The PayPal provider's auto-configuration applies it when it builds SDK clients and when
it sends webhook verification requests. Without the property, the SDK uses its official
endpoint. The Payment Gateway core has no PayPal-specific configuration binding.

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

The external gateway prefix depends on your deployment. Confirm it before you
register the endpoint. PayPal must reach the URL over public HTTPS, so it
cannot call `localhost`. Use a trusted tunnel for local manual testing.

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
does not capture the order by itself. In the usual flow, the browser returns to
Payment Gateway and the return handler calls the PayPal capture API. If the
buyer closes the browser, that callback never happens.

`CHECKOUT.ORDER.COMPLETED` and `PAYMENT.CAPTURE.COMPLETED` are not enough on
their own, because PayPal emits them only after capture. The
`CHECKOUT.ORDER.APPROVED` webhook is the fallback that lets the provider
capture the order without the browser.

The return handler and approved-order webhook use the gateway transaction UUID
as the PayPal idempotency key. If both run at once, PayPal treats them as the
same capture attempt. Payment Gateway also protects the local transaction with
a database lock and a terminal-state guard.

## PayPal application setup

1. Open the PayPal Developer Dashboard and select **Apps & Credentials**.
2. Select **Sandbox** or **Live**, matching the provider `environment`.
3. Open the REST application whose `clientId` and `clientSecret` are stored in
   the Payment Gateway provider configuration.
4. Add a webhook using the public Payment Gateway PayPal webhook URL.
5. Select all events from the table above. Make sure **Checkout order approved**
   is selected.
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
   `checkout.returnUrl` and `checkout.cancelUrl` values. The gateway sends the
   customer to one of these URLs at the end of the flow.
2. Payment Gateway validates the request, creates the payment transaction and
   Checkout Session, and builds its own provider return and cancel callback URLs.
3. The PayPal provider creates an order and writes the gateway transaction UUID
   to the purchase unit `invoice_id`. It sends only the gateway callback URLs
   to PayPal.
4. The client follows the approval redirect returned by PayPal.
5. Browser return and cancel callbacks must carry a PayPal `token` that matches
   the `orderId` stored on the restored transaction. A missing or mismatched
   token sends the browser to the configured gateway fallback without calling
   PayPal or changing transaction state.
6. After buyer approval, either of these paths can finish capture:
   - the browser reaches the gateway return callback; or
   - PayPal sends `CHECKOUT.ORDER.APPROVED` and the verified webhook handler
     captures the order.
7. Before it trusts a webhook, the provider extracts `invoice_id` only so that
   Payment Gateway can restore the transaction and its PayPal provider config.
8. The provider sends the PayPal transmission headers, full webhook event, and
   configured `webhookId` to PayPal's `verify-webhook-signature` API.
9. The provider handles a webhook only when the verification result is
   `SUCCESS`. For an invalid or unverifiable request, it throws
   `WebhookRejectedException` and leaves the transaction unchanged.
10. Payment Gateway applies the normalized result under a database lock. A
    duplicate return or capture webhook cannot overwrite a terminal transaction.
11. For a successful one-time payment, the transaction becomes `SUCCESS`, the
    payment becomes `CLOSED`, and Payment Gateway publishes the
    `payment.finalized` and `payment.closed` events.

## Automated PSP integration coverage

The opt-in Robot suite `tests/e2e/paypal_psp_flow.robot` runs the built Payment Gateway through
the public gateway edge while the real PayPal Java SDK talks to an external WireMock process. It
covers:

- the OAuth, create-order, capture-order, and webhook-verification HTTP contracts;
- idempotent replay;
- upstream and incomplete responses;
- browser return and cancel;
- the approved-order capture fallback;
- completed and denied events;
- verification rejection and terminal-state protection.

Run it through the shared test orchestrator:

```bash
cd labs64.io-tests   # sibling checkout of the workspace
just test-up
just test-psp
just test-down
```

The deterministic suite verifies the gateway's integration and state transitions. It does not prove that
PayPal credentials, account configuration, hosted checkout, or the live PayPal network are healthy.

## Troubleshooting

- **No delivery attempt in PayPal.** Verify that the webhook belongs to the
  same Sandbox or Live REST application as `clientId`, and that the required event
  is selected.
- **Only `Checkout order completed` is selected.** Add
  `Checkout order approved`. PayPal emits the completed event after capture, so
  it cannot trigger capture when the browser does not return.
- **Controller breakpoint is not reached.** Verify the path is
  `/providers/paypal/webhooks`, including the deployment's external gateway
  prefix, and confirm that the URL is publicly reachable over HTTPS.
- **Controller is reached but returns HTTP 400.** Check `webhookId`, PayPal
  transmission headers, transaction `invoice_id`, and the application environment.
- **Verification fails after recreating the endpoint.** Update `webhookId` in
  the Payment Gateway provider config. A newly created endpoint has a new ID.
- **PayPal webhook simulator is rejected.** Simulator payloads may not contain
  the transaction UUID written by a real gateway-created order. Use an actual
  Sandbox checkout when testing the complete transaction flow.
- **Browser return and webhook arrive together.** This is expected. The PayPal
  request ID and the gateway transaction lock make the processing idempotent.
