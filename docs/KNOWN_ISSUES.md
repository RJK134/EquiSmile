# EquiSmile Known Issues

## Active Issues

| ID | Phase | Severity | Description | Workaround |
|----|-------|----------|-------------|------------|
| KI-001 | 5 | Low | Google Maps API rate limiting may cause batch geocoding to fail for large batches (50+ yards) | Process in smaller batches of 10–20 |
| ~~KI-002~~ | ~~6~~ | ~~Low~~ | ~~Reminder scheduling depends on `POST /api/reminders/check` being called periodically — no built-in cron~~ | Resolved in Phase 12d |
| KI-003 | 7 | Low | PWA offline queue does not retry mutations in the original submission order if multiple were queued | Mutations are eventually consistent; order rarely matters for this app's use case |
| KI-004 | 3 | Medium | WhatsApp webhook verification requires the app to be publicly accessible — not possible in local dev | Use ngrok or similar tunnel for local WhatsApp testing |
| KI-005 | 4 | Low | Auto-triage confidence scores are heuristic-based and may misclassify edge cases | Manual override is available; triage tasks created for low-confidence classifications |
| KI-006 | 9 | Info | `/api/webhook/*` routes intentionally bypass session auth and stay behind the separate `N8N_API_KEY` check. This is by design — n8n calls these server-to-server without a browser session. | No action; enforced in `middleware.ts` via `PUBLIC_PATH_PATTERNS`. |

## v1.0.0 Retrospective Audit — AMBER items (2026-04-20)

Filed during the [Phase Verification Plan](./PHASE_VERIFICATION_PLAN.md) audit. See [V1_AUDIT_FINDINGS.md](./V1_AUDIT_FINDINGS.md) for the per-phase evidence tables.

| ID | Phase | Severity | Description | Workaround / Recommendation |
|----|-------|----------|-------------|------------------------------|
| ~~AMBER-01~~ | ~~7~~ | ~~Low~~ | ~~Demo-startup exec-bit test fails on Windows~~ | **Closed in-audit** — guarded 3 exec-bit tests with `itPosix` helper in `__tests__/unit/infra/demo-startup.test.ts`; POSIX CI still enforces |
| AMBER-02 | 1 | Low | Brand colour is `#1e40af` (blue) in manifest/layout/globals.css instead of `#9b214d` (maroon) specified in PHASE_1_MASTER_PROMPT § 1.2 and shown in Logo.png | Decide at v1.1: either align code to #9b214d or update master prompt + docs to record the blue decision |
| ~~AMBER-03~~ | ~~2~~ | ~~Low~~ | ~~Seed counts below Phase 2 target (5c/8y/15h/10e/5vr vs 8/6/20/12/10)~~ | **Resolved by PR #17 (Phase 12d)** — `seed.ts` split into production (minimal) + `seed-demo.ts` (8c/8y/20h/12e) |
| AMBER-04 | 2 | Low | No dedicated `/visit-requests` route — data surfaced via `/enquiries/[id]` and `/planning` | Accept as UX consolidation, or add list route if operators need a standalone queue |
| AMBER-05 | 4 | Low | Triage dispositions split across `TriageStatus` (4) + `PlanningStatus` (8) + `TriageTaskType` (5) rather than the 7 specific dispositions listed in PHASE_4_MASTER_PROMPT § 4.1 | Add mapping table in `docs/ARCHITECTURE.md` to reconcile vocabulary |
| AMBER-06 | 5 | Low | Geocoding fields on Yard lack `source`, `precision`, `formattedAddress` specified in PHASE_5_MASTER_PROMPT § 5.1 | Source is implicitly Google; precision inferable; formatted address derivable. Extend additively if required |
| AMBER-07 | 5 | Low | `RouteRun`/`RouteRunStop` used instead of master prompt's `RouteProposal`/`RouteStop` | Functional shape identical. Document terminology in `docs/ARCHITECTURE.md` |
| AMBER-08 | 6 | Medium | Single `AppointmentStatus` enum instead of separate Booking/Confirmation/Reminder status enums per `PHASE_6_DATA_MODEL.md` | Sufficient for single-vet operation. Revisit in v1.1 if operational granularity is needed |
| AMBER-09 | 6 | Low | No explicit `AppointmentHorse` link table; horses inferred from VisitRequest relation | Adequate if per-appointment horse metadata (order, per-horse duration) is not tracked |
| AMBER-10 | 6 | Medium | No `ConfirmationDispatch` event log — only latest `confirmationSentAt`/`confirmationChannel` on Appointment | Lose audit of multiple send attempts. Add for v1.1 if dispatch history is operationally important |
| AMBER-11 | 6 | Medium | No `AppointmentResponse` model — inbound replies flow through generic EnquiryMessage | Customer "confirmed/cancelled/reschedule" replies not directly linked to the appointment. Add for v1.1 |
| AMBER-12 | 6 | Low | No `ReminderSchedule` queue — reminders fired from inline `reminderSentAt24h/2h` fields via polled endpoint | Works for current scale; add if cancellations/retries of queued reminders become a need |
| AMBER-13 | 6 | Low | No `AppointmentStatusHistory` table — status changes tracked via `updatedAt` only | Add if audit trail is required for regulator/insurance/customer-dispute scenarios |
| AMBER-14 | 7 | Medium | Idempotency key store is in-memory (`processedKeys: Set<string>`) — lost on restart and not shared across instances | Move to Redis or Postgres-backed idempotency table before horizontal scaling |
| AMBER-15 | 7 | Low | No dead-letter queue for permanent failures after `maxRetries` | n8n layer provides secondary retry; add a `FailedOperation` table for persistent quarantine if observability gaps emerge |
| ~~AMBER-16~~ | ~~7~~ | ~~Low~~ | ~~No direct unit test for retry.ts~~ | **Retracted** — `__tests__/unit/utils/retry.test.ts` already exists with full coverage |

## Resolved Issues

| ID | Phase | Description | Resolution |
|----|-------|-------------|------------|
| KI-002 | 6 | Reminder scheduling had no built-in cron | Added `n8n/07-reminder-scheduling.json` — n8n workflow triggers `GET /api/reminders/check` every 15 minutes |

## Conventions

- Log issues discovered during development or UAT here
- Include phase, severity (low/medium/high/critical), and description
- Add workaround if available
- Move to Resolved section when fixed, with resolution notes
- Remove from Resolved after one release cycle
