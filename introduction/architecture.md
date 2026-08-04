---
title: Architecture Overview
parent: Overview
nav_order: 3
---

# Architecture Overview

This page outlines the core architectural principles and flows of the Labs64.IO ecosystem. The platform is designed as a set of independent, polyglot microservices deployed behind a unified gateway, adhering to API-first contracts.

## Request Flow

Every request crosses a zero-trust edge before it reaches any application code. Traefik serves as the ingress controller and delegates authentication and authorization to the Auth Gateway (`traefik-authproxy`) and the Cerbos Policy Decision Point (PDP).

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant T as Traefik Ingress
    participant AP as "Auth Gateway (Authproxy)"
    participant PDP as Cerbos PDP
    participant M as "Target Module (e.g. Checkout)"

    C->>T: HTTPS Request
    T->>AP: ForwardAuth Check
    AP->>AP: Verify OIDC / JWT signature
    AP->>PDP: authorize(request, user_context)
    PDP-->>AP: Allow / Deny based on policy
    
    alt Allowed
        AP-->>T: HTTP 200 OK + Trusted Headers (X-Auth-*)
        T->>M: Forward Request with X-Auth-*
        M-->>C: HTTP Response
    else Denied
        AP-->>T: HTTP 403 Forbidden
        T-->>C: HTTP 403 Forbidden
    end
```

On success, the Auth Gateway injects a trusted header contract that all upstream modules rely on:
- `X-Auth-User`
- `X-Auth-Scopes`
- `X-Auth-Tenant`
- `X-Request-ID`

## Event-Driven Architecture

While modules use synchronous REST calls for direct actions (e.g., initiating a payment), asynchronous state changes and audits are propagated via RabbitMQ to AuditFlow.

```mermaid
flowchart LR
    subgraph Producers
        CO[Checkout]
        PG[Payment Gateway]
    end
    
    MQ[(RabbitMQ Exchange)]
    
    subgraph Consumers
        AF[AuditFlow]
        SINK1[(Sink: OpenSearch)]
        SINK2[(Sink: S3)]
    end

    CO -->|"Order Created Event"| MQ
    PG -->|"Payment Succeeded Event"| MQ
    MQ -->|"Consumes"| AF
    AF -->|"Routes"| SINK1
    AF -->|"Routes"| SINK2
```

Modules do not read each other's databases. They communicate either across the gateway or by subscribing to/publishing events.

## Multi-Tenancy

Labs64.IO supports strict tenant isolation, utilizing a database-per-service model for persistent stores and isolated pipelines for events.

```mermaid
flowchart TB
    subgraph Tenant A Context
        DB_A[(Tenant A DB Schema)]
        PIPE_A[Tenant A Event Pipeline]
        SINK_A[(Tenant A Sinks)]
        PIPE_A --> SINK_A
    end

    subgraph Tenant B Context
        DB_B[(Tenant B DB Schema)]
        PIPE_B[Tenant B Event Pipeline]
        SINK_B[(Tenant B Sinks)]
        PIPE_B --> SINK_B
    end

    M[Module API] -->|"Tenant A Request"| DB_A
    M -->|"Tenant B Request"| DB_B
    
    E[Event Router] -->|"Tenant A Event"| PIPE_A
    E -->|"Tenant B Event"| PIPE_B
```

Every request and event is tagged with `X-Auth-Tenant`. Events without a tenant context belong to a reserved `_platform` pseudo-tenant to ensure isolation.

## Observability Pipeline

Observability is infrastructure-owned. Services do not carry OpenTelemetry SDKs; instead, runtime auto-instrumentation attaches at deployment.

```mermaid
flowchart LR
    subgraph Workloads
        J["Java Service<br/>(OTel Java Agent)"]
        P["Python Service<br/>(opentelemetry-instrument)"]
    end
    
    COL[OTel Collector]
    
    subgraph Backends
        TEMPO["Tempo (Traces)"]
        LOKI["Loki (Logs)"]
        PROM["Prometheus (Metrics)"]
    end
    
    GRAF["Grafana (Dashboards)"]

    J -->|"OTLP"| COL
    P -->|"OTLP"| COL
    J -. "Micrometer /actuator/prometheus" .-> PROM
    
    COL --> TEMPO
    COL --> LOKI
    COL --> PROM
    
    TEMPO --> GRAF
    LOKI --> GRAF
    PROM --> GRAF
```

This ensures zero instrumentation drift between the application code and the telemetry collected.

## Deployment Architecture

Labs64.IO provides flexibility from local testing to production deployments.

```mermaid
flowchart TB
    subgraph Local Evaluation
        DC[Docker Compose] -->|Runs| M1[Single Module + DB]
    end
    
    subgraph Kubernetes Development
        K3D[k3d Cluster] -->|Helm Deploy| E1[Full Ecosystem]
    end
    
    subgraph Production
        EKS[AWS EKS / BYO K8s] -->|Helm Deploy| E2[Full Ecosystem High Availability]
        E2 --> AWS_RDS[(AWS RDS)]
        E2 --> AWS_MQ[(Amazon MQ)]
    end
```

See **[Get Started](../getting-started/index.md)** for deployment instructions and **[Operate & Manage](../operate-manage/index.md)** for the production operating model.
