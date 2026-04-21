# EquiSmile Known Issues

## Active Issues

| ID | Phase | Severity | Description | Workaround |
|----|-------|----------|-------------|------------|
| KI-001 | 5 | Low | Google Maps API rate limiting may cause batch geocoding to fail for large batches (50+ yards) | Process in smaller batches of 10–20 |
| ~~KI-002~~ | ~~6~~ | ~~Low~~ | ~~Reminder scheduling depends on `POST /api/reminders/check` being called periodically — no built-in cron~~ | Resolved in Phase 12d |
| KI-003 | 7 | Low | PWA offline queue does not retry mutations in the original submission order if multiple were queued | Mutations are eventually consistent; order rarely matters for this app's use case |
| KI-004 | 3 | Medium | WhatsApp webhook verification requires the app to be publicly accessible — not possible in local dev | Use ngrok or similar tunnel for local WhatsApp testing |
| KI-005 | 4 | Low | Auto-triage confidence scores are heuristic-based and may misclassify edge cases | Manual override is available; triage tasks created for low-confidence classifications |
| KI-006 | 9 | Info | `/api/webhooks/*`, `/api/n8n/*`, and `/api/reminders/check` intentionally bypass session auth and stay behind the separate `N8N_API_KEY` check — by design, because n8n calls them server-to-server without a browser session. Phase 14 PR E hardened this: the key gate now FAILS CLOSED in production (HTTP 500) when `N8N_API_KEY` is unset, instead of silently accepting anonymous traffic. | No action; enforced in `middleware.ts` via `PUBLIC_PATH_PATTERNS` + `lib/utils/signature.ts#requireN8nApiKey`. |
| KI-007 | 14 | Info | In-memory rate limiters (`lib/utils/rate-limit.ts`) do not share state across horizontally-scaled instances. Acceptable for the single-vet single-VPS deploy shape; promote to Redis when the deploy goes multi-node. | No action required for v1 scale. |

## v1.0.0 Retrospective Audit — AMBER items (2026-04-20)

Filed during the [Phase Verification Plan](./PHASE_VERIFICATION_PLAN.md) audit. See [V1_AUDIT_FINDINGS.md](./V1_AUDIT_FINDINGS.md) for the per-phase evidence tables.

| ID | Phase | Severity | Description | Workaround / Recommendation |
|----|-------|----------|-------------|------------------------------|
| ~~AMBER-01~~ | ~~7~~ | ~~Low~~ | ~~Demo-startup exec-bit test fails on Windows~~ | **Closed in-audit** — guarded 3 exec-bit tests with `itPosix` helper in `__tests__/unit/infra/demo-startup.test.ts`; POSIX CI still enforces |
| ~~AMBER-02~~ | ~~1~~ | ~~Low~~ | ~~Brand colour is `#1e40af` (blue) in manifest/layout/globals.css instead of `#9b214d` (maroon) specified in PHASE_1_MASTER_PROMPT § 1.2 and shown in Logo.png~~ | **Resolved** — aligned all four code sites (globals.css, manifest.ts, layout.tsx, RouteMap.tsx) to the spec maroon `#9b214d`. Added `--color-primary-light` (`#c23b6c`) and `--color-primary-dark` (`#6f1738`) tints. |
| ~~AMBER-03~~ | ~~2~~ | ~~Low~~ | ~~Seed counts below Phase 2 target (5c/8y/15h/10e/5vr vs 8/6/20/12/10)~~ | **Resolved by PR #17 (Phase 12d)** — `seed.ts` split into production (minimal) + `seed-demo.ts` (8c/8y/20h/12e) |
| ~~AMBER-04~~ | ~~2~~ | ~~Low~~ | ~~No dedicated `/visit-requests` route~~ | **Resolved in Phase 14 PR D** — added `/[locale]/visit-requests` list page with status + urgency filters. |
| ~~AMBER-05~~ | ~~4~~ | ~~Low~~ | ~~Triage dispositions split across `TriageStatus` + `PlanningStatus` + `TriageTaskType`~~ | **Resolved by docs** in Phase 14 PR D — `docs/ARCHITECTURE.md` now carries an explicit disposition mapping table. |
| ~~AMBER-06~~ | ~~5~~ | ~~Low~~ | ~~Geocoding fields on Yard lack `source`, `precision`, `formattedAddress`~~ | **Resolved in Phase 14 PR D** — added `geocodeSource`, `geocodePrecision`, `formattedAddress` nullable columns via additive migration. |
| ~~AMBER-07~~ | ~~5~~ | ~~Low~~ | ~~`RouteRun`/`RouteRunStop` used instead of master prompt's `RouteProposal`/`RouteStop`~~ | **Resolved by docs** in Phase 14 PR D — explicit rename rationale + mapping in `docs/ARCHITECTURE.md`. |
| ~~AMBER-08~~ | ~~6~~ | ~~Medium~~ | ~~Single `AppointmentStatus` enum instead of separate Booking/Confirmation/Reminder enums~~ | **Resolved by docs** in Phase 14 PR D — rationale in `docs/ARCHITECTURE.md`; multi-send audit now captured by `ConfirmationDispatch` (AMBER-10). |
| AMBER-09 | 6 | Low | No explicit `AppointmentHorse` link table; horses inferred from VisitRequest relation | Adequate if per-appointment horse metadata (order, per-horse duration) is not tracked |
| ~~AMBER-10~~ | ~~6~~ | ~~Medium~~ | ~~No `ConfirmationDispatch` event log~~ | **Resolved in Phase 14 PR D** — `ConfirmationDispatch` table + `appointmentAuditService.logConfirmationDispatch`; every send attempt (success or failure) recorded. |
| ~~AMBER-11~~ | ~~6~~ | ~~Medium~~ | ~~No `AppointmentResponse` model~~ | **Resolved in Phase 14 PR D** — `AppointmentResponse` table + `appointmentAuditService.logResponse`; captures inbound confirm/cancel/reschedule replies linked directly to the appointment. |
| ~~AMBER-12~~ | ~~6~~ | ~~Low~~ | ~~No `ReminderSchedule` queue~~ | **Resolved by docs** in Phase 14 PR D — inline timestamps + idempotent cron are adequate for single-vet scale; promotion plan documented in `docs/ARCHITECTURE.md`. |
| ~~AMBER-13~~ | ~~6~~ | ~~Low~~ | ~~No `AppointmentStatusHistory` table~~ | **Resolved in Phase 14 PR D** — `AppointmentStatusHistory` table; booking / reschedule / visit-outcome services write history rows in the same transaction as status mutations. |
| ~~AMBER-14~~ | ~~7~~ | ~~Medium~~ | ~~Idempotency key store is in-memory (`processedKeys: Set<string>`) — lost on restart and not shared across instances~~ | **Resolved by phase 13** — `IdempotencyKey` Prisma model + `lib/services/idempotency.service.ts` (Postgres-backed). `hasBeenProcessed`/`markAsProcessed` are now async. Survives restarts, shared across instances, 30-day TTL with `pruneExpired()` cron. |
| ~~AMBER-15~~ | ~~7~~ | ~~Low~~ | ~~No dead-letter queue for permanent failures after `maxRetries`~~ | **Resolved in Phase 14 PR D** — `FailedOperation` table + `deadLetterService`. `whatsappService` and `emailService` enqueue permanent failures; operators replay via `deadLetterService.markStatus`. Payloads scrubbed with `redact()` before storage. |
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
