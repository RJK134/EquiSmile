# TC-008 — Error Handling

## Overview

| Field | Value |
|-------|-------|
| Module | Error boundaries, form validation, network errors, API timeouts |
| Priority | P2 |
| Preconditions | Logged in, UAT environment running |

---

## TC-008-01: Network Error Shows Friendly Message

| Field | Value |
|-------|-------|
| **ID** | TC-008-01 |
| **Title** | Network errors display a user-friendly message instead of a crash |
| **Priority** | P2 |

**Preconditions:** App loaded and functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open browser DevTools → Network tab | DevTools open |
| 2 | Enable "Offline" mode in DevTools | Network disconnected |
| 3 | Attempt to navigate to a page that loads data (e.g., Customers list) | Page attempts to load |
| 4 | Verify a friendly error/offline message appears | No raw error stack trace shown |
| 5 | Verify the offline banner appears | Banner indicates no connection |
| 6 | Disable offline mode | Network restored |
| 7 | Refresh or retry | Data loads correctly |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-008-02: Form Validation Shows Inline Errors

| Field | Value |
|-------|-------|
| **ID** | TC-008-02 |
| **Title** | Form validation displays inline error messages for invalid input |
| **Priority** | P1 |

**Preconditions:** On a customer creation form

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to New Customer form | Form opens |
| 2 | Leave all fields empty and click "Save" | Form does not submit |
| 3 | Verify inline error on "Full Name" field | Error message like "Name is required" |
| 4 | Enter name but leave email in invalid format ("not-an-email") | Partial form data |
| 5 | Click "Save" | Form does not submit |
| 6 | Verify inline error on email field | Error message like "Invalid email" |
| 7 | Fix the email and submit | Form submits successfully |
| 8 | Verify error messages clear when fields are corrected | Errors disappear |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-008-03: API Timeout Shows Retry Option

| Field | Value |
|-------|-------|
| **ID** | TC-008-03 |
| **Title** | API timeouts display a retry option to the user |
| **Priority** | P2 |

**Preconditions:** App loaded, DevTools available

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open DevTools → Network tab | DevTools open |
| 2 | Throttle network to "Slow 3G" or add latency | Network slowed |
| 3 | Navigate to a data-loading page | Page loading indicator appears |
| 4 | If request times out, verify error message appears | Timeout message displayed |
| 5 | Verify "Retry" button or option is available | Retry action accessible |
| 6 | Click "Retry" | Request re-attempted |
| 7 | Remove throttling | Normal speed |
| 8 | Verify data loads on retry | Content displayed correctly |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-008-04: Invalid Data Submission Rejected Gracefully

| Field | Value |
|-------|-------|
| **ID** | TC-008-04 |
| **Title** | API rejects invalid data with clear error messages |
| **Priority** | P1 |

**Preconditions:** Access to API (via browser or API client)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Send POST to `/api/customers` with empty body `{}` | 400 response |
| 2 | Verify response includes validation error details | Zod errors indicate missing fields |
| 3 | Send POST to `/api/customers` with invalid email: `{ "fullName": "Test", "email": "not-valid" }` | 400 response |
| 4 | Verify response mentions email validation failure | Error specifies email field |
| 5 | Send POST with valid data | 200/201 response, customer created |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-008-05: Error Boundary Catches Rendering Errors

| Field | Value |
|-------|-------|
| **ID** | TC-008-05 |
| **Title** | React error boundary catches component crashes and shows recovery UI |
| **Priority** | P2 |

**Preconditions:** App loaded (this test may require DevTools or intentionally corrupted data)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to a detail page with potentially invalid/missing data (e.g., appointment with deleted visit request) | Page attempts to render |
| 2 | If a rendering error occurs, verify error boundary catches it | Friendly error page shown instead of blank screen |
| 3 | Verify error message is user-friendly | No raw stack traces displayed |
| 4 | Verify "Try Again" or "Go Back" option is available | Recovery action accessible |
| 5 | Click the recovery action | App returns to functional state |
| 6 | Verify app continues to work on other pages | No cascading failures |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________
