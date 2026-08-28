# Pawstia PMS — Production Operations Framework

> Status: Pre-Production Readiness Document
> Purpose: Define operational requirements before commercial launch.

## 1. Environments

Required environments:

- Development: local implementation and automated tests.
- Staging: production-like validation before release.
- Production: customer-facing SaaS environment.

Production changes must not bypass staging validation.

## 1.1 Verification Environment Safety

- Windows Docker Desktop is **not a mandatory verification dependency** for this product.
- Preferred database test runner is **GitHub Actions on an ephemeral Ubuntu runner**, so the container workload never touches the Windows PC.
- An **isolated Supabase cloud test/staging project** is the next layer for remote integration/E2E and deployment validation, with no production data.
- macOS local Supabase/Docker is an acceptable optional path when the Mac environment is available and stable.
- Never run reset/destructive migration tests against production.
- Test/staging credentials must be separate from production credentials.

## 2. Deployment Requirements

Before commercial launch:

- Versioned releases.
- Rollback procedure documented.
- Environment variables managed outside source control.
- Database migration process documented.
- Release owner identified.

## 3. Monitoring

Minimum production monitoring:

- Application errors.
- Database failures.
- LINE delivery failures.
- Google Sheets sync failures.
- Storage upload failures.
- Authentication failures.

Critical failures require an incident record.

## 4. Backup and Recovery

Required decisions before GA:

- Database backup frequency.
- Storage media backup strategy.
- Recovery testing schedule.
- Recovery Time Objective (RTO).
- Recovery Point Objective (RPO).

## 5. Incident Management

Severity levels:

- SEV-1: Customer operations unavailable or data integrity risk.
- SEV-2: Major feature degradation.
- SEV-3: Non-critical defect.

Each incident must record:

- Detection time.
- Impact.
- Root cause.
- Resolution.
- Preventive action.

## 6. Customer Support Operations

Before paid launch define:

- Support channels.
- Response targets.
- Escalation process.
- Customer communication templates.

## 7. Release Gate

Production launch requires completion of:

- Billing lifecycle.
- Terms and privacy final review.
- Brand decision.
- Monitoring setup.
- Backup and recovery validation.
- Support process.
