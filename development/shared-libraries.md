---
title: Shared Libraries (Commons)
parent: Community & Contributing
nav_order: 3
---

# Shared Libraries (Commons)

Every Labs64.IO service is built on the same Java and Python libraries and one build parent. They live in the [`labs64.io-commons`](https://github.com/Labs64/labs64.io-commons) repository. Services that each re-implement tenant headers, OpenAPI metadata and authorization plumbing drift apart, and the differences are where bugs and security holes live; Commons is that plumbing, written and tested once.

Use this page when you build a service that sits behind the [Auth Gateway](../modules/auth-gateway/index.md) and want it to treat identity exactly as the rest of the platform does. If your services are not behind the Labs64.IO gateway, these libraries are not for you: the auth-context libraries assume its header contract.

## What is in the box

| Library | Language | What it gives you |
|---|---|---|
| `labs64io-parent` | Maven POM | The build parent: Spring Boot line, security overrides, shared versions and release rules in one version |
| `auth-context-core` | Java 17+ | The identity model, holder and trusted-header parser, with no dependencies |
| `auth-context-spring-boot-starter` | Java 17+ / Spring Boot 4 | Fail-closed header enforcement (a request to a non-public path without the headers is rejected), `@RequireTenant`, `@RequireScopes` and `@Authorize`, outbound propagation and `@WithAuthContext` for tests |
| `auth-context-python` | Python 3.13+ | The same contract for ASGI and FastAPI services, with an httpx hook and pytest fixture |
| `openapi-spring-boot-starter` | Java 17+ / Spring Boot 4 | Shared springdoc servers, bearer security and canonical OpenAPI metadata |
| `openapi-schema-generator` | Java 17+ | Versioned JSON Schema documents from OpenAPI 3.1 |
| `authz-queryplan-jpa` | Java 17+ / Spring Boot 4 | Turns a Cerbos query plan into a Spring Data JPA `Specification` (Data PEP), so a list query returns only the rows the policy allows |
| `auth-policy-cerbos` | Shell + OpenAPI | The toolkit that derives the central policy engine's policies from your contract and checks their decisions |

The Java and Python implementations are pinned to identical behaviour by the shared vectors in `test-vectors/`.

```text
  labs64io-parent        Spring Boot line · shared versions · release rules
        │ inherited by every Java service
        ├── auth-context-core · auth-context-spring-boot-starter
        ├── openapi-spring-boot-starter · openapi-schema-generator
        └── authz-queryplan-jpa (Data PEP)

  auth-context-python    the same X-Auth-* contract for Python services
  auth-policy-cerbos     OpenAPI ──► Cerbos policies + route manifests
```

## The trusted header contract

Modules never parse a token. The gateway authenticates the caller and sets four headers, and the libraries read them the same way in Java and in Python:

| Header | Meaning |
|---|---|
| `X-Auth-User` | The subject, or `svc:<client>` for a service principal |
| `X-Auth-Scopes` | Comma-separated scopes |
| `X-Auth-Tenant` | The tenant, or `-` when the caller is tenant-less |
| `X-Request-ID` | The caller's id when well-formed, otherwise a generated UUIDv7 |

Values are validated against `^[a-zA-Z0-9_.:-]+$`. The test vectors are the specification: a change to a parser must keep them green in both languages.

## Use the libraries in a Java service

Releases that maintainers promote to [Maven Central](https://central.sonatype.com/namespace/io.labs64) under `io.labs64` need no repository configuration. A service inherits `labs64io-parent`. That one version pins the Spring Boot line, the shared third-party versions **and** every commons library, so the libraries themselves are declared without a version:

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
```

Pin a **released** version. `0.0.0-SNAPSHOT` is what `master` builds as, and a release build refuses it. Never re-pin Spring Boot or a shared dependency version in a service; change `labs64io-parent` once and every service inherits it. The parent compiles for Java 25 and its build fails on an older JDK; the libraries themselves run on Java 17 and later.

## Use the Python library

```bash
pip install "auth-context-python @ git+https://github.com/Labs64/labs64.io-commons.git@COMMIT_OR_TAG#subdirectory=auth-context-python"
```

## Authorization from the OpenAPI contract

A service declares the access rules of each operation in its OpenAPI document:

```yaml
paths:
  /payments/{paymentId}/pay:
    post:
      operationId: payPayment
      x-labs64:
        auth:
          tenant: true
          scopes:
            - payment:pay
          resourceType: Payment    # optional: adds a resource-level check
          resource: "#paymentId"   # optional: the resource reference for @Authorize
```

An `x-labs64` block on the path applies to every operation under it, and an operation-level block overrides it. An operation that requires no tenant, no scope and no resource type is public. The build does not read the standard OpenAPI `security` block.

From this one block the build generates three outputs:

| Output | Used by |
|---|---|
| `@RequireTenant`, `@RequireScopes` and `@Authorize` on the generated server interface, or `@PublicEndpoint` for a public operation | The service, which enforces them at runtime |
| Cerbos policies | The central policy decision point |
| A routes manifest `<module>.routes.yaml` | The [Auth Gateway](../modules/auth-gateway/index.md), which maps each request to an operation |

The generator is `OpenApiAuthPreprocessorCli` in `auth-context-spring-boot-starter`. To run it by hand, for example to inspect the generated policies and routes of a contract:

```bash
just install-java
cd auth-context-java/auth-context-spring-boot-starter
mvn -q exec:java \
  -Dexec.mainClass=io.labs64.authcontext.openapi.OpenApiAuthPreprocessorCli \
  -Dexec.args="--input openapi.yaml --openapi-output target/generated/openapi.yaml --cerbos-output target/cerbos --routes-output target/routes.yaml --module <module>"
```

## Build and test the libraries

Only Docker is needed to build every library inside a Maven container, with no JDK on your machine:

```bash
git clone https://github.com/Labs64/labs64.io-commons.git && cd labs64.io-commons
docker run --rm -v "$PWD":/src -w /src maven:3.9-eclipse-temurin-25 \
  mvn -B -DskipTests package
```

Drop `-DskipTests` to run the Java tests. To work on the code, install JDK 25 and Maven 3.6.3+ (Python 3.13 for the Python library):

```bash
mvn -B verify                                                   # build and test every Java library
cd auth-context-python && pip install -e . pytest && pytest     # the Python library
```

With `just`, from the repository root:

```bash
just build                                   # build and test everything, install the Java libraries locally
just java                                    # test the Java libraries
just java-module openapi-spring-boot-starter # one library and the modules it depends on
just python                                  # test the Python library
just install-java                            # install all Java libraries locally as 0.0.0-SNAPSHOT
just cerbos                                  # check the generated Cerbos policies against their truth table
```

A change to a shared library reaches every service, so tests (and, for the header contract, the shared test vectors) are not optional. The repository's `AGENTS.md` describes the layout and the release rules, and its [`docs/reference.md`](https://github.com/Labs64/labs64.io-commons/blob/master/docs/reference.md) covers the release process and OpenAPI auth-policy generation in full. [Auth context integration](https://github.com/Labs64/labs64.io-commons/blob/master/auth-context-java/INTEGRATION.md) explains how a service adopts the header contract, and shows the Maven configuration that runs the generator and the runtime settings of the starter. Releases follow the [common release model](./releases.md): every Java library in this repository shares one version and releases together.

## Next steps

| You want to… | Go to |
|---|---|
| Understand what sets the trusted headers | [Auth Gateway](../modules/auth-gateway/index.md) |
| Change a library and open a pull request | [Contributing guide](./contributing.md) |
