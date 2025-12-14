# AuditFlow Sink Configuration Examples

Complete configuration examples for all available sinks.

## Table of Contents

- [Logging & Monitoring](#logging--monitoring)
- [Webhooks & Integration](#webhooks--integration)
- [AWS Services](#aws-services)
- [Google Cloud](#google-cloud)
- [Azure](#azure)
- [Complete Multi-Sink Setup](#complete-multi-sink-setup)

---

## Logging & Monitoring

### Syslog Server

Send audit events to your centralized Syslog server.

```yaml
pipelines:
  - name: 'syslog-production'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'syslog_sink'
      properties:
        host: "syslog.internal.company.com"
        port: "514"
        protocol: "udp"
        facility: "LOCAL0"
        severity: "INFO"
        tag: "auditflow-prod"
        format: "json"
```

### Syslog with CEF Format (Security Tools)

For integration with SIEM tools that expect CEF format.

```yaml
pipelines:
  - name: 'syslog-siem'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'syslog_sink'
      properties:
        host: "splunk-syslog.company.com"
        port: "514"
        protocol: "tcp"
        facility: "AUTH"
        severity: "NOTICE"
        tag: "auditflow"
        format: "cef"
```

### Console Logging (Development)

```yaml
pipelines:
  - name: 'dev-logs'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'logging_sink'
      properties:
        log-level: "DEBUG"
        format: "json"
```

---

## Webhooks & Integration

### Zapier Webhook

Send events to Zapier for automation.

```yaml
pipelines:
  - name: 'zapier-integration'
    enabled: true
    transformer:
      name: 'audit_zapier'
    sink:
      name: 'webhook_sink'
      properties:
        webhook-url: "https://hooks.zapier.com/hooks/catch/123456/abcdef/"
        method: "POST"
        content-type: "application/json"
        timeout: "30"
        retry-count: "3"
```

### Webhook with HMAC Signature (Secure)

```yaml
pipelines:
  - name: 'secure-webhook'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'webhook_sink'
      properties:
        webhook-url: "https://api.example.com/webhooks/audit"
        method: "POST"
        content-type: "application/json"
        secret: "${WEBHOOK_SECRET}"
        signature-header: "X-Hub-Signature-256"
        headers: '{"Authorization": "Bearer ${API_TOKEN}"}'
        verify-ssl: "true"
        retry-count: "5"
```

### Make.com (Integromat)

```yaml
pipelines:
  - name: 'make-integration'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'webhook_sink'
      properties:
        webhook-url: "https://hook.eu1.make.com/abcd1234xyz"
        method: "POST"
        content-type: "application/json"
```

### n8n Automation

```yaml
pipelines:
  - name: 'n8n-workflow'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'webhook_sink'
      properties:
        webhook-url: "https://n8n.company.com/webhook/audit"
        method: "POST"
        content-type: "application/json"
        verify-ssl: "true"
```

---

## AWS Services

### AWS S3 - Simple Storage

Store raw audit events in S3 for long-term retention.

```yaml
pipelines:
  - name: 's3-archive'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_s3_sink'
      properties:
        bucket: "company-audit-logs"
        prefix: "auditflow/"
        region: "us-east-1"
        compress: "true"
        partition-by-date: "true"
        partition-format: "year=%Y/month=%m/day=%d/"
```

### AWS S3 - With Credentials

```yaml
pipelines:
  - name: 's3-with-creds'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_s3_sink'
      properties:
        bucket: "audit-bucket"
        prefix: "production/"
        region: "eu-west-1"
        access-key-id: "${AWS_ACCESS_KEY_ID}"
        secret-access-key: "${AWS_SECRET_ACCESS_KEY}"
        compress: "true"
```

### AWS S3 - Custom Partitioning

```yaml
pipelines:
  - name: 's3-custom-partition'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_s3_sink'
      properties:
        bucket: "audit-logs"
        prefix: "events/"
        region: "us-west-2"
        partition-by-date: "true"
        partition-format: "env=prod/year=%Y/month=%m/day=%d/hour=%H/"
        compress: "true"
```

### AWS CloudWatch Logs

Send events to CloudWatch for real-time monitoring.

```yaml
pipelines:
  - name: 'cloudwatch-prod'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/production"
        log-stream: "app-events"
        region: "us-east-1"
        create-log-group: "true"
        create-log-stream: "true"
```

### AWS CloudTrail Lake

Send events to CloudTrail Lake for compliance and auditing.

```yaml
pipelines:
  - name: 'cloudtrail-compliance'
    enabled: true
    transformer:
      name: 'audit_cloudtrail'
    sink:
      name: 'aws_cloudtrail_sink'
      properties:
        channel-arn: "arn:aws:cloudtrail:us-east-1:123456789012:channel/audit-channel"
        region: "us-east-1"
```

---

## Google Cloud

### Google Cloud Storage - Basic

```yaml
pipelines:
  - name: 'gcs-archive'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'gcs_sink'
      properties:
        bucket: "company-audit-logs"
        prefix: "auditflow/"
        project-id: "my-gcp-project"
        compress: "true"
        partition-by-date: "true"
```

### Google Cloud Storage - With Service Account

```yaml
pipelines:
  - name: 'gcs-with-sa'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'gcs_sink'
      properties:
        bucket: "audit-bucket"
        prefix: "production/"
        credentials-file: "/etc/gcp/service-account.json"
        compress: "true"
        partition-by-date: "true"
        partition-format: "dt=%Y-%m-%d/"
```

---

## Azure

### Azure Blob Storage - Connection String

```yaml
pipelines:
  - name: 'azure-archive'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'azure_blob_sink'
      properties:
        container: "audit-logs"
        connection-string: "${AZURE_STORAGE_CONNECTION_STRING}"
        prefix: "auditflow/"
        compress: "true"
        partition-by-date: "true"
```

### Azure Blob Storage - Account Key

```yaml
pipelines:
  - name: 'azure-with-key'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'azure_blob_sink'
      properties:
        container: "production-logs"
        account-name: "mycompanyaudit"
        account-key: "${AZURE_STORAGE_KEY}"
        prefix: "events/"
        compress: "true"
```

---

## Complete Multi-Sink Setup

### Production-Ready Configuration

Send audit events to multiple destinations simultaneously.

```yaml
sink:
  discovery:
    mode: kubernetes
  service:
    name: auditflow-sink
    namespace: labs64io
    port: 8082

pipelines:
  # Real-time monitoring
  - name: 'cloudwatch-realtime'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/production"
        log-stream: "events"
        region: "us-east-1"

  # Long-term S3 archive
  - name: 's3-archive'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_s3_sink'
      properties:
        bucket: "company-audit-archive"
        prefix: "auditflow/"
        region: "us-east-1"
        compress: "true"
        partition-by-date: "true"

  # Compliance (CloudTrail Lake)
  - name: 'cloudtrail-compliance'
    enabled: true
    transformer:
      name: 'audit_cloudtrail'
    sink:
      name: 'aws_cloudtrail_sink'
      properties:
        channel-arn: "${CLOUDTRAIL_CHANNEL_ARN}"
        region: "us-east-1"

  # SIEM Integration
  - name: 'siem-syslog'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'syslog_sink'
      properties:
        host: "splunk.company.com"
        port: "514"
        protocol: "tcp"
        facility: "AUTH"
        severity: "INFO"
        format: "cef"

  # Alerting & Automation
  - name: 'zapier-alerts'
    enabled: true
    transformer:
      name: 'audit_zapier'
    sink:
      name: 'webhook_sink'
      properties:
        webhook-url: "${ZAPIER_WEBHOOK_URL}"
        method: "POST"
        secret: "${ZAPIER_SECRET}"

  # OpenSearch for search & analytics
  - name: 'opensearch-analytics'
    enabled: true
    transformer:
      name: 'audit_opensearch'
    sink:
      name: 'opensearch_sink'
      properties:
        service-url: "https://opensearch.company.com:9200"
        service-path: "/audit/_doc"
        username: "${OPENSEARCH_USER}"
        password: "${OPENSEARCH_PASSWORD}"
```

---

## Environment-Specific Configurations

### Development

```yaml
pipelines:
  - name: 'dev-console'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'logging_sink'
      properties:
        log-level: "DEBUG"
        format: "json"
```

### Staging

```yaml
pipelines:
  - name: 'staging-s3'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_s3_sink'
      properties:
        bucket: "staging-audit-logs"
        prefix: "auditflow/"
        region: "us-east-1"
  
  - name: 'staging-webhook'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'webhook_sink'
      properties:
        webhook-url: "${STAGING_WEBHOOK_URL}"
```

### Production

See "Complete Multi-Sink Setup" above.

---

## Tips & Best Practices

### 1. Use Environment Variables

```yaml
properties:
  password: "${OPENSEARCH_PASSWORD}"
  api-key: "${API_KEY}"
```

### 2. Enable Compression for Cloud Storage

```yaml
properties:
  compress: "true"  # Saves storage costs
```

### 3. Partition by Date

```yaml
properties:
  partition-by-date: "true"
  partition-format: "year=%Y/month=%m/day=%d/"
```

### 4. Multiple Sinks for Redundancy

Configure multiple sinks to ensure events are captured even if one fails.

### 5. Transform Before Sending

Use transformers to format events for specific destinations:
- `audit_opensearch` - OpenSearch format
- `audit_loki` - Loki format
- `audit_cloudtrail` - CloudTrail format
- `audit_zapier` - Zapier-friendly format

---

## Testing Sinks

```bash
# Test webhook sink
curl -X POST "http://localhost:8082/sink/webhook_sink" \
  -H "Content-Type: application/json" \
  -d '{
    "event_data": {"meta": {"eventType": "test"}},
    "properties": {
      "webhook-url": "https://webhook.site/unique-id"
    }
  }'

# Test S3 sink
curl -X POST "http://localhost:8082/sink/aws_s3_sink" \
  -H "Content-Type: application/json" \
  -d '{
    "event_data": {"meta": {"eventType": "test"}},
    "properties": {
      "bucket": "my-test-bucket",
      "region": "us-east-1"
    }
  }'
```
