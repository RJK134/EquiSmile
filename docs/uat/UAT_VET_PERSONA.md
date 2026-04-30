# UAT Vet Persona — Dr. Rachel Kemp

The vet who tests EquiSmile during UAT. Use this persona to run the
walkthrough on the iPhone, then capture findings in
[`UAT_FEEDBACK_REPORT.md`](./UAT_FEEDBACK_REPORT.md).

The persona is deliberately the same character seeded into the demo
database (`prisma/seed-demo.ts`: `demo-staff-rachel`,
`rachel@equismile.example`, `Lead VET`, brand colour `#9b214d`), so
the test session reads as one continuous narrative rather than "I'm
pretending to be someone else, signed in as a generic admin."

---

## Profile

| Field | Value |
|---|---|
| **Name** | Dr. Rachel Kemp BVSc MRCVS |
| **Role in product** | Founder + lead equine dental vet |
| **Practice** | Solo + one visiting vet (Dr. Alex Moreau), based in Blonay (canton Vaud, Switzerland) |
| **Coverage area** | Lake Geneva north shore — Vevey, Montreux, Aigle, Villeneuve, Bulle, Avenches |
| **Languages** | English (primary), French (working) |
| **Devices** | iPhone (primary, day-to-day) + a Windows laptop at home for admin |
| **Tech comfort** | Comfortable with apps, not technical. Will type with one thumb between yards. |

## A typical Tuesday

06:30 — wakes up; checks WhatsApp on the iPhone before leaving the
house. Three messages overnight: one from a panicked owner whose
horse went off feed at 4 am, one from a regular yard manager asking
to move next week's float visit, and one from a new yard she's never
heard of asking for a price.

07:10 — drives to first stop. Wants the app to:
- Show her *which* of those three is urgent without her reading
  every message.
- Show her today's route in a glanceable form (next stop, ETA, how
  many horses).
- Let her open the urgent one with one tap, see the parsed details,
  and acknowledge it.

10:00–16:00 — between yards. Phone signal is patchy on some of the
mountain roads. Wants:
- The app to keep working when there's no signal — at least to read
  the day's plan and tap visit-complete.
- Sync to "do the right thing" once she's back online; she does not
  want to think about what got queued.

17:30 — back at home. Opens the laptop. Wants to:
- Approve tomorrow's route run.
- Send the morning's confirmation messages.
- Skim today's outcomes and decide what needs a follow-up.

She has zero patience for:
- Empty states that don't explain themselves.
- Forms that throw away her input on validation errors.
- Anything that says "An error occurred" without a recovery path.
- Reading horizontal scroll on her iPhone.
- French translations that read like Google Translate.

---

## Goals for this UAT session

In priority order:

1. **Confidence** — can she rely on the app to surface urgent cases?
2. **Speed** — can she get from "hear the WhatsApp ping" to
   "acknowledged in the app" in under 30 seconds, on the phone, with
   one thumb?
3. **Clarity** — does the app tell her *why* a task is urgent, *who*
   is on the route, *when* the appointment was confirmed?
4. **Trust** — when she taps "complete" or "send confirmation", does
   the app give her a clear, honest acknowledgement (not a fake
   green tick)?
5. **Bilingual quality** — French copy on the customer-facing
   surfaces (confirmations, reminders) should feel *native*, not
   translated.

## Goals NOT for this UAT session

These are out of scope for tomorrow's session and Rachel should be
told so she doesn't write up a deficiency report against them:

- **Accountancy / invoicing.** Phase 14 stubs invoice status; full
  invoicing is post-v1.
- **Multi-vet calendar collaboration.** Phase 10 added the staff
  model; the calendar UI for "Rachel + Alex on the same day" is
  post-v1.
- **In-app messaging / live chat to customers.** WhatsApp is the
  channel; there is no in-app reply UI.
- **Self-service customer portal.** Internal app first per project
  charter.
- **Native iOS app.** PWA via Safari is the v1 mobile experience.

---

## How to read this for the test session

Rachel signs in as **"Demo Vet"** on the login page (one tap — the
demo-mode card under `DEMO_MODE=true`). She lands on the dashboard
already authenticated as an admin. Internally the demo session is
attributed to "Demo Vet" in the audit logs; for the narrative, she
*is* Dr. Rachel Kemp, looking at her own day's work.

The seeded fixtures match her real coverage area and coverage
shape:

| Fixture | What Rachel sees |
|---|---|
| `demo-enquiry-03` (Sophie Dupuis, FR, Mistral not eating) | Her overdue urgent case from this morning. |
| `demo-enquiry-02` (Sarah Mitchell, Bramble + Shadow) | A routine request she'll batch into next week. |
| `demo-route-approved` (Villeneuve→Aigle) | Tomorrow's approved route; two stops, 2 horses each. |
| `demo-appt-confirmed` (6 May, 08:30) | A confirmed appointment, WhatsApp confirmation already out. |
| `demo-appt-completed` | Yesterday's last call; outcome notes already entered. |

Walk the eight beats listed in
[`docs/DEMO_RUNBOOK.md`](../DEMO_RUNBOOK.md) §5, then capture
findings in `UAT_FEEDBACK_REPORT.md`.
