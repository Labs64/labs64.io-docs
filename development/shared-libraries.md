---
title: Shared libraries
parent: Community & Contributing
nav_order: 5
---

# Shared libraries

[labs64.io-commons](https://github.com/Labs64/labs64.io-commons) holds the libraries every service uses to take part in the platform's identity and contract model, and the build parent of every Java service.

| Library | Language | Purpose |
|---|---|---|
| `labs64io-parent` | Maven POM | Build parent: the Spring Boot line, security overrides, shared dependency and plugin versions, the commons library versions and the release rules |
| `auth-context-core` | Java 17+ | Dependency-free identity-context model, holder and trusted-header parser |
| `auth-context-spring-boot-starter` | Java 17+, Spring Boot 4 | Parses the gateway's `X-Auth-*` headers, enforces them fail-closed, provides `@RequireScopes`, `@RequireTenant` and `@Authorize`, propagates the context on outbound calls, and `@WithAuthContext` for tests |
| `authz-queryplan-jpa` | Java 17+, Spring Boot 4 | Turns a Cerbos query plan into a Spring Data JPA `Specification`, so list queries return only what the policy allows |
| `openapi-spring-boot-starter` | Java 17+, Spring Boot 4 | Shared springdoc configuration: servers, bearer security, metadata |
| `openapi-schema-generator` | Java 17+ | Extracts versioned JSON Schema documents from an OpenAPI 3.1 contract |
| `auth-context-python` | Python 3.13+ | The same identity context for Python: ASGI middleware, FastAPI dependencies, an httpx propagation hook, a pytest fixture |

The Java and Python identity-context libraries behave identically. The tests of both run against the shared vectors in `test-vectors/`. `auth-policy-cerbos/` holds the tooling that generates and validates the Cerbos policies.

## Use them

**Java.** Inherit the parent. It pins every commons library, so declare them without a version:

```xml
<parent>
    <groupId>io.labs64</groupId>
    <artifactId>labs64io-parent</artifactId>
    <version>X.Y.Z</version>
    <relativePath />
</parent>

<dependencies>
    <dependency>
        <groupId>io.labs64</groupId>
        <artifactId>auth-context-spring-boot-starter</artifactId>
    </dependency>
</dependencies>

<repositories>
    <repository>
        <id>labs64-nexus</id>
        <url>https://nexus.labs64.com/repository/labs64.io-releases/</url>
    </repository>
</repositories>
```

Pin a released version. `0.0.0-SNAPSHOT` is the unreleased main branch. Use it only while developing against unreleased commons changes, because a release build refuses it.

**Python.**

```bash
pip install "auth-context-python @ git+https://github.com/Labs64/labs64.io-commons.git@<tag>#subdirectory=auth-context-python"
```

## Authorization from the OpenAPI contract

A service declares access rules per operation in its OpenAPI document:

```yaml
paths:
  /payments:
    get:
      operationId: listPayments
      x-labs64:
        auth:
          tenant: true
          scopes:
            - payment:read
          resourceType: Payment      # optional: enables resource-level checks
```

From this one block the build generates:

| Output | Used by |
|---|---|
| `@RequireScopes`, `@RequireTenant`, `@Authorize` on the generated server interface; `@PublicEndpoint` when there is no `x-labs64.auth` | The service (domain enforcement) |
| Cerbos policies (`--cerbos-output`) | The central policy decision point |
| A routes manifest `<module>.routes.yaml` (`--routes-output`) | The [Auth Gateway](../modules/auth-gateway/index.md) |

`x-labs64.auth.resource` can name the resource for `@Authorize`, as a SpEL reference such as `#paymentId`. Authorization does not use the standard OpenAPI `security` block.

## Build them

```bash
just build                               # build and test everything
just java                                # Java only
just java-module authz-queryplan-jpa     # one library and what it depends on
just python                              # Python only
just install-java                        # install all Java artefacts as 0.0.0-SNAPSHOT locally
```

Releases follow the [common release model](./releases.md): every Java artefact in this repository shares one version and releases together.
