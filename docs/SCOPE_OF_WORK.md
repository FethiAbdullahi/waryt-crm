# Waryt CRM — Scope of Work & User Stories

**Prepared for:** Waryt Furniture  
**Product:** Waryt CRM — Sales & Showroom Management Platform  
**Document type:** Statement of work and delivery summary for contract purposes  
**Version:** 2.0

---

## 1. Purpose of this document

This document describes the work completed on Waryt CRM for Waryt Furniture. It summarizes what was requested, what was already available in the platform, what was built or extended in this engagement, and how success can be verified. It is written for business stakeholders, managers, and contract reviewers — not for technical staff.

---

## 2. Executive summary

Waryt CRM is a shared workspace for showroom and field sales teams. It supports customer accounts, sales tracking, performance targets, reporting, and team coordination.

In this engagement, the platform was extended to meet Waryt Furniture’s showroom workflow: a structured **Customer Interaction Log**, **product catalog with stock visibility**, **manager review of submitted visits**, **marketing segmentation with export**, **duplicate contact warnings**, **Excel export for filing**, **Ethiopian Birr (ETB) as the sole currency**, **customer satisfaction reviews after closed deals**, and **full language support in English, Amharic, and Oromo** for the new features.

---

## 3. Original client requirements

### 3.1 Customer visit and interaction log

| Requirement | Status |
|-------------|--------|
| Customer name, phone, and email | Delivered |
| Whether the customer made a purchase that day | Delivered |
| Primary product viewed or discussed | Delivered |
| Whether stock was sufficient for the customer’s request | Delivered |
| List of items purchased (multiple products per visit) | Delivered |
| Internal sales notes | Delivered |
| Customer type: business (B2B) or individual (B2C) | Delivered |
| Customer feedback and concerns | Delivered |

**When no purchase was made:**

| Requirement | Status |
|-------------|--------|
| Whether an alternative product was offered | Delivered |
| Follow-up when the item is back in stock | Delivered (including internal reminder for the sales team) |

### 3.2 Marketing and customer segmentation

| Requirement | Status |
|-------------|--------|
| Tag customers for targeted bulk messaging (by category, purchase history, B2B/B2C) | Delivered |
| Export customer lists for use outside the system | Delivered (Excel) |

### 3.3 Questions raised during discovery

| Question | Answer |
|----------|--------|
| Can data be downloaded to Excel for filing and records? | Yes — both the interaction log and the sales log support Excel export. |
| Can submitted visit records be reviewed before they are finalized? | Yes — staff can submit for manager review; managers approve or reject with optional notes. |
| Can the system warn when a contact may already exist? | Yes — warnings appear for matching phone or email on visits and existing accounts. |

### 3.4 Customer satisfaction and salesperson ratings

| Requirement | Status |
|-------------|--------|
| After a deal is closed, prompt for a customer satisfaction rating (1–5 stars) | Delivered |
| Rating is recorded against the salesperson who closed the deal | Delivered |
| Salesperson can view their customer satisfaction review history | Delivered |
| Top performers of the week show customer satisfaction alongside sales | Delivered |
| Administrators can see satisfaction ratings per salesperson | Delivered |

---

## 4. Platform already in place (included in overall product scope)

The following capabilities existed before this engagement and remain part of Waryt CRM:

- **Secure sign-in** for staff, with roles for sales reps, managers, and administrators  
- **Waryt Studio** — unified workspace for pipeline, accounts, performance, insights, alerts, reporting, sales log, and team challenges  
- **Sales desk** — log sales with payment type (cash, cheque, credit), due dates, and quick entry from the pipeline  
- **Pipeline management** — track leads and accounts through stages, industries, contacts, and activities  
- **Dashboards and reports** — revenue views, breakdowns, and team leaderboards  
- **Administration** — organization-wide sales view, performance, user management, and teams  
- **Settings** — personal preferences, notifications, and sales targets  
- **Languages** — English, Amharic, and Oromo across the application  

---

## 5. Deliverables completed in this engagement

### 5.1 Customer Interaction Log

**User story:**  
*As a showroom sales representative, I want to record each customer visit in one place so my team can see contact details, what happened in the visit, and any follow-up needed.*

**What was delivered:**
- A dedicated **Interactions** area within Waryt Studio  
- A single form for each visit, covering all fields listed in Section 3.1  
- Different form sections when the customer purchased versus when they did not  
- Option to link the visit to an existing pipeline account to reduce duplicate data entry  
- Save as draft or submit for manager review  
- Searchable history with filters by review status and marketing segment  
- Export of the filtered list to Excel for filing or external use  

**Acceptance criteria:**
- All visit fields requested by the client are available on the form  
- Purchase and no-purchase paths show the correct fields  
- Draft and submit-for-review options work as described  
- Managers see items awaiting review; approved records are locked for reps  

---

### 5.2 Product catalog and stock

**User story:**  
*As an administrator, I want to maintain our furniture products and stock levels so showroom staff see accurate availability when logging visits.*

**What was delivered:**
- Admin area to add and manage products (name, category, quantity, in-stock status, active/inactive)  
- Products appear in the interaction form when staff log what customers viewed or bought  
- Out-of-stock items are clearly indicated during data entry  

**Acceptance criteria:**
- Administrators can maintain the product list without technical support  
- Active products appear in visit forms; inactive products do not  
- Stock quantity and in-stock flag can be updated from the admin screen  

---

### 5.3 Manager approval workflow

**User story:**  
*As a sales manager, I want to review submitted visit logs before they are treated as official records.*

**What was delivered:**
- Workflow: Draft → Submitted for review → Approved or Rejected  
- Manager queue showing pending submissions on the Interactions screen  
- Optional notes when approving or rejecting  
- Sales reps cannot edit approved entries; managers retain edit access  

**Acceptance criteria:**
- Submitted visits appear in the manager queue  
- Approve and reject actions update status and optional notes are saved  
- Approved entries cannot be changed by the submitting rep  

---

### 5.4 Marketing segments and export

**User story:**  
*As marketing staff, I want to tag customers by segment and export lists for bulk messaging campaigns.*

**What was delivered:**
- Predefined marketing segments (e.g. furniture category, B2B/B2C, purchase-related tags)  
- Ability to assign multiple tags per visit  
- Filter the interaction list by segment  
- Excel export includes segment/tag information  

**Acceptance criteria:**
- Tags can be applied when logging a visit  
- Filtered exports contain the columns needed for external mailing lists  

---

### 5.5 Duplicate contact awareness

**User story:**  
*As a sales representative, I want to be alerted when a phone number or email may already belong to another customer or visit.*

**What was delivered:**
- Warning on the visit form when phone or email matches an existing record  
- Indicates whether the match is from a prior visit or an existing account  

**Acceptance criteria:**
- Warning appears before save when a likely duplicate is detected  
- Staff can still proceed after reviewing the warning  

---

### 5.6 Excel export for sales records

**User story:**  
*As finance or administration, I want to download sales data in Excel format for filing and reporting.*

**What was delivered:**
- Sales log export produces Excel files suitable for office use (replacing the previous CSV-only option)  

**Acceptance criteria:**
- Exported file opens correctly in Microsoft Excel or equivalent  

---

### 5.7 Ethiopian Birr (ETB) only

**User story:**  
*As finance and operations, we work entirely in Ethiopian Birr and do not need US Dollar amounts in the system.*

**What was delivered:**
- All sales amounts, pipeline deal values, targets, and reports use **ETB only**  
- Currency selection removed from data entry screens  
- Existing records converted to ETB where the system previously stored mixed currencies  

**Acceptance criteria:**
- New sales are entered and displayed in ETB  
- Totals and reports reflect full ETB values (not reduced or converted incorrectly)  
- No USD option appears in settings or forms  

---

### 5.8 Language support for new features

**User story:**  
*As Amharic- or Oromo-speaking staff, I want the new visit log and product catalog screens in my preferred language.*

**What was delivered:**
- Full translation of the Customer Interaction Log in English, Amharic, and Oromo  
- Full translation of the Admin Product Catalog in all three languages  
- Status labels, buttons, filters, and export headers follow the user’s language setting  

**Acceptance criteria:**
- Switching language in settings updates the Interactions and Product Catalog screens  
- No English-only labels remain on primary screens when Amharic or Oromo is selected  

---

### 5.9 Customer satisfaction reviews

**User story:**  
*As a salesperson, I want customers to rate their satisfaction right after I close a deal, so my service quality is visible to me, my managers, and on the weekly top-performers board.*

**What was delivered:**
- After a deal is closed (from the pipeline or quick-add with won/paying sync), a brief **5-star review popup** appears with friendly copy such as “Rate your satisfaction”  
- The closing salesperson records the customer’s **1–5 star rating** at the point of sale; they can submit or skip  
- Each review rating is stored against the salesperson who closed the deal, with the customer name and optional link to the account or sale  
- The salesperson sees recent review ratings on the home dashboard under **Your customer satisfaction**  
- **Top performers of the week** on the home page show each seller’s average star rating and review count alongside sales  
- **Administrators** see average satisfaction ratings and review counts in the team performance view  

**Acceptance criteria:**
- Review popup appears immediately after a successful deal close from the pipeline or quick-add won flow  
- Submitted 1–5 star ratings appear on the salesperson’s satisfaction history on the home page  
- Top-performer rows show average customer rating when reviews exist for the current week  
- Administrators can see satisfaction rating metrics per seller in team performance  

---

## 6. Assumptions

- Waryt Furniture provides admin access to configure products and user roles.  
- Staff use supported modern web browsers.  
- Google sign-in remains the primary authentication method for the organization.  
- Marketing and finance teams use exported Excel files with their own tools for bulk messaging and archival.  
- Manager and administrator roles are assigned to appropriate staff for review and configuration tasks.  

---

## 7. Client acceptance checklist

The client may use the following checklist to confirm delivery:

- Visit log form includes all fields agreed in discovery (Section 3.1)  
- Purchase and no-purchase scenarios work correctly on a test visit  
- Manager can approve and reject submitted visits; reps cannot edit approved visits  
- Product catalog is configured and products appear when logging visits  
- Duplicate phone/email warning appears when expected  
- Interaction list and sales log export open correctly in Excel  
- All amounts display in Ethiopian Birr (ETB) only  
- Interactions and Product Catalog display correctly in English, Amharic, and Oromo  
- Marketing tags can be applied and exported in a filtered list  
- After closing a deal, the 5-star review rating popup appears and a submitted rating shows on the salesperson’s home page  
-  Top performers of the week and admin team performance show customer satisfaction review ratings where reviews exist  

---

*Document version 2.0 — Waryt Furniture CRM. For contract and business use.*
