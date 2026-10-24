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
| `auth-context-spring-boot-starter` | Java 17+ / Spring Boot 4 | Fail-closed header enforcement, `@RequireScopes`, outbound propagation and test support |
| `auth-context-python` | Python 3.13+ | The same contract for ASGI and FastAPI services, with an httpx hook and pytest fixture |
| `openapi-spring-boot-starter` | Java 17+ / Spring Boot 4 | Shared springdoc servers, bearer security and canonical OpenAPI metadata |
| `openapi-schema-generator` | Java 17+ | Versioned JSON Schema documents from OpenAPI 3.1 |
| `authz-queryplan-jpa` | Java 17+ / Spring Boot 4 | Turns a Cerbos query plan into a Spring Data JPA `Specification` (Data PEP) |
| `auth-policy-cerbos` | Shell + OpenAPI | The toolkit that derives the central policy engine's policies from your contract |

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

Stable releases are published to Maven Central under `io.labs64`; no repository configuration is needed. A service inherits `labs64io-parent`. That one version pins the Spring Boot line, the shared third-party versions **and** every commons library, so the libraries themselves are declared without a version:

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

Pin a **released** version. `0.0.0-SNAPSHOT` is what `master` builds as, and a release build refuses it. Never re-pin Spring Boot or a shared dependency version in a service; change `labs64io-parent` once and every service inherits it.

## Use the Python library

```bash
pip install "auth-context-python @ git+https://github.com/Labs64/labs64.io-commons.git@COMMIT_OR_TAG#subdirectory=auth-context-python"
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

A change to a shared library reaches every service, so tests (and, for the header contract, the shared test vectors) are not optional. The repository's `AGENTS.md` describes the layout and the release rules, and its [`docs/reference.md`](https://github.com/Labs64/labs64.io-commons/blob/master/docs/reference.md) covers the release process and OpenAPI auth-policy generation in full. [Auth context integration](https://github.com/Labs64/labs64.io-commons/blob/master/auth-context-java/INTEGRATION.md) explains how a service adopts the header contract.

## Next steps

| You want to… | Go to |
|---|---|
| Understand what sets the trusted headers | [Auth Gateway](../modules/auth-gateway/index.md) |
| Change a library and open a pull request | [Contributing guide](./contributing.md) |
