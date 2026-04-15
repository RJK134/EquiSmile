# TC-001 — Customer Management

## Overview

| Field | Value |
|-------|-------|
| Module | Customer, Yard, Horse Management |
| Priority | P1 |
| Preconditions | Logged in, UAT seed data loaded, language set to English |

---

## TC-001-01: Create Customer (EN)

| Field | Value |
|-------|-------|
| **ID** | TC-001-01 |
| **Title** | Create a new English-speaking customer |
| **Priority** | P1 |

**Preconditions:** On the Customers list page (`/en/customers`)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "New Customer" button | Customer creation form opens |
| 2 | Enter Full Name: "Emma Thompson" | Field accepts input |
| 3 | Enter Mobile: "+447700900099" | Field accepts UK mobile format |
| 4 | Enter Email: "emma@example.co.uk" | Field accepts email format |
| 5 | Select Preferred Channel: "WhatsApp" | Dropdown shows WhatsApp selected |
| 6 | Select Preferred Language: "English" | Dropdown shows English selected |
| 7 | Enter Notes: "New client, referred by Sarah Jones" | Text area accepts input |
| 8 | Click "Save" | Success toast appears, redirected to customer detail page |
| 9 | Verify all entered data displays correctly | Name, phone, email, channel, language, notes all match |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-001-02: Create Customer (FR)

| Field | Value |
|-------|-------|
| **ID** | TC-001-02 |
| **Title** | Create a new French-speaking customer |
| **Priority** | P1 |

**Preconditions:** Language switched to French (`/fr/customers`)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Click "Nouveau client" button | Form opens with French labels |
| 2 | Enter Nom complet: "Marie Lefevre" | Field accepts input |
| 3 | Enter Téléphone: "+33698765432" | Field accepts French mobile format |
| 4 | Enter Email: "marie@example.fr" | Field accepts email |
| 5 | Select Canal préféré: "Email" | Dropdown in French |
| 6 | Select Langue préférée: "Français" | Dropdown shows Français |
| 7 | Click "Enregistrer" | Success toast in French, redirected to detail page |
| 8 | Verify all labels are in French | All field labels, buttons, headings in French |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-001-03: Edit Customer Details

| Field | Value |
|-------|-------|
| **ID** | TC-001-03 |
| **Title** | Edit an existing customer's details |
| **Priority** | P1 |

**Preconditions:** Seeded customer "Sarah Jones" exists

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Customers list | Sarah Jones appears in list |
| 2 | Click on "Sarah Jones" | Customer detail page opens |
| 3 | Click "Edit" button | Form populates with current data |
| 4 | Change Mobile to "+447700900088" | Field updates |
| 5 | Change Notes to "Updated contact number" | Field updates |
| 6 | Click "Save" | Success toast, detail page shows updated data |
| 7 | Verify phone shows "+447700900088" | Updated value persisted |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-001-04: Add Yard with Full Address

| Field | Value |
|-------|-------|
| **ID** | TC-001-04 |
| **Title** | Add a yard with complete UK address to a customer |
| **Priority** | P1 |

**Preconditions:** Customer "Emma Thompson" exists (created in TC-001-01)

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to customer "Emma Thompson" | Detail page shows |
| 2 | Navigate to Yards section or Yards list | Yard management accessible |
| 3 | Click "New Yard" / "Add Yard" | Yard creation form opens |
| 4 | Enter Yard Name: "Meadow Farm Stables" | Field accepts input |
| 5 | Enter Address Line 1: "15 Meadow Lane" | Field accepts input |
| 6 | Enter Town: "Cambridge" | Field accepts input |
| 7 | Enter County: "Cambridgeshire" | Field accepts input |
| 8 | Enter Postcode: "CB2 1TN" | Field accepts UK postcode |
| 9 | Enter Access Notes: "Blue gate, ring bell" | Field accepts input |
| 10 | Click "Save" | Success toast, yard detail shows all fields |
| 11 | Verify yard linked to Emma Thompson | Customer name visible on yard |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-001-05: Add Horses to Yard

| Field | Value |
|-------|-------|
| **ID** | TC-001-05 |
| **Title** | Add horses to a customer linked to a yard |
| **Priority** | P1 |

**Preconditions:** Customer "Emma Thompson" and "Meadow Farm Stables" exist

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Horses list or customer's horses | Horse management accessible |
| 2 | Click "New Horse" / "Add Horse" | Horse creation form opens |
| 3 | Select Customer: "Emma Thompson" | Customer linked |
| 4 | Select Primary Yard: "Meadow Farm Stables" | Yard linked |
| 5 | Enter Horse Name: "Thunder" | Field accepts input |
| 6 | Enter Age: 10 | Field accepts number |
| 7 | Enter Dental Due Date: "2026-06-15" | Date picker works |
| 8 | Enter Notes: "Nervous, needs experienced handler" | Field accepts input |
| 9 | Click "Save" | Success toast, horse detail shows all fields |
| 10 | Verify horse linked to customer and yard | Both associations displayed |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-001-06: Search and Filter Customers

| Field | Value |
|-------|-------|
| **ID** | TC-001-06 |
| **Title** | Search and filter the customer list |
| **Priority** | P2 |

**Preconditions:** Multiple customers exist in the database

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | Navigate to Customers list | All customers displayed |
| 2 | Enter "Jones" in search field | List filters to show Sarah Jones |
| 3 | Clear search field | All customers shown again |
| 4 | Enter "Dupont" in search field | List filters to show Pierre Dupont |
| 5 | Enter "zzz-no-match" in search field | Empty state message displayed |
| 6 | Clear search field | All customers shown again |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________

---

## TC-001-07: Verify Bilingual Labels

| Field | Value |
|-------|-------|
| **ID** | TC-001-07 |
| **Title** | All customer management labels display correctly in both languages |
| **Priority** | P1 |

**Preconditions:** On Customers list page

| Step | Action | Expected Result |
|------|--------|----------------|
| 1 | With language set to English, view Customers list | All headings, column headers, and buttons in English |
| 2 | Click language switcher to French | Page reloads in French |
| 3 | Verify page heading is in French | "Clients" or equivalent French heading |
| 4 | Verify column headers are in French | Nom, Téléphone, Email, etc. |
| 5 | Verify "New Customer" button is in French | "Nouveau client" or equivalent |
| 6 | Navigate to customer detail page | All labels in French |
| 7 | Switch back to English | All labels revert to English |

**Pass / Fail:** ______ **Tester:** ____________ **Date:** ____________
**Notes:** _______________________________________________________________
