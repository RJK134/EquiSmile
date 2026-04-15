# EquiSmile UAT Plan

## 1. Scope

User Acceptance Testing (UAT) covers all business-critical workflows in the EquiSmile v1.0.0 release:

| Area | Test Cases | Priority |
|------|-----------|----------|
| Customer Management | TC-001 | P1 |
| Enquiry Intake | TC-002 | P1 |
| Triage Workflow | TC-003 | P1 |
| Route Planning | TC-004 | P1 |
| Booking & Confirmations | TC-005 | P1 |
| Mobile / PWA | TC-006 | P2 |
| Bilingual (EN/FR) | TC-007 | P1 |
| Error Handling | TC-008 | P2 |

## 2. Timeline

| Milestone | Target Date | Owner |
|-----------|------------|-------|
| UAT environment ready | Day 1 | Dev team |
| Seed data loaded | Day 1 | Dev team |
| Test execution begins | Day 2 | Testers |
| First pass complete | Day 5 | Testers |
| Defect triage | Day 6 | Dev + Business |
| Re-test fixes | Day 7–8 | Testers |
| Sign-off | Day 9 | Business owner |

## 3. Participants

| Role | Responsibility |
|------|---------------|
| **Business Owner** | Final sign-off, priority decisions |
| **UAT Testers** | Execute test cases, log defects |
| **Dev Team** | Fix defects, environment support |
| **QA Lead** | Coordinate testing, manage defect triage |

## 4. Environments

| Environment | URL | Purpose |
|-------------|-----|---------|
| UAT | `https://uat.equismile.example.com` | Primary testing |
| n8n (UAT) | `https://uat.equismile.example.com:5678` | Workflow verification |
| Database | PostgreSQL on UAT server | Seeded with test data |

### Environment Setup

1. Run `npm run validate-env` to verify all services
2. Run `npx prisma migrate deploy` to apply migrations
3. Run `npm run db:seed` to load UAT test data
4. Verify health check at `/api/health`

## 5. Entry Criteria

All of the following must be true before UAT begins:

- [ ] All Phase 0–8 code merged to release branch
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes
- [ ] `npm run validate-env` reports READY
- [ ] UAT environment deployed and accessible
- [ ] Seed data loaded successfully
- [ ] n8n workflows imported and active
- [ ] Test accounts and credentials distributed to testers

## 6. Exit Criteria

UAT is complete when:

- [ ] All P1 test cases pass
- [ ] All P2 test cases pass or have accepted workarounds
- [ ] No open critical or high-severity defects
- [ ] Business owner has signed off

## 7. Defect Management

### Severity Levels

| Severity | Definition | SLA |
|----------|-----------|-----|
| **Critical** | System unusable, data loss risk | Fix within 4 hours |
| **High** | Major feature broken, no workaround | Fix within 1 business day |
| **Medium** | Feature impaired, workaround exists | Fix before go-live |
| **Low** | Cosmetic, minor inconvenience | Fix in next release |

### Defect Workflow

1. Tester logs defect with: title, severity, steps to reproduce, expected vs actual, screenshots
2. QA Lead triages and assigns to developer
3. Developer fixes and marks ready for re-test
4. Tester re-tests and closes or re-opens

### Defect Template

```
Title: [Short description]
Severity: Critical / High / Medium / Low
Test Case: TC-XXX, Step X
Steps to Reproduce:
  1. ...
  2. ...
Expected Result: ...
Actual Result: ...
Screenshots: [attach]
Environment: UAT
Tester: [name]
Date: [YYYY-MM-DD]
```

## 8. Sign-Off Process

1. QA Lead prepares UAT summary report:
   - Total test cases: executed / passed / failed / blocked
   - Open defects by severity
   - Recommendation: go / no-go
2. Business owner reviews report
3. Business owner signs off (or requests additional fixes)

### Sign-Off Form

```
I, [Name], confirm that EquiSmile v1.0.0 has been tested and meets
the acceptance criteria for production release.

Signature: ___________________
Date: ___________________
```
