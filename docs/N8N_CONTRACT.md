# n8n-to-App REST Contract

This document defines the typed REST contract between n8n workflows and the EquiSmile application.

All endpoints authenticate via `Authorization: Bearer <N8N_API_KEY>` header.

---

## Inbound Endpoints (n8n → App)

### POST /api/webhooks/whatsapp

WhatsApp Cloud API webhook endpoint. Receives events directly from Meta.

**Headers:**
- `X-Hub-Signature-256`: HMAC-SHA256 signature of the request body

**Request Body:**
```typescript
{
  object: "whatsapp_business_account",
  entry: [{
    id: string,
    changes: [{
      value: {
        messaging_product: "whatsapp",
        metadata: { display_phone_number: string, phone_number_id: string },
        contacts: [{ profile: { name: string }, wa_id: string }],
        messages: [{
          id: string,
          from: string,
          timestamp: string,
          type: "text" | "image" | "document",
          text?: { body: string }
        }]
      },
      field: "messages"
    }]
  }]
}
```

**Example:**
```json
{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "123456789",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "metadata": { "display_phone_number": "447700900001", "phone_number_id": "12345" },
        "contacts": [{ "profile": { "name": "Jane Smith" }, "wa_id": "447700900002" }],
        "messages": [{
          "id": "wamid.abc123",
          "from": "447700900002",
          "timestamp": "1700000000",
          "type": "text",
          "text": { "body": "Hi, I need a dental check for 3 horses at Oak Farm, BA1 1AA" }
        }]
      },
      "field": "messages"
    }]
  }]
}
```

**Response:** `200 OK` `{ "status": "ok" }`

**Error Codes:**
- `401` — Invalid webhook signature
- `400` — Invalid JSON payload

---

### POST /api/webhooks/email

Email intake from n8n IMAP trigger. n8n parses the email and POSTs structured data.

**Headers:**
- `Authorization: Bearer <N8N_API_KEY>`

**Request Body:**
```typescript
{
  from: string,           // sender email address
  fromName?: string,      // display name
  subject: string,
  textBody: string,       // plain text body
  htmlBody?: string,      // HTML body (optional)
  messageId: string,      // email Message-ID header
  inReplyTo?: string,     // for threading
  receivedAt: string,     // ISO 8601 timestamp
}
```

**Example:**
```json
{
  "from": "jane@example.com",
  "fromName": "Jane Smith",
  "subject": "Dental check for 2 horses",
  "textBody": "Hi, I'd like to book a dental check for my 2 horses at Manor Farm.",
  "messageId": "<abc123@mail.example.com>",
  "receivedAt": "2024-01-15T10:30:00Z"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "enquiryId": "uuid",
  "customerId": "uuid",
  "isNew": true
}
```

**Error Codes:**
- `401` — Invalid API key
- `400` — Validation failed (Zod schema errors returned in `details`)

---

### POST /api/n8n/triage-result

n8n sends automated triage classification for an enquiry.

**Headers:**
- `Authorization: Bearer <N8N_API_KEY>`

**Request Body:**
```typescript
{
  enquiryId: string,      // UUID
  visitRequestId: string, // UUID
  requestType: "ROUTINE_DENTAL" | "FOLLOW_UP" | "URGENT_ISSUE" | "FIRST_VISIT" | "ADMIN",
  urgencyLevel: "URGENT" | "SOON" | "ROUTINE",
  confidence?: number,    // 0-1
  reasoning?: string,
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Triage result acknowledged",
  "data": { ... }
}
```

---

### POST /api/n8n/geocode-result

n8n sends geocoding results for a yard (placeholder for Phase 5).

**Headers:**
- `Authorization: Bearer <N8N_API_KEY>`

**Request Body:**
```typescript
{
  yardId: string,         // UUID
  latitude: number,
  longitude: number,
  formattedAddress?: string,
  placeId?: string,
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Geocode result acknowledged",
  "data": { ... }
}
```

---

### POST /api/n8n/route-proposal

n8n sends a route proposal (placeholder for Phase 5).

**Headers:**
- `Authorization: Bearer <N8N_API_KEY>`

**Request Body:**
```typescript
{
  routeRunId?: string,    // UUID (if updating existing)
  runDate: string,        // ISO date
  stops: [{
    yardId: string,
    visitRequestId?: string,
    sequenceNo: number,
    estimatedArrival?: string,
    estimatedDuration?: number,
  }],
  totalDistanceMeters?: number,
  totalTravelMinutes?: number,
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "message": "Route proposal acknowledged",
  "data": { ... }
}
```

---

## Outbound Endpoints (App → n8n)

### POST /api/n8n/trigger/send-whatsapp

Request n8n (or direct service) to send a WhatsApp message.

**Headers:**
- `Authorization: Bearer <N8N_API_KEY>`

**Request Body:**
```typescript
{
  to: string,             // E.164 phone number
  message: string,        // text message body
  enquiryId?: string,     // UUID to link message log
  language?: string,      // "en" | "fr" (default: "en")
  templateName?: string,  // WhatsApp template name
  templateParams?: string[], // template parameters
}
```

**Example:**
```json
{
  "to": "+447700900002",
  "message": "Your appointment is confirmed for Tuesday 10am at Oak Farm.",
  "enquiryId": "abc-123-uuid",
  "language": "en"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "messageId": "wamid.xyz789"
}
```

---

### POST /api/n8n/trigger/send-email

Request n8n (or direct service) to send an email.

**Headers:**
- `Authorization: Bearer <N8N_API_KEY>`

**Request Body:**
```typescript
{
  to: string,             // email address
  subject: string,
  body: string,           // plain text body
  enquiryId?: string,     // UUID
  language?: string,      // "en" | "fr"
  html?: string,          // optional custom HTML
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "messageId": "<msg-id@smtp.example.com>"
}
```

---

### POST /api/n8n/trigger/request-info

Request n8n to ask the customer for missing information.

**Headers:**
- `Authorization: Bearer <N8N_API_KEY>`

**Request Body:**
```typescript
{
  enquiryId: string,      // UUID
  customerId: string,     // UUID
  missingFields: string[],// e.g. ["postcode", "horseCount", "preferredDays"]
  channel?: "WHATSAPP" | "EMAIL", // override customer preference
  language?: string,      // "en" | "fr"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "messageId": "wamid.xyz789",
  "channel": "WHATSAPP"
}
```

**Error Codes (all outbound endpoints):**
- `401` — Invalid API key
- `400` — Validation failed
- `404` — Customer not found (request-info only)
- `422` — No contact method available
- `500` — Internal error
