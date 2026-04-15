# TC-002 — Enquiry Intake

## Overview

| Field | Value |
|-------|-------|
| Module | Enquiry creation, WhatsApp intake, Email intake |
| Priority | P1 |
| Preconditions | Logged in, UAT seed data loaded, n8n running |

---

## TC-002-01: Manual Enquiry Creation (Routine)

| Field | Value |
|-------|-------|
| **ID** | TC-002-01 |
| **Title** | Create a routine enquiry manually |
| **Priority** | P1 |

**Preconditions:** Customer "Sarah Jones" exists with yard "Oakfield Stables"

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Enquiries page (`/en/enquiries`) | Enquiry list displayed |
| 2 | Click "New Enquiry" | Enquiry creation form opens |
| 3 | Select Channel: "WhatsApp" | Channel selected |
| 4 | Enter Source From: "+447700900001" | Phone number entered |
| 5 | Enter Subject: "Routine dental check for 3 horses" | Subject entered |
| 6 | Enter Raw Text: "Hi, I'd like to book a routine dental check for Bramble, Shadow, and Fern at Oakfield Stables. Any day next month works, mornings preferred." | Text entered |
| 7 | Click "Save" / "Submit" | Success toast, enquiry created with status NEW |
| 8 | Verify enquiry appears in list with status "New" | Status badge shows NEW |
| 9 | Click into enquiry detail | Full details displayed correctly |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-002-02: Manual Enquiry Creation (Urgent)

| Field | Value |
|-------|-------|
| **ID** | TC-002-02 |
| **Title** | Create an urgent enquiry manually |
| **Priority** | P1 |

**Preconditions:** Customer exists

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to New Enquiry form | Form opens |
| 2 | Select Channel: "Email" | Channel selected |
| 3 | Enter Source From: "pierre.dupont@example.fr" | Email entered |
| 4 | Enter Subject: "Urgent — horse not eating" | Subject entered |
| 5 | Enter Raw Text: "Mon cheval Eclat ne mange plus depuis 2 jours. Il semble avoir mal à la bouche. C'est urgent, pouvez-vous venir rapidement?" | French text entered |
| 6 | Click "Save" | Enquiry created successfully |
| 7 | Verify enquiry status is "New" | Status badge shows NEW |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-002-03: WhatsApp Webhook Test (Mock Payload)

| Field | Value |
|-------|-------|
| **ID** | TC-002-03 |
| **Title** | Simulate a WhatsApp webhook delivery |
| **Priority** | P1 |

**Preconditions:** n8n running, WhatsApp webhook endpoint accessible

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send POST to `/api/webhooks/whatsapp` with valid mock payload (see below) | 200 OK response |
| 2 | Navigate to Enquiries list | New enquiry appears |
| 3 | Verify channel is "WhatsApp" | Channel badge shows WHATSAPP |
| 4 | Verify source phone number matches mock payload | Phone number correct |
| 5 | Verify raw text matches mock payload message | Message text matches |
| 6 | Verify `externalMessageId` is set | No duplicate if sent again |

**Mock Payload:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456789",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "447700900001", "phone_number_id": "12345" },
        "contacts": [{ "profile": { "name": "Test User" }, "wa_id": "447700900099" }],
        "messages": [{
          "id": "wamid.uat-test-001",
          "from": "447700900099",
          "timestamp": "1700000000",
          "type": "text",
          "text": { "body": "I need a dental check for 2 horses at Manor Farm, CB2 1TN" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-002-04: Email Intake Test (Mock Payload)

| Field | Value |
|-------|-------|
| **ID** | TC-002-04 |
| **Title** | Simulate an email intake via the webhook endpoint |
| **Priority** | P1 |

**Preconditions:** n8n running, email webhook endpoint accessible

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send POST to `/api/webhooks/email` with valid mock payload and `Authorization: Bearer <N8N_API_KEY>` header | 200 OK response with `enquiryId` |
| 2 | Navigate to Enquiries list | New enquiry appears |
| 3 | Verify channel is "Email" | Channel badge shows EMAIL |
| 4 | Verify source email matches payload | Email address correct |
| 5 | Verify subject and body match | Content matches mock data |

**Mock Payload:**
```json
{
  "from": "newclient@example.com",
  "fromName": "New Client",
  "subject": "Dental appointment for horse",
  "textBody": "Hello, I have a 6-year-old horse that needs a routine dental check. My postcode is BA1 2AB.",
  "messageId": "<uat-email-001@example.com>",
  "receivedAt": "2026-04-15T10:00:00Z"
}
```

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-002-05: Duplicate Message Handling

| Field | Value |
|-------|-------|
| **ID** | TC-002-05 |
| **Title** | Verify duplicate messages are not created |
| **Priority** | P1 |

**Preconditions:** TC-002-03 completed (WhatsApp enquiry with `wamid.uat-test-001` exists)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Re-send the same WhatsApp mock payload from TC-002-03 | 200 OK (idempotent) |
| 2 | Navigate to Enquiries list | No duplicate enquiry created |
| 3 | Count enquiries with external ID `wamid.uat-test-001` | Exactly 1 enquiry |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-002-06: Missing Info Detection

| Field | Value |
|-------|-------|
| **ID** | TC-002-06 |
| **Title** | Enquiry with missing information triggers triage task |
| **Priority** | P2 |

**Preconditions:** Auto-triage workflow active

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create manual enquiry with text: "I need a dentist for my horse" (no postcode, no horse count, no yard) | Enquiry created |
| 2 | Wait for auto-triage to process (or trigger manually) | Triage processes the enquiry |
| 3 | Navigate to the enquiry's visit request | Visit request shows `needsMoreInfo: true` |
| 4 | Check triage tasks | Task created for missing information (e.g., ASK_FOR_POSTCODE, ASK_HORSE_COUNT) |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________
