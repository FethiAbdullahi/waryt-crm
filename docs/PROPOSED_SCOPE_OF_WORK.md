# Waryt CRM — Proposed Scope of Work

**Prepared for:** Waryt Furniture  
**Product:** Waryt CRM — Sales & Showroom Management Platform  
**Document type:** Contract proposal — scope, user stories, and delivery plan  
**Delivery window:** 10 business days from contract signature  
**Developer:** Fethi Abdullahi
**Version:** 1.0 (Proposal)

---

## 1. Purpose of this document

This document defines what we will build and configure for Waryt Furniture upon contract agreement. It translates your showroom requirements into clear user stories, planned deliverables, and acceptance criteria — written for business stakeholders, managers, and contract reviewers.

Upon signature, our team will have **10 business days** to configure, develop, and hand over a working Waryt CRM environment tailored to your sales floor, field team, and administration workflows.

---

## 2. Executive summary

Waryt CRM will become your team’s shared workspace for showroom and field sales: customer accounts, visit logging, sales tracking, performance targets, reporting, and team coordination — in one secure, browser-based platform.

**Upon completion of this engagement, Waryt Furniture will have:**

| Capability | What your team will be able to do |
|------------|-----------------------------------|
| **Customer Interaction Log** | Record every showroom visit with contact details, products discussed, purchase outcome, and follow-up — in one structured form |
| **Product catalog & stock** | Maintain your furniture range and stock levels so staff see real availability while serving customers |
| **Manager review** | Submit visit logs for approval before they become official records |
| **Marketing segments** | Tag customers and export lists for targeted bulk messaging |
| **Duplicate awareness** | Receive warnings when a phone or email may already exist in the system |
| **Excel export** | Download interaction and sales data for filing, finance, and records |
| **Ethiopian Birr (ETB) only** | Work entirely in ETB — no mixed or converted currency confusion |
| **Customer satisfaction ratings** | Capture 1–5 star reviews after closed deals and surface them on dashboards and leaderboards |
| **Three languages** | Use English, Amharic, or Oromo across all new features |
| **Mobile app (PWA)** | Install Waryt on phones and tablets like a native app — home screen icon, full-screen experience, no app store required |

This proposal reflects requirements gathered during discovery with Waryt Furniture. Nothing in this document assumes work has begun; development starts on **Day 1** after contract signature.

---

## 3. Your requirements — scope confirmation

The following tables confirm what is **included** in this engagement. Each item will be built, configured, and verified before handover.

### 3.1 Customer visit and interaction log

| Requirement | Included |
|-------------|----------|
| Customer name, phone, and email | Yes |
| Whether the customer made a purchase that day | Yes |
| Primary product viewed or discussed | Yes |
| Whether stock was sufficient for the customer’s request | Yes |
| List of items purchased (multiple products per visit) | Yes |
| Internal sales notes | Yes |
| Customer type: business (B2B) or individual (B2C) | Yes |
| Customer feedback and concerns | Yes |

**When no purchase was made:**

| Requirement | Included |
|-------------|----------|
| Whether an alternative product was offered | Yes |
| Follow-up when the item is back in stock | Yes (including internal reminder for the sales team) |

### 3.2 Marketing and customer segmentation

| Requirement | Included |
|-------------|----------|
| Tag customers for targeted bulk messaging (by category, purchase history, B2B/B2C) | Yes |
| Export customer lists for use outside the system | Yes (Excel) |

### 3.3 Questions raised during discovery

| Question | Our commitment |
|----------|----------------|
| Can data be downloaded to Excel for filing and records? | Yes — you will be able to export both the interaction log and the sales log to Excel. |
| Can submitted visit records be reviewed before they are finalized? | Yes — staff will submit for manager review; managers will approve or reject with optional notes. |
| Can the system warn when a contact may already exist? | Yes — warnings will appear for matching phone or email on visits and existing accounts. |
| Can sales staff use Waryt on their phones like a mobile app? | Yes — Waryt will be installable on phones and tablets as a Progressive Web App (PWA), with a home-screen icon and app-like experience. |

### 3.4 Customer satisfaction and salesperson ratings

| Requirement | Included |
|-------------|----------|
| After a deal is closed, prompt for a customer satisfaction rating (1–5 stars) | Yes |
| Rating recorded against the salesperson who closed the deal | Yes |
| Salesperson can view their customer satisfaction review history | Yes |
| Top performers of the week show customer satisfaction alongside sales | Yes |
| Administrators can see satisfaction ratings per salesperson | Yes |

### 3.5 Mobile app — install on phone and tablet (PWA)

| Requirement | Included |
|-------------|----------|
| Install Waryt on staff phones and tablets from the browser (no app store) | Yes |
| Waryt icon on the home screen, opening in a full-screen app experience | Yes |
| In-app install prompt with step-by-step guidance when one-tap install is unavailable | Yes |
| Install instructions and prompts in English, Amharic, and Oromo | Yes |
| Showroom and field staff can log visits and sales from mobile devices | Yes |

---

## 4. Platform your team will receive

In addition to the custom showroom features above, Waryt CRM will include a full sales operations foundation — configured for Waryt Furniture on Day 1 and ready for your team to use from handover:

- **Secure sign-in** for staff, with roles for sales reps, managers, and administrators  
- **Waryt Studio** — unified workspace for pipeline, accounts, performance, insights, alerts, reporting, sales log, and team challenges  
- **Sales desk** — log sales with payment type (cash, cheque, credit), due dates, and quick entry from the pipeline  
- **Pipeline management** — track leads and accounts through stages, industries, contacts, and activities  
- **Dashboards and reports** — revenue views, breakdowns, and team leaderboards  
- **Administration** — organization-wide sales view, performance, user management, and teams  
- **Settings** — personal preferences, notifications, and sales targets  
- **Languages** — English, Amharic, and Oromo across the application  
- **Progressive Web App (PWA)** — install Waryt on phones and tablets from the browser; opens full-screen with your Waryt branding on the home screen  

Your 10-day engagement focuses on tailoring this platform to Waryt Furniture’s showroom workflow — not on building a generic tool from scratch.

---

## 5. Planned deliverables & user stories

Each deliverable below includes a user story (what your staff will be able to do), what we will build, and how you will verify it at handover.

---

### 5.1 Customer Interaction Log

**User story**  
*As a showroom sales representative, I will be able to record each customer visit in one place so my team can see contact details, what happened in the visit, and any follow-up needed.*

**We will build:**
- A dedicated **Interactions** area within Waryt Studio  
- A single form for each visit, covering all fields listed in Section 3.1  
- Different form sections when the customer purchased versus when they did not  
- Option to link the visit to an existing pipeline account to reduce duplicate data entry  
- Save as draft or submit for manager review  
- Searchable history with filters by review status and marketing segment  
- Export of the filtered list to Excel for filing or external use  

**You will verify:**
- All agreed visit fields are available on the form  
- Purchase and no-purchase paths show the correct fields  
- Draft and submit-for-review options work as described  
- Managers see items awaiting review; approved records are locked for reps  

---

### 5.2 Product catalog and stock

**User story**  
*As an administrator, I will be able to maintain our furniture products and stock levels so showroom staff see accurate availability when logging visits.*

**We will build:**
- Admin area to add and manage products (name, category, quantity, in-stock status, active/inactive)  
- Products selectable in the interaction form when staff log what customers viewed or bought  
- Clear out-of-stock indication during data entry  

**You will verify:**
- Administrators can maintain the product list without technical support  
- Active products appear in visit forms; inactive products do not  
- Stock quantity and in-stock flag can be updated from the admin screen  

---

### 5.3 Manager approval workflow

**User story**  
*As a sales manager, I will be able to review submitted visit logs before they are treated as official records.*

**We will build:**
- Workflow: Draft → Submitted for review → Approved or Rejected  
- Manager queue showing pending submissions on the Interactions screen  
- Optional notes when approving or rejecting  
- Sales reps unable to edit approved entries; managers retain edit access  

**You will verify:**
- Submitted visits appear in the manager queue  
- Approve and reject actions update status and save optional notes  
- Approved entries cannot be changed by the submitting rep  

---

### 5.4 Marketing segments and export

**User story**  
*As marketing staff, I will be able to tag customers by segment and export lists for bulk messaging campaigns.*

**We will build:**
- Predefined marketing segments (e.g. furniture category, B2B/B2C, purchase-related tags)  
- Ability to assign multiple tags per visit  
- Filter the interaction list by segment  
- Excel export including segment/tag information  

**You will verify:**
- Tags can be applied when logging a visit  
- Filtered exports contain the columns needed for external mailing lists  

---

### 5.5 Duplicate contact awareness

**User story**  
*As a sales representative, I will be alerted when a phone number or email may already belong to another customer or visit.*

**We will build:**
- Warning on the visit form when phone or email matches an existing record  
- Indication of whether the match is from a prior visit or an existing account  

**You will verify:**
- Warning appears before save when a likely duplicate is detected  
- Staff can still proceed after reviewing the warning  

---

### 5.6 Excel export for sales records

**User story**  
*As finance or administration, I will be able to download sales data in Excel format for filing and reporting.*

**We will build:**
- Sales log export producing Excel files suitable for office use  

**You will verify:**
- Exported file opens correctly in Microsoft Excel or equivalent  

---

### 5.7 Ethiopian Birr (ETB) only

**User story**  
*As finance and operations, we will work entirely in Ethiopian Birr and will not need US Dollar amounts in the system.*

**We will build:**
- All sales amounts, pipeline deal values, targets, and reports in **ETB only**  
- Removal of currency selection from data entry screens  
- Consistent ETB display across dashboards and reports  

**You will verify:**
- New sales are entered and displayed in ETB  
- Totals and reports reflect full ETB values (not reduced or converted incorrectly)  
- No USD option appears in settings or forms  

---

### 5.8 Language support for new features

**User story**  
*As Amharic- or Oromo-speaking staff, I will be able to use the new visit log and product catalog screens in my preferred language.*

**We will build:**
- Full translation of the Customer Interaction Log in English, Amharic, and Oromo  
- Full translation of the Admin Product Catalog in all three languages  
- Status labels, buttons, filters, and export headers following the user’s language setting  

**You will verify:**
- Switching language in settings updates the Interactions and Product Catalog screens  
- No English-only labels remain on primary screens when Amharic or Oromo is selected  

---

### 5.9 Customer satisfaction reviews

**User story**  
*As a salesperson, I will be able to capture a customer’s satisfaction rating right after I close a deal, so my service quality is visible to me, my managers, and on the weekly top-performers board.*

**We will build:**
- After a deal is closed (from the pipeline or quick-add with won/paying sync), a brief **5-star review popup** with friendly copy such as “Rate your satisfaction”  
- Ability for the closing salesperson to record the customer’s **1–5 star rating** at the point of sale, with submit or skip  
- Each review rating stored against the salesperson who closed the deal, with customer name and link to the account or sale  
- Recent review ratings on the home dashboard under **Your customer satisfaction**  
- **Top performers of the week** showing each seller’s average star rating and review count alongside sales  
- **Administrators** seeing average satisfaction ratings and review counts in the team performance view  

**You will verify:**
- Review popup appears immediately after a successful deal close from the pipeline or quick-add won flow  
- Submitted 1–5 star ratings appear on the salesperson’s satisfaction history on the home page  
- Top-performer rows show average customer rating when reviews exist for the current week  
- Administrators can see satisfaction rating metrics per seller in team performance  

---

### 5.10 Progressive Web App (PWA) — mobile install

**User story**  
*As a showroom or field sales representative, I will be able to install Waryt on my phone or tablet like a mobile app so I can log visits and sales on the shop floor without opening a browser tab every time.*

**We will build:**
- **Installable Waryt app** on supported phones and tablets — no Apple App Store or Google Play listing required  
- **Home-screen icon** with Waryt branding; opens in a clean, full-screen app experience  
- **One-tap install prompt** when the browser supports it, plus clear manual steps for Chrome, Edge, and Safari (including iPhone/iPad Add to Home Screen)  
- Install guidance available in **English, Amharic, and Oromo**  
- Full access to showroom workflows (interactions, pipeline, quick-add sales, dashboards) from installed mobile devices on your live HTTPS URL  

**You will verify:**
- On a staff phone or tablet, Waryt can be installed from the browser and launches from the home screen  
- Installed app opens full-screen with Waryt branding (not a generic browser chrome bar)  
- Install instructions are understandable in your team’s preferred language  
- Core showroom tasks — logging a visit, recording a sale, viewing the dashboard — work from the installed app  

---

## 6. Ten-day delivery plan

Development begins on **Day 1** (first business day after contract signature). Handover and acceptance testing occur on **Day 10**.

| Phase | Days | Focus |
|-------|------|--------|
| **Foundation & setup** | 1–2 | Environment configuration, user roles, ETB currency setup, PWA install experience, core Waryt Studio access for your admin team |
| **Showroom workflow** | 3–5 | Customer Interaction Log, product catalog, duplicate warnings, purchase / no-purchase form paths |
| **Governance & export** | 6–7 | Manager approval workflow, marketing segments, Excel export for interactions and sales |
| **Performance & satisfaction** | 8–9 | Customer satisfaction ratings, dashboard and leaderboard integration, admin performance view |
| **Localization & handover** | 10 | Amharic and Oromo translations for new features, acceptance walkthrough, admin training materials |

Throughout the 10 days, Waryt Furniture will have a single point of contact for scope questions. Any change to requirements beyond this document will be agreed in writing before work proceeds.

---

## 7. Assumptions

- Waryt Furniture will provide admin access and designate staff for product catalog setup and role assignment during Days 1–2.  
- Staff will use supported modern web browsers (Chrome, Edge, Safari, or Firefox) on desktop and mobile; the installable app (PWA) requires HTTPS on your production URL.  
- Google sign-in will remain the primary authentication method for the organization.  
- Marketing and finance teams will use exported Excel files with their own tools for bulk messaging and archival.  
- Manager and administrator roles will be assigned to appropriate staff before manager review and catalog configuration go live.  
- Discovery requirements captured in Section 3 represent the full scope for this 10-day engagement unless amended by written agreement.

---

## 8. Acceptance checklist

At the end of Day 10, Waryt Furniture may use this checklist to confirm that everything in this proposal has been delivered:

- [ ] Visit log form includes all fields agreed in discovery (Section 3.1)  
- [ ] Purchase and no-purchase scenarios work correctly on a test visit  
- [ ] Manager can approve and reject submitted visits; reps cannot edit approved visits  
- [ ] Product catalog is configured and products appear when logging visits  
- [ ] Duplicate phone/email warning appears when expected  
- [ ] Interaction list and sales log export open correctly in Excel  
- [ ] All amounts display in Ethiopian Birr (ETB) only  
- [ ] Interactions and Product Catalog display correctly in English, Amharic, and Oromo  
- [ ] Marketing tags can be applied and exported in a filtered list  
- [ ] After closing a deal, the 5-star review rating popup appears and a submitted rating shows on the salesperson’s home page  
- [ ] Top performers of the week and admin team performance show customer satisfaction review ratings where reviews exist  
- [ ] Waryt can be installed on a staff phone or tablet and opens from the home screen as a full-screen app  
- [ ] Install guidance is available in English, Amharic, and Oromo  

---

## 9. What happens when you agree

1. **Contract signature** — This scope becomes the binding statement of work for the 10-day delivery window.  
2. **Day 1 kickoff** — We configure your Waryt CRM environment and confirm admin access, roles, and product catalog ownership.  
3. **Days 2–9** — We build and configure each deliverable in Section 5 according to the timeline in Section 6.  
4. **Day 10 handover** — Joint walkthrough using the acceptance checklist in Section 8.  
5. **Go-live** — Your showroom and field teams begin using Waryt CRM for daily operations.

---

*Proposal version 1.0 — Waryt Furniture CRM. For contract review and agreement.*
