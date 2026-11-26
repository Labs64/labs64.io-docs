---
title: openapi-spring-boot-starter
parent: Shared Libraries (Commons)
grand_parent: Community & Contributing
nav_order: 3
---

# Labs64.IO OpenAPI Spring Boot Starter

Shared runtime OpenAPI and Swagger UI configuration for Labs64.IO servlet applications.

## Configuration

```yaml
labs64:
  openapi:
    spec-location: classpath:openapi/openapi-service-v1.yaml
    gateway-path: /service/api/v1
    local-path: /
    security:
      enabled: true
      scheme-name: bearerAuth
```

The starter configures the runtime server list, bearer security scheme and API metadata exposed by springdoc. API metadata is read from the `info` section of the configured canonical OpenAPI document.
