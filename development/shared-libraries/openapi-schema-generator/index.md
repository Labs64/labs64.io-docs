---
title: openapi-schema-generator
parent: Shared Libraries (Commons)
grand_parent: Community & Contributing
nav_order: 2
---

# Labs64.IO OpenAPI Schema Generator

Generates portable JSON Schema 2020-12 documents from an OpenAPI 3.1 contract.
It is module-neutral: Payment Gateway, Checkout, AuditFlow, and future modules
use the same generator and conventions.

OpenAPI is the only source of truth. Generated schemas are manually reviewed
and committed to the separate [`Labs64/labs64.io`](https://github.com/Labs64/labs64.io)
repository; module repositories do not store generated schema files.

## OpenAPI contract marker

A component is a portable contract when it declares
`properties.$schema.const`:

```yaml
Payment:
  type: object
  required:
    - $schema
  properties:
    $schema:
      type: string
      format: uri
      readOnly: true
      const: https://labs64.io/schemas/payment-gateway/Payment/1.0.1.json
      default: https://labs64.io/schemas/payment-gateway/Payment/1.0.1.json
  x-labs64:
    schema:
      object: Payment
      version: 2.0.0
```

The canonical URI format is:

```text
https://labs64.io/schemas/{module}/{object}/{schemaRevision}.json
```

The schema revision comes exclusively from `$schema.const`. It versions the
published JSON Schema document and is independent of
`x-labs64.schema.version`, which versions the represented object contract.
`default` must equal `const` so generated Java DTOs initialize the field.

The generator validates the `$schema` property, derives the destination path
from its URI, adds the JSON Schema dialect and `$id`, preserves `x-labs64`, and
resolves OpenAPI component references. References to other portable contracts
become canonical URLs; internal component schemas are embedded under `$defs`.

## Build and run

Build the standalone CLI:

```bash
mvn -B -ntp clean package
```

Generate directly into a local checkout of `Labs64/labs64.io`:

```bash
java -jar target/openapi-schema-generator-0.0.0-SNAPSHOT.jar \
  --input ../labs64.io-payment-gateway/payment-gateway-api/src/main/resources/openapi/openapi-payment-gateway-v1.yaml \
  --output-root ../labs64.io
```

This creates paths such as:

```text
../labs64.io/schemas/payment-gateway/Payment/1.0.1.json
```

Use `--dry-run` to validate and preview without writing. `--yes` skips the
creation confirmation but never authorizes an overwrite. `--force-overwrite`
is available for an explicitly unpublished revision.

Module repositories should expose a short wrapper:

```bash
just schemas-generate /path/to/labs64.io
just schemas-dry-run /path/to/labs64.io
```

## Safety behavior

- The output root must already exist; the generator only creates `schemas/...`
  beneath it.
- All contracts are validated and rendered before any write starts.
- New files require confirmation and are written using a temporary file plus
  rename.
- Identical files are reported as `UNCHANGED`.
- Different content at an existing revision is reported as `CONFLICT`.
- Interactive overwrite requires typing the exact module/object/revision.
- If a destination changes after the plan is displayed, the entire write is
  aborted before any file is changed.
- OpenAPI is never modified by the generator.

After generation, review and commit the files manually in `Labs64/labs64.io`:

```bash
cd /path/to/labs64.io
git diff -- schemas/
```
