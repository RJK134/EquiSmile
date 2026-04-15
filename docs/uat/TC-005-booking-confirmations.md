# TC-005 — Booking & Confirmations

## Overview

| Field | Value |
|-------|-------|
| Module | Appointments, confirmations, reminders, cancel/reschedule, outcomes |
| Priority | P1 |
| Preconditions | Logged in, UAT seed data loaded, approved route run exists |

---

## TC-005-01: Approved Route Creates Appointments

| Field | Value |
|-------|-------|
| **ID** | TC-005-01 |
| **Title** | Approving a route automatically creates appointments for each stop |
| **Priority** | P1 |

**Preconditions:** Route run in APPROVED status with 2+ stops

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger appointment creation from approved route (POST `/api/appointments/from-route/<routeRunId>`) | 200 OK with created appointments |
| 2 | Navigate to Appointments list (`/en/appointments`) | New appointments appear |
| 3 | Verify one appointment per route stop | Count matches number of stops |
| 4 | Verify each appointment has status PROPOSED | All show PROPOSED badge |
| 5 | Verify appointment start/end times match route schedule | Times are correct |
| 6 | Verify each appointment links to correct visit request | Visit request IDs match |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-005-02: Confirmation Sent (EN Customer)

| Field | Value |
|-------|-------|
| **ID** | TC-005-02 |
| **Title** | English-speaking customer receives confirmation in English |
| **Priority** | P1 |

**Preconditions:** Appointment exists for English-speaking customer (Sarah Jones)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger confirmation for appointment (POST `/api/appointments/<id>/confirm`) | 200 OK |
| 2 | Verify appointment status changes to CONFIRMED | Status badge shows CONFIRMED |
| 3 | Verify `confirmationSentAt` timestamp is set | Timestamp present |
| 4 | Verify `confirmationChannel` matches customer preference (WHATSAPP) | Channel recorded |
| 5 | Check outbound message log | Confirmation message in English |
| 6 | Verify message includes: date, time, yard name, horse details | All key info present |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-005-03: Confirmation Sent (FR Customer)

| Field | Value |
|-------|-------|
| **ID** | TC-005-03 |
| **Title** | French-speaking customer receives confirmation in French |
| **Priority** | P1 |

**Preconditions:** Appointment exists for French-speaking customer (Pierre Dupont)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger confirmation for appointment | 200 OK |
| 2 | Verify appointment status changes to CONFIRMED | Status badge shows CONFIRMED |
| 3 | Verify `confirmationChannel` matches customer preference (EMAIL) | Channel recorded |
| 4 | Check outbound message log | Confirmation message in French |
| 5 | Verify message includes French text: date, heure, lieu | French content correct |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-005-04: 24h Reminder Triggered

| Field | Value |
|-------|-------|
| **ID** | TC-005-04 |
| **Title** | Reminder sent 24 hours before appointment |
| **Priority** | P1 |

**Preconditions:** Confirmed appointment with start time approximately 24 hours from now

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create or adjust appointment to start ~24 hours from now | Appointment time set |
| 2 | Trigger reminder check (POST `/api/reminders/check`) | 200 OK |
| 3 | Verify `reminderSentAt24h` is now populated | Timestamp set |
| 4 | Check outbound message log | Reminder message sent in customer's language |
| 5 | Verify reminder not sent again on second trigger | Idempotent — no duplicate |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-005-05: Cancel Appointment (Returns to Pool)

| Field | Value |
|-------|-------|
| **ID** | TC-005-05 |
| **Title** | Cancelling an appointment returns the visit request to the planning pool |
| **Priority** | P1 |

**Preconditions:** Confirmed appointment exists

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to appointment detail page | Appointment shows CONFIRMED |
| 2 | Trigger cancellation (POST `/api/appointments/<id>/cancel`) with reason: "Customer requested reschedule" | 200 OK |
| 3 | Verify appointment status changes to CANCELLED | Status badge shows CANCELLED |
| 4 | Verify `cancellationReason` is recorded | Reason text stored |
| 5 | Check the associated visit request | Planning status returned to PLANNING_POOL or appropriate re-queue status |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-005-06: Reschedule Appointment

| Field | Value |
|-------|-------|
| **ID** | TC-005-06 |
| **Title** | Reschedule an existing appointment to a new date/time |
| **Priority** | P1 |

**Preconditions:** Confirmed appointment exists

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger reschedule (POST `/api/appointments/<id>/reschedule`) with new start and end times | 200 OK |
| 2 | Verify new appointment created with updated times | New start/end times correct |
| 3 | Verify old appointment is cancelled or superseded | Previous appointment status updated |
| 4 | Verify confirmation needs to be re-sent | Status reverts to PROPOSED or re-confirmation needed |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-005-07: Mark Appointment Complete with Outcome

| Field | Value |
|-------|-------|
| **ID** | TC-005-07 |
| **Title** | Mark an appointment as completed and record visit outcome |
| **Priority** | P1 |

**Preconditions:** Confirmed appointment exists

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger completion (POST `/api/appointments/<id>/complete`) with body: `{ "notes": "All 3 horses treated. Bramble needs sedation next time. Fern has a loose tooth — follow up in 3 months.", "followUpRequired": true, "followUpDueDate": "2026-07-15", "nextDentalDueDate": "2027-04-15" }` | 200 OK |
| 2 | Verify appointment status changes to COMPLETED | Status badge shows COMPLETED |
| 3 | View visit outcome record | Outcome notes, follow-up details visible |
| 4 | Verify `followUpRequired` is true | Flag set |
| 5 | Verify `followUpDueDate` is "2026-07-15" | Date correct |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-005-08: Follow-Up Visit Request Created

| Field | Value |
|-------|-------|
| **ID** | TC-005-08 |
| **Title** | Completed visit with follow-up creates a new visit request |
| **Priority** | P2 |

**Preconditions:** TC-005-07 completed (appointment with follow-up required)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger follow-up creation (POST `/api/triage/follow-up`) with appropriate visit outcome data | 200 OK |
| 2 | Navigate to Visit Requests list | New follow-up visit request appears |
| 3 | Verify request type is FOLLOW_UP | Type badge correct |
| 4 | Verify linked to same customer and yard | Customer and yard match original |
| 5 | Verify earliest book date matches follow-up due date | Dates align |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-005-09: No-Show Marking

| Field | Value |
|-------|-------|
| **ID** | TC-005-09 |
| **Title** | Mark an appointment as no-show |
| **Priority** | P2 |

**Preconditions:** Confirmed appointment exists

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger no-show (POST `/api/appointments/<id>/no-show`) | 200 OK |
| 2 | Verify appointment status changes to NO_SHOW | Status badge shows NO_SHOW |
| 3 | Verify visit request is available for re-planning | Visit request status updated |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________
