# Payment Gateway Module

Develop a payment gateway module that integrates with multiple Payment Service Providers (PSPs) via a standardized interface (**PSP Adapter**), enabling payment processing across arbitrary platforms. The module should support multiple payment methods, configurable through an external configuration file. Payments are processed on behalf of tenants, with tenant-specific PSP configurations stored in the database and linked to tenant IDs. For this scope, PSP Adapters will be implemented for Stripe, PayPal, and a dummy “No-Op Provider,” with the module designed to allow easy addition of new PSPs in the future. It must support recurring payments and ensure that all transactions are fully traceable and auditable.

---

## Prerequisites
* Active [GitHub account](https://docs.github.com/en/get-started/onboarding/getting-started-with-your-github-account) for source code access and collaboration
* Own [PayPal developer account](https://developer.paypal.com/) for configuring, testing and integrating payment flows
* Own [Stripe developer account](https://docs.stripe.com/development) for configuring, testing and integrating payment flows

---

## Technical Requirements / Stack

* **Frameworks:**
  * Backend: Java 25, Spring Boot (latest), Spring Framework (latest)
  * Frontend: Typescript, Vue (latest), Vite (latest), ESLint + Prettier, Vue-Router,  Pinia, Vitest, Playwright, Bootstrap, Axios
* **Database:** PostgreSQL (latest)
* **Caching:** Redis
* **Messaging:** RabbitMQ (latest)
* **Containerization:** Docker / concurrent multi-container operations. Assume deployment in Kubernetes
* **Build Tool:** Maven (latest)
* **API Documentation:** OpenAPI 3.0 (YAML)
* **Authorization:** in the module using JWT token verification (OIDC/OAuth2)

---

## Functional Requirements

### General Architecture

* **Structure:** Module structure should follow the design of the existing [checkout](https://github.com/Labs64/labs64.io-checkout) and [auditflow](https://github.com/Labs64/labs64.io-auditflow) modules.
* **Configuration:** Module static configuration must be managed via Spring Boot, covering:
  * Payment methods / common PSP configuration
  * Currencies support
  * etc.
* **Security:**
  * **Tokenization:** The module must **never** store raw credit card numbers. It must store PSP tokens/IDs (e.g., Stripe `customer_id`, `payment_method_id`).
  * **Resilience:** The `/pay` endpoint (see below) must support an `Idempotency-Key` header to prevent duplicate charges during network failures.
  * **API Security:** All API endpoints must be secured via JWT token (m2m) verification.
* **Abstraction:** Introduce a **PSP Abstraction Layer** so new PSPs can be added or maintained easily.
* **Payment States:**
  * `ACTIVE` -  payment is enabled and will be executed on schedule
  * `INCOMPLETE` -  payment setup is incomplete; requires user action
  * `PAUSED` -  payment is temporarily paused but can be resumed later
  * `CLOSED` -  payment is closed and won't be executed anymore
* **Transaction States:**
  * `PENDING` - payment is initiated but not completed yet
  * `SUCCESS` - payment completed successfully
  * `FAILED` - payment attempt failed; will be retried based on dunning logic

### Integration & Messaging

* **API:** Implement a RESTful API (via OpenAPI specification) to manage payment gateway methods.
  * Document all endpoints in OpenAPI YAML
  * Add request/response examples
  * Describe common error model for all endpoints
  * Generate API java stubs from the OpenAPI (e.g. **API-first approach**)
* **Queueing:** Final payment transactions should be published to a **RabbitMQ** queue for further processing by other ecosystem modules.
* **PSP UI Actions:** Handle PSP-specific user actions (redirects, pop-ups, inline payment forms, etc.) as part of Payment Gateway UI integration.
  * PSP specific frontend dependencies should be exported from the PSP Adapter.

---

## User-Driven Payment Flow

```mermaid
sequenceDiagram
  autonumber

  participant Client as Client / Checkout UI
  participant API as Payment Gateway API
  participant CFG as Config (YAML)
  participant DB as PostgreSQL
  participant PSP as PSP Adapter
  participant MQ as RabbitMQ
  participant Subscriber as AuditFlow / Checkout / Invoice

  Client->>API: GET /payment-methods
  API->>CFG: Load payment methods (capabilities: currency, recurring)
  API->>DB: Load tenant PSP configs (by tenantId from JWT)
  API-->>Client: List of available payment methods

  Client->>API: POST /payments (paymentMethodId, purchaseOrder, ...)
  API->>CFG: Load payment method metadata
  API->>DB: Load tenant PSP config for paymentMethodId
  API->>DB: Create Payment (INCOMPLETE)
  API-->>Client: Payment + optional nextAction (setup)

  Client->>API: POST /payments/{payment.id}/pay (Idempotency-Key)
  API->>DB: Check Idempotency-Key (unique per tenant+payment)
  API->>DB: Create Transaction (PENDING)
  API->>PSP: executePayment() (tokenized data / references)
  PSP-->>API: PSP response (status, references, nextAction?)

  alt Sync completed (SUCCESS/FAILED)
    API->>DB: Update Transaction (SUCCESS/FAILED)
    API->>DB: Update Payment (CLOSED for one-time / ACTIVE for recurring)
    API->>MQ: Publish payment.finalized (transaction payload, correlationId)
    MQ-->>Subscriber: Consume event
    API-->>Client: Transaction status
  else Requires user action (3DS/redirect)
    API->>DB: Update Payment (INCOMPLETE) + store nextAction
    API-->>Client: nextAction (redirect / 3DS)
  else Async completion (webhook later)
    API-->>Client: 202 Accepted (Transaction PENDING)
    PSP-->>API: Webhook/notification (later)
    API->>DB: Update Transaction (SUCCESS/FAILED)
    API->>MQ: Publish payment.finalized (transaction payload, correlationId)
    MQ-->>Subscriber: Consume event
  end
```

## API Proposal

This section outlines the proposed RESTful API endpoints for the Payment Gateway module.  It is not meant to be exhaustive but serves as a starting point for implementation.

Every endpoint supports `correlationId` tracing via `X-Correlation-ID` header.

### 1. Retrieve Payment Methods

**`GET /payment-methods`**

* **Query Parameters:**
* `currency` (string) *(optional)*: Filter payment methods by supported currency code.
* `country` (string) *(optional)*: Filter payment methods by supported country code.

* **Response:**
* `id` (string): Unique identifier for the payment method.
* `name` (string): Name of the payment method.
* `description` (string): Description of the payment method.
* `icon` (base64) *(optional)*: Data for the PSP icon image.
* `recurring` (boolean): Indicates if the method supports recurring payments.

### 2. Configure PSP for a tenant

**`POST /payment-method/{paymentMethodId}`**
*Configure specific payment method for the tenant. The tenant is to be determined from the JWT token.*

* **Request Body:**
* `pspConfig` (object): PSP-specific configuration parameters.

* **Response:**
* * No content (204) on success.

### 3. Initiate Payment Instance

**`POST /payment`**
*Initiate a new payment instance (one-time or recurring) and capture payment details. No actual payment will be performed yet! The payment is to be linked with a tenant. The tenant is to be determined from the JWT token.*

* **Request Body:**
* `paymentMethodId` (string): id of the selected payment method.
* `purchaseOrder` (object): Details from the [checkout](https://github.com/Labs64/labs64.io-checkout) module.
  * ... including 
  * `recurring` (boolean): Indicates if the payment is recurring.
* `billingInfo` (object): Billing information.
* `shippingInfo` (object) *(optional)*: Shipping information.
* `extra` (object) *(optional)*: Additional metadata.

* **Response:**
* `payment` (object): The created Payment object.
* `nextAction` (object): returns optional next action required to complete the payment details capture via specific PSP flow.
  * `type` (string): e.g., "none", "redirect", "3ds-challenge".
  * `details` (object): Metadata required for the next action.

### 4. Execute Payment

**`POST /payment/{payment.id}/pay`**
*Execute a payment via external PSP using stored captured payment details and creates payment transaction. For non-recurring payments, this operation closes the payment on success.*

*NOTE: PSP may imply delayed completion of the payment with later notification. Ensure architecture is prepared for handling this scenario by capturing the PSP notification and adjusting the transaction status in the background.*
*Transaction status transitions to `SUCCESS` or `FAILED` are to be published in the queueing service.*

* **Response:**
* `transaction` (object): Payment transaction details.
  * `id` (string): Unique identifier for the transaction.
  * `status` (string): Transaction status.
  * `pspData` (object): Raw data returned from the PSP.

### 5. Payment Status

**`GET /payment/{payment.id}`**
*Retrieve the status and details of an existing payment. Can be used to restore (possibly incomplete) `nextAction` processing*

* **Response:**
* `payment` (object): The created Payment object.
* `nextAction` (object):
  * `type` (string): e.g., "none", "redirect", "3ds-challenge".
  * `details` (object): Metadata required for the next action.

### 6. Close Payment

**`POST /payment/{payment.id}/close`**
*Close an existing payment. No further pay operations can be executed.*

### 7. Transaction Status

**`GET /transaction/{transaction.id}`**
*Retrieve the status and details of a payment transaction.*

* **Response:**
* `transaction` (object): Payment transaction details.
  * `id` (string): Unique identifier for the transaction.
  * `status` (string): Transaction status.
  * `pspData` (object): Raw data returned from the PSP.

---

## Deliverables

* **OpenAPI Spec:** Fully specified YAML file for the RESTful API.
* **Java Module:** Implementing the functionality described above; including PayPal, Stripe and NoOp PSP adapters.
* **Unit Tests:** Covering all major functionalities.
* **Configuration:** 
  * Structured `application.yaml` for integrated payment methods.
  * PSP-specific configuration instructions/templates/examples for a tenant.
* **Database:** Flyway migration scripts in `resources/db/migration`.
* **Dockerfile:** For containerizing the module.
  * Create docker-compose for local development including HA config with multiple instances.
* **Documentation:** Setup, configuration, usage guide, contributor guide.
* **CI/CD:** `.github` workflows pipeline to build, test.

---

## Milestones

- Total workload will be split into milestones defined as below.
- At the beginning of each milestone, a new PR must be created targeting the main branch of the [Payment Gateway repo](https://github.com/Labs64/labs64.io-payment-gateway).
- Daily work progress must be frequently committed (one daily commit at minimum).
- Early & timely communication via GitHub Issues and PRs only. Expect on-the-fly comments to the commits.
- Each milestone must be approved and merged before proceeding to the next one.
- Scope review and adjustments may be done at the end of each milestone if necessary. Additional work beyond the defined milestones will be treated as out-of-scope and must be agreed separately.
- Approved and merged milestones PRs are considered as completed and entitled for payment.
- Failure to complete a milestone within the agreed timeframe may result in project termination.

---

* **Milestone 1:** Project Setup & Basic Architecture
  * Setup Spring Boot project with necessary dependencies.
  * Design OpenAPI specification with generated Java interface and create API stubs with log output.
  * Dockerfile and basic CI/CD pipeline.
* **Milestone 2:** PSP Abstraction Layer & NoOp Implementation
  * Implement PSP Abstraction Layer using Strategy Pattern.
  * Create NoOp PSP adapter for testing.
  * Create needed database entities and Flyway migration scripts.
  * Implement all endpoints with basic logic.
* **Milestone 3:** Stripe Integration
  * Implement Stripe PSP adapter.
  * Complete payment flow for Stripe.
  * Unit tests for Stripe integration.
* **Milestone 4:** PayPal Integration
  * Implement PayPal PSP adapter.
  * Complete payment flow for PayPal.
  * Unit tests for PayPal integration.

**Release Condition:** The Pull Request to the [Payment Gateway repo](https://github.com/Labs64/labs64.io-payment-gateway) must be accepted and merged into the main branch to release the freelance payment feature.


---

## Acceptance Criteria

* Code follows standard Java best practices (consistent with `checkout`/`auditflow` modules) and is well-documented.
* **PSP Abstraction Layer** is implemented using the **Strategy Pattern** (e.g., `StripeProvider`, `PayPalProvider`, and `NoOpProvider` implement a common `PaymentProvider` interface).
* **Integrated PSPs:**
  * Stripe (latest API) - https://docs.stripe.com/api
  * PayPal (latest API) - https://developer.paypal.com/api/rest/
  * None (NoOp for testing)
* One-time and Recurring payment can be demoed with all integrated PSPs using sandbox accounts.
* **Async Messaging:** RabbitMQ producer is implemented for `payment.finalized` events with transaction payload.
* **Distributed Environments / Kubernetes safety:**
  * All functionality can run reliably on Kubernetes
  * Execution is idempotent to prevent duplicate processing
  * Components are safe to run in parallel across multiple pods
  * Coordination and state handling support distributed execution without race conditions
* **Traceability:** Every log entry and RabbitMQ message must contain a `correlationId` traceable across ecosystem modules.
* Docker container builds successfully and runs without errors.
* All unit tests pass with >80% code coverage.
* API endpoints function exactly as specified in the OpenAPI documentation.
* Logging Policy: no sensitive information in the logs, such as PAN/PII, credentials, etc.
* Payment methods are configurable via YAML and retrievable via API.
* **Vulnerability Scanning:** no `High` and `Critical` vulnerabilities (static code analysis, dependencies, docker, etc.) with GitHub Code scanning / CodeQL, Trivy for Docker
