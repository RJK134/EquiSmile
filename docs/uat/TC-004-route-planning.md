# TC-004 — Route Planning

## Overview

| Field | Value |
|-------|-------|
| Module | Geocoding, clustering, route proposals, approval/rejection |
| Priority | P1 |
| Preconditions | Logged in, UAT seed data loaded, Google Maps API key configured (or mock mode) |

---

## TC-004-01: Geocode a Yard Address

| Field | Value |
|-------|-------|
| **ID** | TC-004-01 |
| **Title** | Geocode a single yard address |
| **Priority** | P1 |

**Preconditions:** Yard "Oakfield Stables" exists with postcode CB8 9AA but no lat/lng, or a new yard with UK address

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send POST to `/api/route-planning/geocode` with `{ "yardId": "<yard-id>" }` | 200 OK response |
| 2 | View the yard detail | Latitude and longitude are now populated |
| 3 | Verify latitude is approximately 52.2 (Newmarket area) | Reasonable coordinates for CB8 postcode |
| 4 | Verify `geocodedAt` timestamp is set | Timestamp present |
| 5 | Verify `geocodeFailed` is false | No error recorded |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-004-02: Batch Geocode Multiple Yards

| Field | Value |
|-------|-------|
| **ID** | TC-004-02 |
| **Title** | Geocode multiple yards in a single batch |
| **Priority** | P2 |

**Preconditions:** Multiple yards exist without coordinates

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Identify 3+ yards without lat/lng | Yards found |
| 2 | Send batch geocode request (or trigger via UI) | All yards processed |
| 3 | Verify each yard now has lat/lng | Coordinates populated for all |
| 4 | Verify yards with invalid addresses have `geocodeFailed: true` | Failures tracked |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-004-03: Generate Route Proposals from Planning Pool

| Field | Value |
|-------|-------|
| **ID** | TC-004-03 |
| **Title** | Generate route proposals from visit requests in the planning pool |
| **Priority** | P1 |

**Preconditions:** Visit requests in PLANNING_POOL status with geocoded yards

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Planning page (`/en/planning`) | Planning pool displayed |
| 2 | Verify visit requests with status PLANNING_POOL are listed | Requests visible |
| 3 | Trigger route proposal generation (POST `/api/route-planning/generate`) | 200 OK with route run data |
| 4 | Navigate to Route Runs list (`/en/route-runs`) | New route run appears |
| 5 | Verify route run status is DRAFT or PROPOSED | Status badge correct |
| 6 | Verify the route includes stops from the planning pool | Stops listed with yard names |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-004-04: Review Route Proposal Details

| Field | Value |
|-------|-------|
| **ID** | TC-004-04 |
| **Title** | View and review a route proposal's details |
| **Priority** | P1 |

**Preconditions:** Route run exists from TC-004-03

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click on the route run from TC-004-03 | Route detail page opens |
| 2 | Verify run date is displayed | Date shown correctly |
| 3 | Verify home base address is displayed | Starting point shown |
| 4 | Verify each stop shows: yard name, customer, estimated arrival, service duration | All stop details visible |
| 5 | Verify total distance is shown | Total distance in km/miles |
| 6 | Verify total travel time is shown | Travel time in minutes/hours |
| 7 | Verify total visit time is shown | Service time total displayed |
| 8 | Verify optimisation score is present | Score displayed |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-004-05: Approve Route Proposal

| Field | Value |
|-------|-------|
| **ID** | TC-004-05 |
| **Title** | Approve a route proposal, transitioning it to APPROVED |
| **Priority** | P1 |

**Preconditions:** Route run in PROPOSED status

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | View the route run detail page | Status shows PROPOSED |
| 2 | Click "Approve" button (or PATCH route run status to APPROVED) | Success response |
| 3 | Verify status changes to APPROVED | Status badge shows APPROVED |
| 4 | Verify associated visit requests move to appropriate status | Visit requests updated |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-004-06: Reject Route Proposal

| Field | Value |
|-------|-------|
| **ID** | TC-004-06 |
| **Title** | Reject a route proposal |
| **Priority** | P2 |

**Preconditions:** Route run in PROPOSED or DRAFT status

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Create a new route proposal for testing | Route run exists |
| 2 | Click "Reject" or delete the route run | Route run removed or marked rejected |
| 3 | Verify associated visit requests return to PLANNING_POOL | Requests available for re-planning |
| 4 | Verify the rejected route no longer appears as active | Route run list updated |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________
