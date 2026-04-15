# TC-003 — Triage Workflow

## Overview

| Field | Value |
|-------|-------|
| Module | Auto-triage, manual override, escalation, status transitions |
| Priority | P1 |
| Preconditions | Logged in, UAT seed data loaded, triage service operational |

---

## TC-003-01: Auto-Triage Classifies Urgency (EN)

| Field | Value |
|-------|-------|
| **ID** | TC-003-01 |
| **Title** | Auto-triage correctly classifies an English-language enquiry |
| **Priority** | P1 |

**Preconditions:** Enquiry created with English text containing urgency indicators

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create enquiry with text: "Routine dental check for 2 horses at Oak Farm, CB8 9AA. Any time next month is fine." | Enquiry created |
| 2 | Trigger auto-triage (via API or wait for processing) | Triage processes the enquiry |
| 3 | View the resulting visit request | Visit request created |
| 4 | Verify urgency level is "ROUTINE" | Urgency badge shows ROUTINE |
| 5 | Verify request type is "ROUTINE_DENTAL" | Type correctly classified |
| 6 | Verify confidence score is present | `autoTriageConfidence` is a number between 0 and 1 |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-003-02: Auto-Triage Classifies Urgency (FR)

| Field | Value |
|-------|-------|
| **ID** | TC-003-02 |
| **Title** | Auto-triage correctly classifies a French-language enquiry |
| **Priority** | P1 |

**Preconditions:** French-speaking customer exists

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create enquiry with text: "Mon cheval a une bosse sur la mâchoire et ne mange plus depuis hier. C'est urgent." | Enquiry created |
| 2 | Trigger auto-triage | Triage processes the enquiry |
| 3 | View the resulting visit request | Visit request created |
| 4 | Verify urgency level is "URGENT" | Urgency badge shows URGENT |
| 5 | Verify request type is "URGENT_ISSUE" | Type correctly classified |
| 6 | Verify French keywords detected ("urgent", "ne mange plus") | Triage reasoning references French text |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-003-03: Missing Info Creates Triage Tasks

| Field | Value |
|-------|-------|
| **ID** | TC-003-03 |
| **Title** | Missing information in enquiry generates triage tasks |
| **Priority** | P1 |

**Preconditions:** Triage service operational

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create enquiry with text: "I need someone to look at my horse's teeth" (no postcode, no horse count, no yard info) | Enquiry created |
| 2 | Trigger auto-triage | Triage processes the enquiry |
| 3 | Navigate to Triage page | Triage tasks listed |
| 4 | Verify task exists for "ASK_FOR_POSTCODE" | Task with type ASK_FOR_POSTCODE visible |
| 5 | Verify task exists for "ASK_HORSE_COUNT" | Task with type ASK_HORSE_COUNT visible |
| 6 | Verify visit request has `needsMoreInfo: true` | Flag set correctly |
| 7 | Verify task status is "OPEN" | Both tasks in OPEN status |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-003-04: Manual Override Changes Urgency

| Field | Value |
|-------|-------|
| **ID** | TC-003-04 |
| **Title** | Operator can manually override the auto-triage urgency level |
| **Priority** | P1 |

**Preconditions:** Visit request exists with urgency ROUTINE (from TC-003-01)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to the visit request from TC-003-01 | Detail page shows ROUTINE urgency |
| 2 | Use the override function (API: POST `/api/triage/override`) with body: `{ "visitRequestId": "<id>", "field": "urgencyLevel", "newValue": "SOON", "reason": "Customer called back, horse seems uncomfortable" }` | 200 OK response |
| 3 | Refresh the visit request detail | Urgency now shows SOON |
| 4 | Check triage audit log | Audit entry shows: field=urgencyLevel, previousValue=ROUTINE, newValue=SOON, reason matches |
| 5 | Verify performedBy is recorded | Audit shows who made the change |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-003-05: Escalation After SLA Breach

| Field | Value |
|-------|-------|
| **ID** | TC-003-05 |
| **Title** | Triage task escalates when SLA is breached |
| **Priority** | P2 |

**Preconditions:** Open triage task exists with a past due date

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create or modify a triage task with `dueAt` set to a past timestamp | Task has expired SLA |
| 2 | Trigger the escalation check (via API or scheduled process) | Escalation runs |
| 3 | View the triage task | `escalatedAt` field is now populated |
| 4 | Verify escalation is visible in the UI | Task shows escalated indicator |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-003-06: Status Transitions Enforced

| Field | Value |
|-------|-------|
| **ID** | TC-003-06 |
| **Title** | Invalid triage status transitions are rejected |
| **Priority** | P1 |

**Preconditions:** Visit request exists with status TRIAGED

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Attempt to change a TRIAGED visit request back to NEW via API | Request rejected (400 or 422) |
| 2 | Verify error message mentions invalid transition | Error message is clear |
| 3 | Verify the visit request status is unchanged | Still TRIAGED |
| 4 | Attempt valid transition: TRIAGED → next valid status | Transition succeeds |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________
