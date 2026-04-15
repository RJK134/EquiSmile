# TC-007 — Bilingual (EN/FR)

## Overview

| Field | Value |
|-------|-------|
| Module | Language switching, localised content, date/time formatting |
| Priority | P1 |
| Preconditions | Logged in, UAT seed data loaded, both EN and FR customers exist |

---

## TC-007-01: Switch Language EN → FR on All Pages

| Field | Value |
|-------|-------|
| **ID** | TC-007-01 |
| **Title** | All pages display correctly when switching from English to French |
| **Priority** | P1 |

**Preconditions:** App loaded in English

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Start on Dashboard (`/en/dashboard`) | English content displayed |
| 2 | Click language switcher to French | URL changes to `/fr/dashboard` |
| 3 | Verify Dashboard headings and labels in French | All text translated |
| 4 | Navigate to Customers (`/fr/customers`) | French labels on customer list |
| 5 | Navigate to Enquiries (`/fr/enquiries`) | French labels on enquiry list |
| 6 | Navigate to Appointments (`/fr/appointments`) | French labels |
| 7 | Navigate to Route Runs (`/fr/route-runs`) | French labels |
| 8 | Navigate to Triage (`/fr/triage`) | French labels |
| 9 | Navigate to Planning (`/fr/planning`) | French labels |
| 10 | Verify no untranslated English text on any page | All user-facing text in French |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-007-02: Switch Language FR → EN on All Pages

| Field | Value |
|-------|-------|
| **ID** | TC-007-02 |
| **Title** | All pages display correctly when switching from French to English |
| **Priority** | P1 |

**Preconditions:** App loaded in French

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Start on Dashboard (`/fr/dashboard`) | French content displayed |
| 2 | Click language switcher to English | URL changes to `/en/dashboard` |
| 3 | Verify Dashboard headings and labels in English | All text translated back |
| 4 | Navigate through each page | All pages display in English |
| 5 | Verify no remaining French text | All user-facing text in English |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-007-03: Customer Confirmation in Correct Language

| Field | Value |
|-------|-------|
| **ID** | TC-007-03 |
| **Title** | Confirmation messages sent in the customer's preferred language |
| **Priority** | P1 |

**Preconditions:** Appointments exist for both EN and FR customers

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Confirm appointment for Sarah Jones (preferred language: EN) | Confirmation sent |
| 2 | Check outbound message for Sarah Jones | Message content is in English |
| 3 | Confirm appointment for Pierre Dupont (preferred language: FR) | Confirmation sent |
| 4 | Check outbound message for Pierre Dupont | Message content is in French |
| 5 | Verify both messages contain correct appointment details | Date, time, location present in both |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-007-04: Reminder in Correct Language

| Field | Value |
|-------|-------|
| **ID** | TC-007-04 |
| **Title** | Reminder messages sent in the customer's preferred language |
| **Priority** | P1 |

**Preconditions:** Confirmed appointments for EN and FR customers within 24h

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Trigger reminder check | Reminders processed |
| 2 | Check reminder for EN customer | Reminder text in English |
| 3 | Check reminder for FR customer | Reminder text in French |
| 4 | Verify both reminders include appointment date/time | Details present |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-007-05: Triage Rules Work for French Input

| Field | Value |
|-------|-------|
| **ID** | TC-007-05 |
| **Title** | Auto-triage correctly processes French-language enquiry text |
| **Priority** | P1 |

**Preconditions:** Triage service active

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create enquiry with French text: "Bonjour, je souhaite un contrôle dentaire de routine pour mes 3 chevaux. Mon code postal est 62100." | Enquiry created |
| 2 | Trigger auto-triage | Triage processes |
| 3 | Verify urgency classified as ROUTINE | French "routine" detected |
| 4 | Verify horse count extracted (3) | Parsed from "3 chevaux" |
| 5 | Verify postcode extracted (62100) | Parsed from French text |
| 6 | Create urgent French enquiry: "Urgence! Mon cheval saigne de la bouche!" | Enquiry created |
| 7 | Trigger auto-triage | Triage processes |
| 8 | Verify urgency classified as URGENT | French "urgence", "saigne" detected |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-007-06: Status Badges Display in Both Languages

| Field | Value |
|-------|-------|
| **ID** | TC-007-06 |
| **Title** | All status badges display correctly in EN and FR |
| **Priority** | P2 |

**Preconditions:** Various records with different statuses exist

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | View Enquiries list in English | Status badges (NEW, PARSED, NEEDS_INFO, TRIAGED) in English |
| 2 | Switch to French | Status badges translated to French |
| 3 | View Appointments list in English | Status badges (PROPOSED, CONFIRMED, COMPLETED, CANCELLED, NO_SHOW) in English |
| 4 | Switch to French | Status badges translated to French |
| 5 | View Route Runs list in English | Status badges (DRAFT, PROPOSED, APPROVED, BOOKED, COMPLETED) in English |
| 6 | Switch to French | Status badges translated to French |
| 7 | Verify no raw enum values displayed in either language | All displayed with human-readable labels |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-007-07: Date/Time Formatting Respects Locale

| Field | Value |
|-------|-------|
| **ID** | TC-007-07 |
| **Title** | Dates and times display in the correct locale format |
| **Priority** | P2 |

**Preconditions:** Records with dates exist (appointments, enquiries)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | View appointments list in English | Dates in EN format (e.g., "15 April 2026" or "04/15/2026") |
| 2 | Switch to French | Dates in FR format (e.g., "15 avril 2026" or "15/04/2026") |
| 3 | Verify time format follows locale | EN: 10:00 AM / FR: 10h00 or 10:00 |
| 4 | Check appointment detail page in French | All dates/times in French format |
| 5 | Switch back to English | All dates/times in English format |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________
