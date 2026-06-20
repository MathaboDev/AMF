# AMF Paystack Membership & Donation Flow — Project Context (REVISED)

---

## Client Request

> "Can you help us build a custom Paystack membership flow for AMF? We want something like Donorbox, but without Stripe. People must be able to choose: membership type and how they pay (monthly, quarterly, or yearly). Then enter their details and pay via Paystack."

**Organisation:** AMF (NGO)  
**Website platform:** Framer (pre-designed — do not modify)  
**Payment provider:** Paystack (client has/will create account)  
**Developer:** Building from scratch using HTML, CSS, JavaScript

---

## The Problem

Framer does not natively support payment integrations or recurring billing. Building a payment portal from scratch is expensive and time-consuming. The client needs a Donorbox-style membership flow but using Paystack (SA-based) instead of Stripe.

---

## The Solution

Build a **standalone payment form** (HTML/CSS/JS) hosted on **Netlify** (free). The "Become a member" buttons on the Framer site links to this form's Netlify URL. The form collects member details and passes them to **Paystack via API** to handle all payment processing.

---

## Why Paystack?

- South African payment provider
- Supports once-off and recurring payments (monthly, quarterly, yearly)
- No setup or monthly fees — 1.5% per local transaction
- PCI DSS compliant — handles all card security
- Well-documented API with JavaScript SDK
- Free to sign up

---

## The Membership Tiers (FIXED PRICING)

| Tier | Base Monthly Price | Monthly Payment | Quarterly Payment | Yearly Payment |
|---|---|---|---|
| **Open Door** | Free | R0 | R0 | R0 |
| **Community Advocate** | R50 | R50 | R200 (4 months) | R600 (12 months) |
| **Champion Advocate** | R500 | R500 | R2,000 (4 months) | R6,000 (12 months) |
| **Family Advocate** | R400 | R400 | R1,600 (4 months) | R4,800 (12 months) |

**Key Change:** All amounts are **fixed by tier** — no custom amounts. Users choose tier + frequency, and the amount auto-calculates.

---

## The Full User Flow

```
Frame 1 — AMF Framer Website
"Become a member" button (already designed in Framer)
        ↓ (links to Netlify URL)

Frame 2 — Netlify Hosted Form (what we build)
User fills in:
  - Membership Tier (dropdown)
    ├─ Open Door (Free)
    ├─ Community Advocate
    ├─ Champion Advocate
    └─ Family Advocate
  
  [IF NOT OPEN DOOR]
  - Payment Frequency (dropdown)
    ├─ Monthly
    ├─ Quarterly (×4 months)
    └─ Yearly (×12 months)
  
  [ALWAYS]
  - First Name
  - Last Name
  - Email
  - Phone (optional)

Live Amount Display:
  "You are choosing: [Tier] on a [Frequency] basis"
  "Total amount: R___"

"Proceed to Payment" button (for paying tiers)
OR
"Join our WhatsApp" button (for Open Door)
        ↓

Frame 3A — Open Door Tier
User joins email/WhatsApp signup list (no Paystack)
        ↓

Frame 3B — Paying Tiers (Community/Champion/Family)
Backend Logic (script.js)
  1. Collect user input from form
  2. Validate all fields filled correctly
  3. Lookup amount from tier × frequency table
  4. Establish connection to Paystack via API call
  5. Send details to Paystack (references pre-created Subscription Plan)

        ↓

Frame 4 — Paystack (their side, we don't touch this)
  Processes payment securely
  Handles card details, bank communication, security
        ↓

Frame 5 — Response Handling (script.js)
  Paystack sends back response
  script.js reads response:
    - If success → redirect to success.html
    - If failed/cancelled → show error on form page

        ↓

Frame 6 — Success Page (success.html)
  ✅ Payment Successful
  Thank you for your donation.
  Amount Paid: R___
  Payment Type: Monthly / Quarterly / Yearly
  Membership: Community / Champion / Family
  Date & Time: ___
  [Back to Website] button
```

---

## Project File Structure

```
amf-payment-form/
│
├── index.html        → The form (structure and layout)
├── styles.css        → Styling (colours, fonts, layout, mobile responsive)
├── script.js         → All logic and Paystack integration
└── success.html      → Thank you / confirmation page / or unsuccessful transaction > takes you back to the form
```

### What Each File Does

| File | Job |
|---|---|
| `index.html` | Tier dropdown, frequency dropdown, name/email fields, buttons — the skeleton |
| `styles.css` | Visual styling — matches AMF brand colours (#77DD77) and font for everything: Roboto with 400 weight for all text |
| `script.js` | Collects input, calculates amount from lookup table, sends to Paystack, handles response |
| `success.html` | Simple confirmation page shown indicating where successful or not |

---

## The Form Structure (SIMPLIFIED)

### Tier Dropdown
```
- Open Door (Free)
- Community Advocate (R50/month base)
- Champion Advocate (R500/month base)
- Family Advocate (R400/month base)
```

### Frequency Dropdown (Hidden if Open Door selected)
```
- Monthly
- Quarterly (4 months)
- Yearly (12 months)
```

### Auto-Calculated Amount
Formula: `Amount = Base Price × Frequency Multiplier`
- Monthly = ×1
- Quarterly = ×4
- Yearly = ×12

Examples:
- Community + Monthly = R50
- Community + Quarterly = R50 × 4 = R200
- Champion + Yearly = R500 × 12 = R6,000

### User Fields (Always shown)
- First Name (required)
- Last Name (required)
- Email (required)
- Phone (optional)

### Buttons

**If Open Door selected:**
- "Join our WhatsApp" → Email signup form (no Paystack)

**If paying tier selected:**
- "Proceed to Payment" → Opens Paystack popup

---

## JavaScript Methods in script.js

### Method 1 — Event Listeners (Tier & Frequency Change)
```javascript
tierDropdown.addEventListener('change', function() {
    if (value === 'open-door') {
        frequencyDropdown.style.display = 'none'
        amountDisplay.innerHTML = 'Free'
        payButton.innerHTML = 'Join our WhatsApp'
    } else {
        frequencyDropdown.style.display = 'block'
        calculateAmount()
    }
})

frequencyDropdown.addEventListener('change', calculateAmount)
```
**Job:** When user picks a tier or frequency, update the form (hide/show fields, calculate amount).

---

### Method 2 — calculateAmount()
```javascript
function calculateAmount() {
    const tier = tierDropdown.value
    const frequency = frequencyDropdown.value
    
    const lookup = {
        'community': { monthly: 50, quarterly: 200, yearly: 600 },
        'champion': { monthly: 500, quarterly: 2000, yearly: 6000 },
        'family': { monthly: 400, quarterly: 1600, yearly: 4800 }
    }
    
    amount = lookup[tier][frequency]
    
    // Update display
    amountDisplay.innerHTML = `R${amount}`
    
    // Store for later
    window.selectedAmount = amount
}
```
**Job:** Looks up the amount from a simple table based on tier + frequency. No calculations needed — just retrieval.

---

### Method 3 — validateForm()
```javascript
function validateForm() {
    if (!firstName.value || !lastName.value || !email.value) {
        document.getElementById('error-message').innerText 
            = 'Please fill in all required fields.'
        return false
    }
    return true
}
```
**Job:** Makes sure user hasn't left name/email blank before sending to Paystack.

---

### Method 4 — sendToPaystack() (Core Integration)
```javascript
function sendToPaystack() {
    if (!validateForm()) return
    
    const tier = tierDropdown.value
    const frequency = frequencyDropdown.value
    const amount = window.selectedAmount
    const email = document.getElementById('email').value
    const name = `${firstName.value} ${lastName.value}`
    
    // Map tier + frequency to Paystack Subscription Plan ID
    const planLookup = {
        'community-monthly': 'PLAN_ID_123',
        'community-quarterly': 'PLAN_ID_124',
        'community-yearly': 'PLAN_ID_125',
        'champion-monthly': 'PLAN_ID_201',
        // ... etc
    }
    
    const planId = planLookup[`${tier}-${frequency}`]
    
    PaystackPop.setup({
        key: 'pk_live_YOUR_PAYSTACK_PUBLIC_KEY',
        email: email,
        amount: amount * 100,   // Convert to cents
        currency: 'ZAR',
        plan: planId,           // Subscription plan (pre-created by AMF)
        metadata: {
            name: name,
            tier: tier,
            frequency: frequency,
            phone: document.getElementById('phone').value
        },
        onSuccess: function(response) {
            handleSuccess(response)
        },
        onCancel: function() {
            handleCancel()
        }
    }).openIframe()
}
```
**Job:** Opens the Paystack payment popup with the user's details. Paystack handles everything inside that popup.

---

### Method 5 — handleSuccess()
```javascript
function handleSuccess(response) {
    // Store success details in session storage
    sessionStorage.setItem('successData', JSON.stringify({
        amount: window.selectedAmount,
        tier: tierDropdown.value,
        frequency: frequencyDropdown.value,
        reference: response.reference,
        email: document.getElementById('email').value
    }))
    
    // Redirect to success page
    window.location.href = 'success.html'
}
```
**Job:** Redirects user to thank you page after successful payment.

---

### Method 6 — handleCancel()
```javascript
function handleCancel() {
    document.getElementById('error-message').innerText 
        = 'Payment cancelled. Please try again or contact support.'
}
```
**Job:** Shows an error message on the form if the user cancels or payment fails. User stays on form with their details intact.

---

## Paystack Integration — Setup Required

### Subscription Plans (AMF's Job — Done BEFORE Form Launch)

AMF must pre-create these plans in Paystack Dashboard → Plans:

| Plan Name | Interval | Amount (ZAR) | Plan ID (for script.js) |
|---|---|---|---|
| Community Monthly | Monthly | 5000 (R50) | `PLAN_CMO` |
| Community Quarterly | Quarterly | 20000 (R200) | `PLAN_CQT` |
| Community Yearly | Yearly | 60000 (R600) | `PLAN_CYR` |
| Champion Monthly | Monthly | 50000 (R500) | `PLAN_CHM` |
| Champion Quarterly | Quarterly | 200000 (R2,000) | `PLAN_CHQT` |
| Champion Yearly | Yearly | 600000 (R6,000) | `PLAN_CHYR` |
| Family Monthly | Monthly | 40000 (R400) | `PLAN_FAM` |
| Family Quarterly | Quarterly | 160000 (R1,600) | `PLAN_FAQT` |
| Family Yearly | Yearly | 480000 (R4,800) | `PLAN_FAYR` |

**Notes:**
- Amounts in Paystack are in **cents** (ZAR 50 = 5000 cents)
- "Interval" = how often payment recurs (Monthly, Quarterly, Yearly)
- Once plans are created, copy their Plan IDs into script.js

### API Keys
- Paystack provides **Public Key** (for frontend, safe to show)
- Paystack provides **Secret Key** (keep secret, for backend only)
- Form uses only the Public Key

### Open Door Tier
- No Paystack interaction
- When selected → Show email capture form
- Email → Sent to AMF mailing list (Zapier or form submission to Airtable/Google Sheets)

---

## Hosting — Netlify

- **Free tier** — no expiry, production-ready
- Includes SSL certificate (padlock — required for payment forms)
- Deploy by dragging the project folder onto netlify.com
- Generates a URL e.g. `amf-donate.netlify.app`
- Can add custom domain e.g. `donate.amf.org.za`

### Ownership Recommendation
Client should create the Netlify account — developer manages it on their behalf. Client owns the asset permanently.

---

## What the Developer Needs From Client Before Starting

1. **Paystack API keys** (public key for frontend — test keys first, live keys for launch)
2. **Paystack Subscription Plan IDs** (created by AMF after test payments work)
3. **AMF logo** (for form header)
4. **Brand colours** (primary green: #1DD1A1, secondary colours if any)
5. **Typography preferences** (font families already selected)
6. **Email service for Open Door signups** (Zapier, Airtable, Google Forms, etc.)

---

## Proposed Timeline

| Week | Deliverable |
|---|---|
| Week 1 | Form built, working with Paystack test payments (all tiers + frequencies tested) |
| Week 2 | Open Door email signup wired, all error handling, mobile responsive |
| Week 3 | Styled to match AMF brand, success page polished, go live with Paystack live keys |

---

## Key Differences from Original Scope

| Original | Revised |
|---|---|
| Custom amount field | Dropdown tiers only (fixed prices) |
| Users enter custom amounts | Tier + Frequency → Auto-calculated |
| Complex calculation logic | Simple lookup table |
| Open Door unclear | Open Door → Email signup (no Paystack) |
| Form longer | Form shorter (2 dropdowns + 3 fields) |
| More error states | Fewer error states |

---

Features included:
  - Live summary that updates as you change tier / frequency
  - Sticky summary card on desktop with subtle elevation while scrolling
  - Hover / focus / active animations on inputs, payment cards, and CTA
  - Floating-label pill inputs (matches the original design)
  - Open Door tier hides the frequency picker and redirects to WhatsApp
  - Paid tiers open the Paystack inline checkout
  - Success page reads the transaction details from sessionStorage

---

## Notes for Development

- Start with `index.html` — build form structure and tier/frequency dropdowns first
- Use Paystack **test keys** throughout development (no real money charged)
- Test every combination: 3 paying tiers × 3 frequencies = 9 payment paths
- Test Open Door email flow separately
- Mobile responsiveness is required — test on both desktop and mobile
- Add clear error messaging for failed payments
- Success page should display: amount, tier, frequency, timestamp
- Consider adding a "Back to Website" link on success page
- For Open Door signups, set up email destination (Zapier → Google Sheets or Airtable)
