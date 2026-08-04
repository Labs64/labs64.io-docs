---
title: Security & Compliance
parent: Operate & Manage
nav_order: 7
---

# Security & Compliance

Security is a deployment responsibility shared by the platform operator and every service integration. Apply least privilege at the edge, in the cluster, and at each external dependency.

## Baseline controls

| Area | Baseline |
|---|---|
| Identity | Validate issuer and signing keys; use short-lived tokens where your identity system supports them |
| Authorization | Maintain Cerbos policies as reviewed, versioned policy-as-code |
| Secrets | Store credentials outside source control; rotate them on a defined schedule |
| Network | Restrict ingress and egress with Gateway rules and NetworkPolicies |
| Data | Encrypt transit and storage; define retention and deletion responsibilities |
| Audit | Preserve relevant access and business events in protected, searchable sinks |
| Webhooks | Verify provider authenticity before accepting a state change |

## Before you go live

- Confirm no public route bypasses the intended authentication and authorization policy.
- Verify upstream services trust identity headers only from the gateway.
- Test an expired token, invalid tenant, forbidden action, and unauthenticated request.
- Confirm payment and other external webhooks verify signatures or equivalent authenticity evidence.
- Test restoration of each stateful store and protect backups with the same sensitivity as live data.
- Review the people and systems with access to audit sinks, logs, and production secrets.

Compliance obligations depend on your industry, jurisdictions, and the data you process. Use this checklist as an engineering baseline, then add the controls your organization requires.
