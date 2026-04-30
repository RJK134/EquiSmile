# UAT Feedback Report — EquiSmile (v1.1 / Demo Build)

**Tester:** ____________________________________________
**Persona:** Dr. Rachel Kemp (see [`UAT_VET_PERSONA.md`](./UAT_VET_PERSONA.md))
**Date:** ___________   **Build / commit:** ___________________
**Device:** iPhone _______ (Safari)   **Network:** ☐ Wi-Fi ☐ 4G/5G ☐ Pinggy tunnel

> **How to use this form.** Open it in your browser (GitHub renders
> markdown nicely; or use any markdown preview locally). Tick the
> Pass / Fail / Partial boxes as you go. Type free-form notes below
> each section. When done, save a copy or send the file back to the
> engineering team. Numbered findings at the bottom feed straight
> into the bug tracker.

---

## 1. Sign-in

| | |
|---|---|
| **Steps** | Open `https://<tunnel>.pinggy.io/en/login` on iPhone. Tap "Continue as Demo Vet". |
| **Expected** | Lands on `/en/dashboard`, signed in as admin. No prompt for credentials. |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |
| **Time taken** | ____ seconds |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 2. Dashboard

| | |
|---|---|
| **Steps** | Inspect the dashboard at `/en/dashboard` at iPhone width (390 px). |
| **Expected** | Urgent count, needs-info count, planning pool count, active customers — all visible above the fold. The Mistral overdue triage task should be highlighted. |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |

| Check | Pass / Fail / N/A |
|---|---|
| All four counters render at iPhone width | ☐ ☐ ☐ |
| Mistral / overdue urgent indicator is visible | ☐ ☐ ☐ |
| No horizontal scroll required | ☐ ☐ ☐ |
| Bottom nav reachable | ☐ ☐ ☐ |
| Navigation tap targets feel large enough (44 px+) | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 3. Enquiries

| | |
|---|---|
| **Steps** | `/en/enquiries` → open `demo-enquiry-03` (Sophie Dupuis / Mistral, FR). |
| **Expected** | Original WhatsApp text visible (FR), parsed urgency cue surfaced, customer + horse identified, link to triage. |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |

| Check | Pass / Fail / N/A |
|---|---|
| FR original text rendered correctly (accents, ç, é) | ☐ ☐ ☐ |
| Customer name + phone match Sophie Dupuis seed | ☐ ☐ ☐ |
| Urgency badge ("URGENT" or equivalent) visible | ☐ ☐ ☐ |
| "Open in triage" / equivalent action present | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 4. Triage workflow

| | |
|---|---|
| **Steps** | `/en/triage` → open the Mistral task (URGENT_REVIEW, due 1 h ago). |
| **Expected** | Task overdue. Audit trail shows the original auto-classification. Manual override action available. |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |

| Check | Pass / Fail / N/A |
|---|---|
| Task age / overdue indicator clear | ☐ ☐ ☐ |
| Audit trail entries readable | ☐ ☐ ☐ |
| Override form opens and accepts a new classification | ☐ ☐ ☐ |
| Override is recorded with my user (audit log) | ☐ ☐ ☐ |
| Status transitions feel correct (no stuck states) | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 5. Planning pool

| | |
|---|---|
| **Steps** | `/en/planning` → find Sarah Mitchell's `PLANNING_POOL` request (Bramble + Shadow). |
| **Expected** | Routine enquiries grouped by area (postcode / yard cluster). Multi-horse yards visually flagged. |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |

| Check | Pass / Fail / N/A |
|---|---|
| Sarah Mitchell's request visible in the pool | ☐ ☐ ☐ |
| Yard / area grouping makes operational sense | ☐ ☐ ☐ |
| Horse count clearly displayed per request | ☐ ☐ ☐ |
| Filters (status, urgency, area) work as expected | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 6. Route generation (live Google API)

| | |
|---|---|
| **Steps** | From `/en/planning` (or wherever the action lives), trigger a fresh route across the seeded yard cluster. |
| **Expected** | Real Google `optimizeTours` is called (because `EQUISMILE_LIVE_MAPS=true`). Stop ordering reflects the API result, not the local nearest-neighbour fallback. |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |

| Check | Pass / Fail / N/A |
|---|---|
| Action visible to me | ☐ ☐ ☐ |
| Generation completes within ~10 s | ☐ ☐ ☐ |
| Resulting route looks geographically plausible | ☐ ☐ ☐ |
| Map renders on the iPhone (not a blank canvas) | ☐ ☐ ☐ |
| No 429 / quota error from Google | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 7. Route-run review

| | |
|---|---|
| **Steps** | `/en/route-runs` → open `demo-route-approved` (Villeneuve → Aigle). |
| **Expected** | Map, stop sequence, total distance, total travel time. |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |

| Check | Pass / Fail / N/A |
|---|---|
| Map fills the viewport without horizontal scroll | ☐ ☐ ☐ |
| Stop list shows yard, customer, horse count per stop | ☐ ☐ ☐ |
| Approve / reject actions visible (admin role) | ☐ ☐ ☐ |
| Total distance / time shown in metric units | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 8. Appointments

| | |
|---|---|
| **Steps** | `/en/appointments` → open `demo-appt-confirmed` (6 May 2026, 08:30, WhatsApp). |
| **Expected** | Confirmed status, confirmation channel, customer + horse details. Bilingual confirmation template viewable. |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |

| Check | Pass / Fail / N/A |
|---|---|
| Status pill shows CONFIRMED | ☐ ☐ ☐ |
| Confirmation channel + sent-at timestamp visible | ☐ ☐ ☐ |
| FR confirmation template reads naturally (not robotic) | ☐ ☐ ☐ |
| Cancel / reschedule actions present | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 9. Completed visits

| | |
|---|---|
| **Steps** | `/en/completed` → open `demo-appt-completed`. |
| **Expected** | Outcome notes, follow-up flag, invoice status (stub). |
| **Result** | ☐ Pass  ☐ Partial  ☐ Fail |

| Check | Pass / Fail / N/A |
|---|---|
| Outcome notes readable | ☐ ☐ ☐ |
| Follow-up flag visible if set | ☐ ☐ ☐ |
| Per-horse outcomes — N/A in v1.1; flag as "not yet implemented" if asked | ☐ ☐ ☐ |
| "Send invoice" / similar is clearly stubbed (not broken) | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 10. Bilingual surfaces

Switch to French (top-right language switcher → `/fr/...`) and revisit
the dashboard, an enquiry, and a confirmation template.

| Check | Pass / Fail / N/A |
|---|---|
| Language switch persists across navigation | ☐ ☐ ☐ |
| FR copy reads natively (not Google-translated) | ☐ ☐ ☐ |
| Dates render in the FR locale (DD/MM/YYYY, French month names where used) | ☐ ☐ ☐ |
| Currency / units sensible (CHF, km, °C) | ☐ ☐ ☐ |
| No untranslated English strings poking through | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 11. Mobile / PWA polish (390 px)

| Check | Pass / Fail / N/A |
|---|---|
| All eight pages render without horizontal scroll | ☐ ☐ ☐ |
| Bottom nav is reachable behind iOS safe-area inset | ☐ ☐ ☐ |
| No tap target smaller than ~44 px | ☐ ☐ ☐ |
| Forms keep my input on validation error (no clearing) | ☐ ☐ ☐ |
| Loading skeletons show instead of bare blank screens | ☐ ☐ ☐ |
| App is reachable when I lock + reopen Safari (PWA install) | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

## 12. Offline behaviour (optional but valuable)

Turn airplane mode on, try to mark a task complete, turn airplane
mode off again.

| Check | Pass / Fail / N/A |
|---|---|
| App shows an "offline" banner of some kind | ☐ ☐ ☐ |
| Mutation accepts my input and tells me it's queued | ☐ ☐ ☐ |
| When I come back online, the queued action goes through without me re-tapping | ☐ ☐ ☐ |
| If the action fails server-side, I'm told why | ☐ ☐ ☐ |

**Notes:**
_____________________________________________________________________
_____________________________________________________________________

---

# Findings log

> Number every finding. Engineering will pick these up by ID. Severity
> is your call: **High** = blocks the demo journey, **Medium** =
> works but visibly clunky, **Low** = polish or nice-to-have.

| # | Page / area | Severity | What happened | What I expected | Reproducible? |
|---|---|---|---|---|---|
| 1 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 2 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 3 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 4 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 5 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 6 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 7 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 8 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 9 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |
| 10 | | ☐ High ☐ Med ☐ Low | | | ☐ Yes ☐ No ☐ Once |

(Add more rows as needed — markdown tables stretch.)

---

# Lack-of-function notes

> Things that didn't break, but felt missing. Engineering will treat
> these as enhancement requests, not bugs.

1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
4. _________________________________________________________________
5. _________________________________________________________________

---

# Enhancement ideas

> Things you wish the app did, that nobody has asked for yet. Free-form.

1. _________________________________________________________________
2. _________________________________________________________________
3. _________________________________________________________________
4. _________________________________________________________________
5. _________________________________________________________________

---

# Overall verdict

| | |
|---|---|
| **Would you use this on Tuesday morning at the first yard?** | ☐ Yes  ☐ Yes with caveats  ☐ Not yet |
| **Biggest single thing to fix before going live?** | ____________________________________________ |
| **Biggest single thing already worth shouting about?** | _________________________________________ |

**Free-form summary:**
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________
_____________________________________________________________________

---

**Submitted:** ☐ via GitHub PR comment   ☐ via email to engineering   ☐ in person at retro

Thank you. — Engineering team
