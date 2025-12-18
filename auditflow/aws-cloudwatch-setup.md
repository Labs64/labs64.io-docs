# AWS CloudWatch Logs Setup Guide for AuditFlow

Complete guide for setting up AWS CloudWatch Logs as a sink destination for AuditFlow audit events.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Setup Options](#setup-options)
  - [Option 1: Same AWS Account](#option-1-same-aws-account)
  - [Option 2: Cross-Account Access](#option-2-cross-account-access)
  - [Option 3: AWS Organizations](#option-3-aws-organizations)
- [Configuration Examples](#configuration-examples)
- [IAM Permissions](#iam-permissions)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The AWS CloudWatch Logs sink sends audit events to CloudWatch Logs for:
- Real-time monitoring and alerting
- Centralized log aggregation
- Integration with AWS services (Lambda, CloudWatch Insights, etc.)
- Compliance and audit trail requirements

## Prerequisites

1. **AWS Account** with CloudWatch Logs access
2. **IAM Permissions** to create/write to log groups and streams
3. **AWS Credentials** configured (IAM role, access keys, or instance profile)
4. **Python boto3 library** installed in the sink service

Install boto3:
```bash
pip install boto3
```

---

## Setup Options

### Option 1: Same AWS Account

Use when AuditFlow runs in the same AWS account where you want to store logs.

#### Step 1: Create Log Group (Optional)

The sink can auto-create log groups, but for production it's recommended to create them manually:

```bash
# Using AWS CLI
aws logs create-log-group \
  --log-group-name /aws/auditflow/production \
  --region us-east-1

# Add retention policy (optional)
aws logs put-retention-policy \
  --log-group-name /aws/auditflow/production \
  --retention-in-days 30 \
  --region us-east-1

# Add tags
aws logs tag-log-group \
  --log-group-name /aws/auditflow/production \
  --tags Environment=production,Application=auditflow \
  --region us-east-1
```

#### Step 2: Create IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CloudWatchLogsAccess",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:us-east-1:ACCOUNT-ID:log-group:/aws/auditflow/*"
      ]
    }
  ]
}
```

#### Step 3: Configure AuditFlow Sink

**Using IAM Role (Recommended for EKS/EC2):**

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
        create-log-group: "false"  # Already created
        create-log-stream: "true"
```

**Using Access Keys:**

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
        access-key-id: "${AWS_ACCESS_KEY_ID}"
        secret-access-key: "${AWS_SECRET_ACCESS_KEY}"
        create-log-group: "false"
        create-log-stream: "true"
```

---

### Option 2: Cross-Account Access

Use when AuditFlow runs in one AWS account but needs to send logs to another account.

**Scenario:** 
- Source Account: `111111111111` (where AuditFlow runs)
- Target Account: `222222222222` (where logs are stored)

#### Step 1: Create Log Group in Target Account

```bash
# Login to target account (222222222222)
aws logs create-log-group \
  --log-group-name /aws/auditflow/production \
  --region us-east-1
```

#### Step 2: Create IAM Role in Target Account

Create role `AuditFlowCloudWatchRole` with this trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::111111111111:root"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "StringEquals": {
          "sts:ExternalId": "auditflow-unique-id"
        }
      }
    }
  ]
}
```

#### Step 3: Attach Policy to Role in Target Account

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:us-east-1:222222222222:log-group:/aws/auditflow/production:*"
      ]
    }
  ]
}
```

#### Step 4: Create IAM Policy in Source Account

Allow the source account's IAM role/user to assume the target role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::222222222222:role/AuditFlowCloudWatchRole"
    }
  ]
}
```

#### Step 5: Configure Application to Use AssumeRole

**For EKS with IRSA (IAM Roles for Service Accounts):**

1. Create service account with assume role annotation:
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: auditflow-sink
  namespace: labs64io
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::111111111111:role/AuditFlowSourceRole
```

2. Update deployment to use the service account:
```yaml
spec:
  serviceAccountName: auditflow-sink
```

**Note:** The boto3 SDK will automatically handle the cross-account role assumption if configured properly. You may need to update the sink code to explicitly assume the role.

---

### Option 3: AWS Organizations

Use when you have multiple accounts in an AWS Organization and want centralized logging.

#### Architecture

```
AWS Organization
├── Management Account (123456789012)
├── Security/Logging Account (999999999999) ← Store all logs here
├── Production Account (111111111111) ← AuditFlow runs here
└── Development Account (222222222222)
```

#### Step 1: Create Log Group in Logging Account

```bash
# In Security/Logging account (999999999999)
aws logs create-log-group \
  --log-group-name /aws/auditflow/production \
  --region us-east-1

aws logs put-retention-policy \
  --log-group-name /aws/auditflow/production \
  --retention-in-days 365 \
  --region us-east-1
```

#### Step 2: Create Cross-Account IAM Role

In the Logging Account (999999999999):

**Trust Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": [
          "arn:aws:iam::111111111111:root",
          "arn:aws:iam::222222222222:root"
        ]
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

**Permissions Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": [
        "arn:aws:logs:us-east-1:999999999999:log-group:/aws/auditflow/*"
      ]
    }
  ]
}
```

#### Step 3: Configure Each Application Account

In each account where AuditFlow runs (production, development):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::999999999999:role/AuditFlowCentralLoggingRole"
    }
  ]
}
```

#### Step 4: AuditFlow Configuration

```yaml
pipelines:
  - name: 'cloudwatch-central'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/production"
        log-stream: "account-${ACCOUNT_ID}"
        region: "us-east-1"
        # Credentials will use IAM role with cross-account access
        create-log-group: "false"
        create-log-stream: "true"
```

---

## Configuration Examples

### Development Environment

```yaml
pipelines:
  - name: 'cloudwatch-dev'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/development"
        log-stream: "dev-events"
        region: "us-east-1"
        create-log-group: "true"
        create-log-stream: "true"
```

### Production with Multiple Streams

```yaml
pipelines:
  # API events
  - name: 'cloudwatch-api'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/production"
        log-stream: "api-events"
        region: "us-east-1"
        create-log-stream: "true"

  # Auth events
  - name: 'cloudwatch-auth'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/production"
        log-stream: "auth-events"
        region: "us-east-1"
        create-log-stream: "true"

  # Admin events
  - name: 'cloudwatch-admin'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/production"
        log-stream: "admin-events"
        region: "us-east-1"
        create-log-stream: "true"
```

### Multi-Region Setup

```yaml
pipelines:
  # US East
  - name: 'cloudwatch-us-east'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/production"
        log-stream: "us-east-1-events"
        region: "us-east-1"

  # EU West
  - name: 'cloudwatch-eu-west'
    enabled: true
    transformer:
      name: 'zero'
    sink:
      name: 'aws_cloudwatch_sink'
      properties:
        log-group: "/aws/auditflow/production"
        log-stream: "eu-west-1-events"
        region: "eu-west-1"
```

---

## IAM Permissions

### Minimum Permissions (Read/Write)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:PutLogEvents",
        "logs:CreateLogStream",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/auditflow/*:*"
    }
  ]
}
```

### Full Permissions (Create/Read/Write)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/auditflow/*"
    }
  ]
}
```

### EKS IRSA Service Account Annotation

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: auditflow-sink
  namespace: labs64io
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT-ID:role/AuditFlowCloudWatchRole
```

---

## Testing

### Test Log Group Creation

```bash
# Create test log group
aws logs create-log-group \
  --log-group-name /aws/auditflow/test \
  --region us-east-1

# Verify it exists
aws logs describe-log-groups \
  --log-group-name-prefix /aws/auditflow/test \
  --region us-east-1
```

### Test Log Stream Creation

```bash
# Create log stream
aws logs create-log-stream \
  --log-group-name /aws/auditflow/test \
  --log-stream-name test-stream \
  --region us-east-1

# Verify it exists
aws logs describe-log-streams \
  --log-group-name /aws/auditflow/test \
  --log-stream-name-prefix test-stream \
  --region us-east-1
```

### Test Event Submission

```bash
# Send test event
aws logs put-log-events \
  --log-group-name /aws/auditflow/test \
  --log-stream-name test-stream \
  --log-events timestamp=$(date +%s%3N),message='{"test":"event"}' \
  --region us-east-1
```

### Test AuditFlow Sink

```bash
# Test the sink endpoint
curl -X POST "http://localhost:8082/sink/aws_cloudwatch_sink" \
  -H "Content-Type: application/json" \
  -d '{
    "event_data": {
      "eventType": "test",
      "timestamp": "2025-12-17T10:00:00Z",
      "message": "Test audit event"
    },
    "properties": {
      "log-group": "/aws/auditflow/test",
      "log-stream": "test-stream",
      "region": "us-east-1",
      "create-log-group": "false",
      "create-log-stream": "false"
    }
  }'
```

### Query Logs

```bash
# Get recent log events
aws logs get-log-events \
  --log-group-name /aws/auditflow/test \
  --log-stream-name test-stream \
  --limit 10 \
  --region us-east-1

# Use CloudWatch Insights
aws logs start-query \
  --log-group-name /aws/auditflow/production \
  --start-time $(date -u -d '1 hour ago' +%s) \
  --end-time $(date -u +%s) \
  --query-string 'fields @timestamp, @message | sort @timestamp desc | limit 20' \
  --region us-east-1
```

---

## Troubleshooting

### Error: ResourceNotFoundException

**Problem:** Log group does not exist.

**Solution:**
1. Set `create-log-group: "true"` in configuration, OR
2. Manually create the log group:
   ```bash
   aws logs create-log-group --log-group-name /aws/auditflow/production --region us-east-1
   ```

### Error: AccessDeniedException

**Problem:** IAM permissions are insufficient.

**Solution:**
1. Verify IAM policy includes required actions
2. Check resource ARN matches log group name
3. For cross-account access, verify trust relationship and assume role permissions

### Error: InvalidSequenceTokenException

**Problem:** Concurrent writes to the same log stream.

**Solution:**
1. Use different log streams for different sources
2. The sink automatically handles sequence tokens - ensure you're not writing from multiple places

### Error: DataAlreadyAcceptedException

**Problem:** Event was already sent (duplicate).

**Solution:** This is informational - the event was successfully stored, just logged as duplicate.

### Verify IAM Role/Permissions

```bash
# Check current identity
aws sts get-caller-identity

# Test log group access
aws logs describe-log-groups \
  --log-group-name-prefix /aws/auditflow \
  --region us-east-1

# Simulate policy
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::ACCOUNT-ID:role/AuditFlowRole \
  --action-names logs:PutLogEvents \
  --resource-arns arn:aws:logs:us-east-1:ACCOUNT-ID:log-group:/aws/auditflow/production:*
```

### Debug Boto3 SDK

Add to sink configuration or container environment:

```bash
export AWS_SDK_LOGGING=debug
export BOTO_LOG_LEVEL=DEBUG
```

### Check Container/Pod IAM Role

**For EKS:**
```bash
# Check service account
kubectl get serviceaccount auditflow-sink -n labs64io -o yaml

# Check pod IAM role
kubectl describe pod <pod-name> -n labs64io | grep AWS_ROLE_ARN

# Exec into pod and test
kubectl exec -it <pod-name> -n labs64io -- sh
aws sts get-caller-identity
aws logs describe-log-groups --region us-east-1
```

---

## Best Practices

1. **Use IAM Roles** instead of access keys when possible
2. **Pre-create log groups** in production for better control
3. **Set retention policies** to manage costs:
   ```bash
   aws logs put-retention-policy --log-group-name /aws/auditflow/production --retention-in-days 90
   ```
4. **Use separate log groups** for different environments (dev/staging/prod)
5. **Enable log group encryption** using KMS:
   ```bash
   aws logs associate-kms-key --log-group-name /aws/auditflow/production --kms-key-id arn:aws:kms:region:account:key/key-id
   ```
6. **Monitor CloudWatch costs** - use log filtering and sampling for high-volume events
7. **Tag log groups** for cost allocation and management
8. **Use CloudWatch Insights** for querying and analysis instead of downloading logs

---

## Additional Resources

- [AWS CloudWatch Logs Documentation](https://docs.aws.amazon.com/cloudwatch/logs/)
- [IAM Roles for Service Accounts (IRSA)](https://docs.aws.amazon.com/eks/latest/userguide/iam-roles-for-service-accounts.html)
- [Cross-Account Access](https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html)
- [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/)
- [CloudWatch Logs API](https://docs.aws.amazon.com/AmazonCloudWatchLogs/latest/APIReference/)

