# EquiSmile Known Issues

## Active Issues

| ID | Phase | Severity | Description | Workaround |
|----|-------|----------|-------------|------------|
| KI-001 | 5 | Low | Google Maps API rate limiting may cause batch geocoding to fail for large batches (50+ yards) | Process in smaller batches of 10–20 |
| KI-002 | 6 | Low | Reminder scheduling depends on `POST /api/reminders/check` being called periodically — no built-in cron | Set up an external cron or n8n workflow to call the endpoint every 15 minutes |
| KI-003 | 7 | Low | PWA offline queue does not retry mutations in the original submission order if multiple were queued | Mutations are eventually consistent; order rarely matters for this app's use case |
| KI-004 | 3 | Medium | WhatsApp webhook verification requires the app to be publicly accessible — not possible in local dev | Use ngrok or similar tunnel for local WhatsApp testing |
| KI-005 | 4 | Low | Auto-triage confidence scores are heuristic-based and may misclassify edge cases | Manual override is available; triage tasks created for low-confidence classifications |

## Resolved Issues

| ID | Phase | Description | Resolution |
|----|-------|-------------|------------|
| — | — | No resolved issues tracked | — |

## Conventions

- Log issues discovered during development or UAT here
- Include phase, severity (low/medium/high/critical), and description
- Add workaround if available
- Move to Resolved section when fixed, with resolution notes
- Remove from Resolved after one release cycle
