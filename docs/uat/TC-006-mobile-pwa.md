# TC-006 — Mobile & PWA

## Overview

| Field | Value |
|-------|-------|
| Module | PWA installation, mobile navigation, touch targets, offline |
| Priority | P2 |
| Preconditions | App deployed to UAT with HTTPS, tested on real devices or emulators |

---

## TC-006-01: App Installs to Home Screen (iOS)

| Field | Value |
|-------|-------|
| **ID** | TC-006-01 |
| **Title** | PWA installs to iOS home screen |
| **Priority** | P2 |

**Preconditions:** Safari on iOS 16+ device, app served over HTTPS

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open the app URL in Safari | App loads correctly |
| 2 | Tap the Share button (box with arrow) | Share sheet appears |
| 3 | Tap "Add to Home Screen" | Name/icon preview shown |
| 4 | Verify app name is "EquiSmile" | Correct name displayed |
| 5 | Tap "Add" | App icon appears on home screen |
| 6 | Tap the home screen icon | App opens in standalone mode (no Safari chrome) |
| 7 | Verify app loads correctly in standalone mode | Dashboard or last page displays |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-006-02: App Installs to Home Screen (Android)

| Field | Value |
|-------|-------|
| **ID** | TC-006-02 |
| **Title** | PWA installs to Android home screen |
| **Priority** | P2 |

**Preconditions:** Chrome on Android device, app served over HTTPS

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Open the app URL in Chrome | App loads correctly |
| 2 | Tap the three-dot menu | Menu opens |
| 3 | Tap "Install app" or "Add to Home screen" | Install prompt appears |
| 4 | Verify app name is "EquiSmile" | Correct name displayed |
| 5 | Tap "Install" | App installed, icon on home screen |
| 6 | Open from home screen | App launches in standalone mode |
| 7 | Verify splash screen appears briefly | EquiSmile branding shown |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-006-03: Bottom Navigation Functional at 390px

| Field | Value |
|-------|-------|
| **ID** | TC-006-03 |
| **Title** | Mobile bottom navigation works at 390px viewport width |
| **Priority** | P1 |

**Preconditions:** Mobile device or browser DevTools at 390px width

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Set viewport to 390px width (iPhone 14 size) | Mobile layout active |
| 2 | Verify bottom navigation bar is visible | Nav bar at bottom of screen |
| 3 | Verify desktop sidebar is hidden | No sidebar visible |
| 4 | Tap each navigation item (Dashboard, Enquiries, Customers, etc.) | Each page loads correctly |
| 5 | Verify active tab is highlighted | Current page indicator visible |
| 6 | Verify no horizontal overflow or scrolling | Content fits 390px width |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-006-04: Language Switcher Works on Mobile

| Field | Value |
|-------|-------|
| **ID** | TC-006-04 |
| **Title** | Language switcher accessible and functional on mobile |
| **Priority** | P1 |

**Preconditions:** Mobile viewport (390px)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Locate the language switcher on mobile | Switcher visible in header or menu |
| 2 | Tap language switcher | Language options shown |
| 3 | Switch from EN to FR | Page reloads in French |
| 4 | Verify all navigation labels are in French | Bottom nav items in French |
| 5 | Switch back to EN | Page reloads in English |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-006-05: Forms Usable on Mobile Keyboard

| Field | Value |
|-------|-------|
| **ID** | TC-006-05 |
| **Title** | Forms remain usable when mobile keyboard is open |
| **Priority** | P2 |

**Preconditions:** Mobile device with on-screen keyboard

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to New Customer form on mobile | Form loads |
| 2 | Tap the first input field | Keyboard opens, field visible above keyboard |
| 3 | Enter text and tab to next field | Focus moves correctly, next field scrolls into view |
| 4 | Fill in all fields with keyboard open | No fields hidden behind keyboard |
| 5 | Tap "Save" button | Button accessible, form submits |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-006-06: Touch Targets Adequate

| Field | Value |
|-------|-------|
| **ID** | TC-006-06 |
| **Title** | All interactive elements meet 44px minimum touch target |
| **Priority** | P2 |

**Preconditions:** Mobile device or DevTools

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Customers list on mobile | List displayed |
| 2 | Verify buttons are easily tappable | No mis-taps needed |
| 3 | Verify list items/links have adequate touch area | Easy to tap the correct item |
| 4 | Navigate to a form page | Form displayed |
| 5 | Verify checkboxes, dropdowns, and buttons are at least 44px | Meets minimum target size |
| 6 | Verify navigation items in bottom bar are at least 44px | Adequate tap area |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-006-07: Offline Banner Appears When Disconnected

| Field | Value |
|-------|-------|
| **ID** | TC-006-07 |
| **Title** | Offline banner displays when network connection lost |
| **Priority** | P2 |

**Preconditions:** App loaded and functional

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | With app loaded, enable airplane mode (or disable network in DevTools) | Network disconnected |
| 2 | Verify offline banner appears | Banner visible at top/bottom of screen |
| 3 | Verify banner message indicates offline status | Clear offline message displayed |
| 4 | Attempt to navigate to another page | Cached pages may load, or offline state shown |
| 5 | Re-enable network connection | Network restored |
| 6 | Verify offline banner disappears | Banner removed |
| 7 | Verify app resumes normal operation | Data loads correctly |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________
